"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import {
  getDevice,
  readSensors,
  writeActuator,
  getDayHistory,
  Device,
  SensorReading,
  SensorLog,
} from "@/lib/sensors";
import { getCropById, MyCrop } from "@/lib/crops";
import { assessEnvironment } from "@/lib/cropGuide";
import { TempIcon, HumidityIcon, SoilIcon, BulbIcon, FanIcon, CameraIcon, WarningIcon, RobotIcon, CheckIcon, PlugIcon, RecordIcon, FlaskIcon, ChartIcon } from "@/components/Icons";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const POLL_INTERVAL = 5000;

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
  // 이력 탭에서 보는 날짜 (기본: 오늘 0시)
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // ━━━ USB 카메라 ━━━
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);

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

  // ━━━ USB 카메라: 디바이스 목록 가져오기 ━━━
  useEffect(() => {
    if (!device || device.camera_type !== "usb") return;

    async function loadCameras() {
      try {
        // 권한 먼저 요청 (이거 없으면 라벨이 안 보임)
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach((t) => t.stop()); // 일단 끄고 디바이스만 받기

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const cameras = allDevices.filter((d) => d.kind === "videoinput");
        setCameraDevices(cameras);

        if (cameras.length > 0 && !selectedCameraId) {
          setSelectedCameraId(cameras[0].deviceId);
        }
      } catch (e) {
        console.error("Camera enumerate error:", e);
        setCameraError("카메라 권한이 거부되었거나 카메라가 연결되지 않았어요.");
      }
    }
    loadCameras();
  }, [device, selectedCameraId]);

  // ━━━ USB 카메라: 선택된 카메라 스트림 시작 ━━━
  useEffect(() => {
    if (!device || device.camera_type !== "usb" || !selectedCameraId) return;

    let stream: MediaStream | null = null;

    async function startStream() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: selectedCameraId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        setCameraStream(stream);
        setCameraError("");
      } catch (e) {
        console.error("Camera start error:", e);
        setCameraError("카메라를 시작할 수 없어요. 다른 카메라를 선택해보세요.");
      }
    }
    startStream();

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraId, device]);

  // ━━━ 비디오 엘리먼트에 스트림 연결 ━━━
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // 이력 탭이 열려있을 때, 선택한 날짜의 0~24시 추이 로드
  useEffect(() => {
    if (activeTab !== "history") return;
    let stale = false;
    Promise.resolve().then(() => {
      if (!stale) setLogs([]);
    });
    getDayHistory(deviceId, selectedDay).then((data) => {
      if (!stale) setLogs(data);
    });
    return () => {
      stale = true;
    };
  }, [activeTab, deviceId, selectedDay]);

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

  // 📸 스냅샷 → 진단 페이지
  const handleSnapshot = () => {
    try {
      const canvas = document.createElement("canvas");
      let dataUrl: string;

      if (device?.camera_type === "usb" && videoRef.current && cameraStream) {
        // USB 웹캠: <video>에서 캡처
        const video = videoRef.current;
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas error");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      } else if (device?.camera_type === "mjpeg" && device.camera_url) {
        // MJPEG: <img>에서 캡처
        const img = document.getElementById("camera-img") as HTMLImageElement | null;
        if (!img) {
          alert("카메라를 찾을 수 없어요!");
          return;
        }
        canvas.width = img.naturalWidth || 640;
        canvas.height = img.naturalHeight || 480;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas error");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      } else {
        alert("카메라가 연결되어 있지 않아요!");
        return;
      }

      sessionStorage.setItem("diagnose_image", dataUrl);
      sessionStorage.setItem("diagnose_crop", crop?.crop_name || "미지정");
      sessionStorage.setItem("diagnose_crop_id", crop?.id || "");
      // 현재 센서값도 함께 넘겨서 종합 건강 평가에 활용
      if (reading) {
        sessionStorage.setItem(
          "diagnose_sensors",
          JSON.stringify({ temp: reading.temp, hum: reading.hum, soil: reading.soil })
        );
      } else {
        sessionStorage.removeItem("diagnose_sensors");
      }
      router.push("/diagnose/result");
    } catch (e) {
      console.error(e);
      alert("스냅샷 실패: 카메라 상태를 확인해주세요.");
    }
  };

  const minutesAgo = (iso: string | null, nowMs: number): number | null => {
    if (!iso || !nowMs) return null;
    return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60000));
  };

  if (loading || !device) {
    return (
      <div className="phone-frame items-center justify-center">
        <div className="w-10 h-10 border-4 border-g5 border-t-g1 rounded-full animate-spin" />
      </div>
    );
  }

  const isDemo = device.blynk_token === "DEMO";

  // 홈 리포트(lib/report.ts)와 동일한 cropGuide.assessEnvironment로 판정 통일
  const env = reading && reading.ok ? assessEnvironment(reading, crop?.crop_name) : null;

  const chartData = logs.map((l) => ({
    time: new Date(l.measured_at).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    temp: l.temp,
    hum: l.hum,
    soil: l.soil,
  }));

  const hasCamera = device.camera_type === "usb" || (device.camera_type === "mjpeg" && device.camera_url);

  // ━━━ 이력 날짜 네비게이션 ━━━
  const ymd = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  };
  const todayYmd = ymd(new Date());
  const isToday = ymd(selectedDay) === todayYmd;
  const dayLabel = isToday
    ? "오늘"
    : selectedDay.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  const shiftDay = (delta: number) =>
    setSelectedDay((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      d.setHours(0, 0, 0, 0);
      return d;
    });

  return (
    <div className="phone-frame overflow-y-auto">
      <PageHeader
        backHref="/realtime"
        title={
          <span className="flex items-center gap-1.5">
            {device.name}
            {isDemo && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange/20 text-orange">
                체험용
              </span>
            )}
          </span>
        }
      />

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
        {isDemo ? (
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-orange/10 border border-orange/40 text-xs text-[#B87A2E] flex items-center gap-1.5">
            <FlaskIcon className="w-4 h-4 shrink-0" />
            <span>체험용 기기예요 — 실제 센서가 아닌 시뮬레이션 값입니다.</span>
          </div>
        ) : reading?.stale ? (
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red/10 border border-red text-xs text-red flex items-center gap-1.5">
            <WarningIcon className="w-4 h-4 shrink-0" />
            <span>센서 응답 없음 — 마지막 값 기준입니다.</span>
          </div>
        ) : null}

        {activeTab === "live" && (
          <>
            <section className="mb-5">
              {/* USB 카메라일 때: 카메라 선택 드롭다운 */}
              {device.camera_type === "usb" && cameraDevices.length > 1 && (
                <select
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  className="w-full mb-2 px-3 py-2 border-2 border-brd rounded-xl text-sm bg-bg-card outline-none"
                >
                  {cameraDevices.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label || `카메라 ${cam.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              )}

              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
                {/* USB 웹캠 */}
                {device.camera_type === "usb" && cameraStream && (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/60 text-white text-[10px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
                      LIVE (USB)
                    </div>
                  </>
                )}

                {device.camera_type === "usb" && cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 px-4 text-center">
                    <WarningIcon className="w-9 h-9 mb-2" />
                    <p className="text-xs">{cameraError}</p>
                  </div>
                )}

                {device.camera_type === "usb" && !cameraStream && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mb-2" />
                    <p className="text-xs">카메라 연결 중...</p>
                  </div>
                )}

                {/* MJPEG 네트워크 카메라 */}
                {device.camera_type === "mjpeg" && device.camera_url && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      id="camera-img"
                      src={device.camera_url}
                      alt="카메라"
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/60 text-white text-[10px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
                      LIVE
                    </div>
                  </>
                )}

                {/* 카메라 미사용 */}
                {device.camera_type === "none" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
                    <CameraIcon className="w-9 h-9 mb-2 opacity-70" />
                    <p className="text-xs">카메라 미연결</p>
                  </div>
                )}
              </div>

              {/* 📸 스냅샷 버튼 */}
              <button
                onClick={handleSnapshot}
                disabled={!hasCamera || (device.camera_type === "usb" && !cameraStream)}
                className="w-full mt-2 py-3 rounded-2xl bg-g1 text-white font-bold disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                <CameraIcon className="w-4 h-4" /> 스냅샷 → AI 진단
              </button>
            </section>

            <div className="flex items-center gap-1.5 mb-2 text-xs text-txt3">
              {reading?.stale && (
                <span className="px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500 font-bold text-[10px]">
                  오프라인
                </span>
              )}
              {reading?.recordedAt && <span>마지막 측정 {minutesAgo(reading.recordedAt, polledAt)}분 전</span>}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <SensorCard label="온도" icon={<TempIcon className="w-7 h-7" />} value={reading?.temp} unit="°C" color="#F08080" />
              <SensorCard label="습도" icon={<HumidityIcon className="w-7 h-7" />} value={reading?.hum} unit="%" color="#4A90E2" />
              <SensorCard label="토양수분" icon={<SoilIcon className="w-7 h-7" />} value={reading?.soil} unit="%" color="#4ECAA0" />
            </div>

            <section className="mb-5">
              <h3 className="text-sm font-bold mb-2">제어</h3>
              <div className="grid grid-cols-2 gap-2">
                <ControlButton
                  label="식물생장 LED"
                  icon={<BulbIcon className="w-7 h-7" />}
                  on={reading?.ledOn || false}
                  onClick={() => handleToggle("led")}
                  disabled={busy || !reading?.ok}
                />
                <ControlButton
                  label="FAN"
                  icon={<FanIcon className="w-7 h-7" />}
                  on={reading?.fanOn || false}
                  onClick={() => handleToggle("fan")}
                  disabled={busy || !reading?.ok}
                />
              </div>
            </section>

            <section className="mb-5 p-4 rounded-2xl bg-g5">
              <h3 className="text-sm font-bold text-g1 mb-2 flex items-center gap-1.5">
                <RobotIcon className="w-5 h-5" /> AI 작물 상태 평가
              </h3>
              {reading?.stale ? (
                <p className="text-sm text-txt2 leading-relaxed">
                  최근 측정 데이터가 없어 평가를 표시할 수 없어요. 보드 연결 상태를 확인해주세요.
                </p>
              ) : env ? (
                env.status === "ok" ? (
                  <p className="text-sm text-txt leading-relaxed flex items-center gap-1.5">
                    {crop?.crop_name || "작물"} 환경이 양호합니다 <CheckIcon className="w-4 h-4" />
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {env.items
                      .filter((it) => it.level !== "ok")
                      .map((it, i) => {
                        const ItemIcon = { "온도": TempIcon, "습도": HumidityIcon, "토양수분": SoilIcon }[it.kind];
                        return (
                          <p key={i} className="text-sm text-txt leading-relaxed flex items-center gap-1.5">
                            <ItemIcon className="w-4 h-4 shrink-0" /> {it.text}
                          </p>
                        );
                      })}
                  </div>
                )
              ) : (
                <p className="text-sm text-txt2 leading-relaxed">센서 데이터를 기다리는 중입니다.</p>
              )}
            </section>

            {/* 디바이스 ID — 보드(펌웨어)를 이 디바이스에 연결할 때 사용 */}
            <section className="mb-5">
              <p className="text-[11px] text-txt3 mb-1 flex items-center gap-1">
                <PlugIcon className="w-3.5 h-3.5" /> 디바이스 ID (보드 펌웨어 연결용)
              </p>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(device.id);
                  alert("디바이스 ID가 복사됐어요!\n펌웨어 config.h 의 DEVICE_ID 에 붙여넣으면 보드가 이 디바이스로 연결돼요.");
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl bg-bg-soft hover:bg-[#ECECE7] transition flex items-center justify-between gap-2"
              >
                <span className="text-[11px] font-mono text-txt2 break-all">{device.id}</span>
                <span className="text-xs text-g1 font-bold shrink-0 flex items-center gap-1">
                  <RecordIcon className="w-3.5 h-3.5" /> 복사
                </span>
              </button>
            </section>
          </>
        )}

        {activeTab === "history" && (
          <>
            {/* 날짜 선택 */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <button
                onClick={() => shiftDay(-1)}
                className="w-9 h-9 rounded-xl border border-brd text-lg text-txt2 shrink-0"
                aria-label="이전 날짜"
              >
                ‹
              </button>
              <input
                type="date"
                value={ymd(selectedDay)}
                max={todayYmd}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const d = new Date(e.target.value + "T00:00:00");
                  d.setHours(0, 0, 0, 0);
                  setSelectedDay(d);
                }}
                className="flex-1 text-center text-sm font-bold border border-brd rounded-xl py-1.5 bg-bg-card outline-none"
              />
              <button
                onClick={() => shiftDay(1)}
                disabled={isToday}
                className="w-9 h-9 rounded-xl border border-brd text-lg text-txt2 shrink-0 disabled:opacity-30"
                aria-label="다음 날짜"
              >
                ›
              </button>
            </div>

            <h3 className="text-sm font-bold mb-3">
              {dayLabel} 추이
              {isToday && <span className="text-xs text-txt3 font-normal"> (0시~현재)</span>}
            </h3>
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
              <div className="text-center py-10 rounded-2xl bg-bg-soft">
                <ChartIcon className="w-9 h-9 mx-auto mb-2 opacity-70" />
                <p className="text-sm text-txt2">
                  {logs.length === 0
                    ? "아직 수집된 데이터가 없어요"
                    : isToday
                    ? "아직 오늘 데이터가 부족해요"
                    : "이 날짜엔 측정 데이터가 없어요"}
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SensorCard({
  label, icon, value, unit, color,
}: { label: string; icon: React.ReactNode; value: number | null | undefined; unit: string; color: string }) {
  return (
    <div className="p-3 rounded-2xl bg-bg-soft text-center">
      <div className="mb-1 flex justify-center">{icon}</div>
      <div className="text-xl font-extrabold" style={{ color }}>
        {value != null ? value : "--"}
      </div>
      <div className="text-[10px] text-txt2">{unit}</div>
      <div className="text-[10px] text-txt3 mt-0.5">{label}</div>
    </div>
  );
}

function ControlButton({
  label, icon, on, onClick, disabled,
}: { label: string; icon: React.ReactNode; on: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-3 rounded-2xl border-2 transition disabled:opacity-50 flex items-center gap-2 ${
        on ? "bg-g1 border-g1 text-white" : "bg-bg-card border-brd text-txt2"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <div className="flex-1 text-left">
        <div className="text-xs font-bold">{label}</div>
        <div className="text-[10px] opacity-80">{on ? "ON" : "OFF"}</div>
      </div>
    </button>
  );
}

function MiniChart({
  data, dataKey, name, color,
}: { data: { time: string; [k: string]: string | number | null }[]; dataKey: string; name: string; color: string }) {
  return (
    <div className="mb-4 p-3 rounded-2xl bg-bg-soft">
      <h4 className="text-xs font-bold mb-2">{name}</h4>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={40} />
          <YAxis tick={{ fontSize: 10 }} width={30} />
          <Tooltip />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}