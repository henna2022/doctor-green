"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  getDevice,
  readSensors,
  writeActuator,
  saveSensorLog,
  getSensorLogs,
  Device,
  SensorReading,
  SensorLog,
} from "@/lib/sensors";
import { getCropById, MyCrop } from "@/lib/crops";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const POLL_INTERVAL = 5000; // 5초마다 센서 갱신
const LOG_INTERVAL = 60000; // 1분마다 DB 저장

export default function DeviceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params.deviceId as string;

  const [device, setDevice] = useState<Device | null>(null);
  const [crop, setCrop] = useState<MyCrop | null>(null);
  const [reading, setReading] = useState<SensorReading | null>(null);
  const [logs, setLogs] = useState<SensorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"live" | "history">("live");
  const [busy, setBusy] = useState(false);

  const lastLogRef = useRef<number>(0);

  // 데이터 로드 함수
  const poll = useCallback(async () => {
    const r = await readSensors(deviceId);
    setReading(r);

    // 일정 주기로 DB에 저장
    const now = Date.now();
    if (r.ok && now - lastLogRef.current > LOG_INTERVAL) {
      lastLogRef.current = now;
      await saveSensorLog(deviceId, r);
    }
  }, [deviceId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    async function init() {
      const d = await getDevice(deviceId);
      if (!d) {
        router.push("/realtime");
        return;
      }
      setDevice(d);
      if (d.crop_id) {
        setCrop(await getCropById(d.crop_id));
      }
      setLogs(await getSensorLogs(deviceId, 30));
      setLoading(false);

      await poll();
      interval = setInterval(poll, POLL_INTERVAL);
    }
    init();
    return () => clearInterval(interval);
  }, [deviceId, router, poll]);

  // 이력 탭 열 때 다시 불러오기
  useEffect(() => {
    if (activeTab === "history") {
      getSensorLogs(deviceId, 30).then(setLogs);
    }
  }, [activeTab, deviceId]);

  // LED/FAN 제어
  const handleToggle = async (pin: "led" | "fan") => {
    if (!reading) return;
    setBusy(true);
    const newVal = pin === "led" ? !reading.ledOn : !reading.fanOn;
    const res = await writeActuator(deviceId, pin, newVal);
    if (res.error) {
      alert("제어 실패: " + res.error);
    } else {
      // 낙관적 업데이트
      setReading({
        ...reading,
        [pin === "led" ? "ledOn" : "fanOn"]: newVal,
      });
    }
    setBusy(false);
  };

  // 📸 스냅샷 → 진단 페이지로
  const handleSnapshot = () => {
    const img = document.getElementById("camera-img") as HTMLImageElement | null;
    if (!img || !device?.camera_url) {
      alert("카메라가 연결되어 있지 않아요!");
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 640;
      canvas.height = img.naturalHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas error");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      sessionStorage.setItem("diagnose_image", dataUrl);
      sessionStorage.setItem("diagnose_crop", crop?.crop_name || "미지정");
      router.push("/diagnose/result");
    } catch (e) {
      console.error(e);
      alert("스냅샷 실패: CORS 정책 또는 카메라 응답 문제일 수 있어요.");
    }
  };

  // AI 평가 (간단 룰 기반)
  const aiAdvice = (r: SensorReading | null, cropName?: string): string => {
    if (!r || !r.ok) return "센서 데이터를 기다리는 중입니다.";
    const tips: string[] = [];
    if (r.temp != null) {
      if (r.temp >= 30) tips.push(`🌡️ 고온(${r.temp}°C) — 환기/차광 권장`);
      else if (r.temp <= 10) tips.push(`🥶 저온(${r.temp}°C) — 보온 필요`);
    }
    if (r.hum != null) {
      if (r.hum >= 80) tips.push(`💧 다습(${r.hum}%) — 통풍/팬 가동 권장`);
      else if (r.hum <= 30) tips.push(`🏜️ 건조(${r.hum}%) — 가습 권장`);
    }
    if (r.soil != null) {
      if (r.soil < 40) tips.push(`🚰 토양 건조(${r.soil}%) — 급수 필요`);
      else if (r.soil > 85) tips.push(`⚠️ 토양 과습(${r.soil}%) — 급수 중단`);
    }
    if (tips.length === 0)
      return `${cropName || "작물"} 환경이 양호합니다 ✅`;
    return tips.join("\n");
  };

  if (loading || !device) {
    return (
      <div className="phone-frame items-center justify-center">
        <div className="w-10 h-10 border-4 border-g5 border-t-g1 rounded-full animate-spin" />
      </div>
    );
  }

  const isDemo = device.blynk_token === "DEMO";

  // 차트용 데이터 가공
  const chartData = logs.map((l) => ({
    time: new Date(l.measured_at).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    temp: l.temp,
    hum: l.hum,
    soil: l.soil,
  }));

  return (
    <div className="phone-frame overflow-y-auto">
      <header className="flex items-center justify-between px-5 py-4 border-b border-brd sticky top-0 bg-bg-main z-10">
        <Link href="/realtime" className="text-2xl">‹</Link>
        <h1 className="text-base font-bold flex items-center gap-1.5">
          {device.name}
          {isDemo && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange/20 text-orange">
              DEMO
            </span>
          )}
        </h1>
        <div className="w-6" />
      </header>

      {/* 탭 */}
      <div className="flex border-b border-brd bg-bg-card flex-shrink-0">
        <button
          onClick={() => setActiveTab("live")}
          className={`flex-1 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === "live" ? "text-g1 border-g1" : "text-txt2 border-transparent"
          }`}
        >
          실시간 확인
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === "history" ? "text-g1 border-g1" : "text-txt2 border-transparent"
          }`}
        >
          데이터 이력
        </button>
      </div>

      <main className="flex-1 px-5 py-5 pb-2">
        {activeTab === "live" && (
          <>
            {/* 📹 카메라 영역 */}
            <section className="mb-5">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
                {device.camera_url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      id="camera-img"
                      src={device.camera_url}
                      alt="카메라"
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/60 text-white text-[10px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
                      LIVE
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
                    <div className="text-4xl mb-2">📷</div>
                    <p className="text-xs">카메라 미연결</p>
                  </div>
                )}
              </div>
              {/* 📸 스냅샷 → AI 진단 버튼 */}
              <button
                onClick={handleSnapshot}
                disabled={!device.camera_url}
                className="w-full mt-2 py-3 rounded-2xl bg-g1 text-white font-bold disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                📸 스냅샷 → AI 진단
              </button>
            </section>

            {/* 🌡️ 센서 카드 3개 */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <SensorCard label="온도" icon="🌡️" value={reading?.temp} unit="°C" color="#F08080" />
              <SensorCard label="습도" icon="💧" value={reading?.hum} unit="%" color="#4A90E2" />
              <SensorCard label="토양수분" icon="🌱" value={reading?.soil} unit="%" color="#4ECAA0" />
            </div>

            {/* 💡 제어 패널 */}
            <section className="mb-5">
              <h3 className="text-sm font-bold mb-2">제어</h3>
              <div className="grid grid-cols-2 gap-2">
                <ControlButton
                  label="식물생장 LED"
                  icon="💡"
                  on={reading?.ledOn || false}
                  onClick={() => handleToggle("led")}
                  disabled={busy || !reading?.ok}
                />
                <ControlButton
                  label="FAN"
                  icon="🌀"
                  on={reading?.fanOn || false}
                  onClick={() => handleToggle("fan")}
                  disabled={busy || !reading?.ok}
                />
              </div>
            </section>

            {/* 🤖 AI 평가 */}
            <section className="mb-5 p-4 rounded-2xl bg-g5">
              <h3 className="text-sm font-bold text-g1 mb-2">🤖 AI 작물 상태 평가</h3>
              <p className="text-sm text-txt whitespace-pre-line leading-relaxed">
                {aiAdvice(reading, crop?.crop_name)}
              </p>
            </section>
          </>
        )}

        {activeTab === "history" && (
          <>
            <h3 className="text-sm font-bold mb-3">최근 측정 추이</h3>
            {chartData.length > 1 ? (
              <>
                <MiniChart data={chartData} dataKey="temp" name="온도(°C)" color="#F08080" />
                <MiniChart data={chartData} dataKey="hum" name="습도(%)" color="#4A90E2" />
                <MiniChart data={chartData} dataKey="soil" name="토양수분(%)" color="#4ECAA0" />

                <h3 className="text-sm font-bold mb-2 mt-4">측정 이력</h3>
                <div className="text-xs">
                  <div className="grid grid-cols-4 gap-2 px-2 py-2 font-bold text-txt2 border-b border-brd">
                    <div>시각</div>
                    <div className="text-center">온도</div>
                    <div className="text-center">습도</div>
                    <div className="text-center">토양</div>
                  </div>
                  {[...logs].reverse().map((l, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 px-2 py-1.5 border-b border-brd/50">
                      <div className="text-txt2">
                        {new Date(l.measured_at).toLocaleString("ko-KR", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="text-center">{l.temp ?? "-"}</div>
                      <div className="text-center">{l.hum ?? "-"}</div>
                      <div className="text-center">{l.soil ?? "-"}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-txt3 text-sm">
                데이터가 부족해요. 잠시 후 다시 확인해주세요!
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ━━━ 센서 카드 ━━━
function SensorCard({
  label, icon, value, unit, color,
}: { label: string; icon: string; value: number | null | undefined; unit: string; color: string }) {
  return (
    <div className="p-3 rounded-2xl bg-bg-card border border-brd text-center">
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-xl font-extrabold" style={{ color }}>
        {value != null ? value : "--"}
      </div>
      <div className="text-[10px] text-txt2">{unit}</div>
      <div className="text-[10px] text-txt3 mt-0.5">{label}</div>
    </div>
  );
}

// ━━━ 제어 버튼 ━━━
function ControlButton({
  label, icon, on, onClick, disabled,
}: { label: string; icon: string; on: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-3 rounded-2xl border-2 transition disabled:opacity-50 flex items-center gap-2 ${
        on ? "bg-g1 border-g1 text-white" : "bg-bg-card border-brd text-txt2"
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <div className="flex-1 text-left">
        <div className="text-xs font-bold">{label}</div>
        <div className="text-[10px] opacity-80">{on ? "ON" : "OFF"}</div>
      </div>
    </button>
  );
}

// ━━━ 미니 차트 ━━━
function MiniChart({
  data, dataKey, name, color,
}: { data: { time: string; [k: string]: string | number | null }[]; dataKey: string; name: string; color: string }) {
  return (
    <div className="mb-4 p-3 rounded-2xl bg-bg-card border border-brd">
      <h4 className="text-xs font-bold mb-2">{name}</h4>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={30} />
          <Tooltip />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}