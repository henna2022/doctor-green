"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getDevice, readSensors, writeActuator, Device, SensorReading } from "@/lib/sensors";
import { getCropById, MyCrop } from "@/lib/crops";

const POLL_INTERVAL = 5000;

export function useDeviceLive(deviceId: string) {
  const router = useRouter();

  const [device, setDevice] = useState<Device | null>(null);
  const [crop, setCrop] = useState<MyCrop | null>(null);
  const [reading, setReading] = useState<SensorReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // 토글 직후 서버 값이 진실 — 이후 2 폴링 주기 동안 폴링 값으로 덮어쓰지 않음
  const pendingRef = useRef<{
    led: { value: boolean; cycles: number } | null;
    fan: { value: boolean; cycles: number } | null;
  }>({ led: null, fan: null });
  // 폴링 시각(렌더 중 Date.now() 직접 호출을 피하기 위해 상태로 보관)
  const [polledAt, setPolledAt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let interval: NodeJS.Timeout;

    async function doPoll() {
      const r = await readSensors(deviceId);
      if (cancelled) return;
      const pending = pendingRef.current;
      const merged = { ...r };
      if (pending.led) {
        merged.ledOn = pending.led.value;
        pending.led.cycles -= 1;
        if (pending.led.cycles <= 0) pending.led = null;
      }
      if (pending.fan) {
        merged.fanOn = pending.fan.value;
        pending.fan.cycles -= 1;
        if (pending.fan.cycles <= 0) pending.fan = null;
      }
      setReading(merged);
      setPolledAt(Date.now());
    }

    async function init() {
      const d = await getDevice(deviceId);
      if (cancelled) return;
      if (!d) {
        router.push("/realtime");
        return;
      }
      setDevice(d);
      if (d.crop_id) {
        const c = await getCropById(d.crop_id);
        if (cancelled) return;
        setCrop(c);
      }
      setLoading(false);

      await doPoll();
      if (cancelled) return;
      interval = setInterval(doPoll, POLL_INTERVAL);
    }
    init();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [deviceId, router]);

  const handleToggle = async (pin: "led" | "fan") => {
    if (!reading) return;
    setBusy(true);
    const newVal = pin === "led" ? !reading.ledOn : !reading.fanOn;
    const res = await writeActuator(deviceId, pin, newVal);
    if (res.error) {
      alert("제어 실패: " + res.error);
    } else {
      // 서버가 돌려준 갱신 행이 진실 — 다음 2 폴링 주기 동안 폴링 값으로 덮어쓰지 않음
      const value = pin === "led" ? res.ledOn ?? newVal : res.fanOn ?? newVal;
      pendingRef.current[pin] = { value, cycles: 2 };
      setReading((prev) =>
        prev ? { ...prev, [pin === "led" ? "ledOn" : "fanOn"]: value } : prev
      );
    }
    setBusy(false);
  };

  return { device, crop, reading, loading, busy, polledAt, toggle: handleToggle };
}
