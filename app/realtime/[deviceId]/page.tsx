"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { assessEnvironment } from "@/lib/cropGuide";
import { inferWatering } from "@/lib/watering";
import { TempIcon, HumidityIcon, SoilIcon, BulbIcon, FanIcon, WarningIcon, RobotIcon, CheckIcon, PlugIcon, RecordIcon, FlaskIcon } from "@/components/Icons";
import { useDeviceLive } from "./useDeviceLive";
import { useUsbCamera } from "./useUsbCamera";
import { CameraSection } from "./CameraSection";
import { HistoryTab } from "./HistoryTab";
import { SensorCard, ControlButton } from "./parts";

export default function DeviceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params.deviceId as string;

  const [activeTab, setActiveTab] = useState<"live" | "history">("live");
  // 이력 탭에서 보는 날짜 (기본: 오늘 0시) — HistoryTab이 조건부 마운트되어도 유지되도록 부모에서 관리
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const { device, crop, reading, loading, busy, polledAt, toggle } = useDeviceLive(deviceId);

  // 실시간 탭엔 상시 비전결과가 없으므로 센서-only 조기경보가 기본.
  // 이 기기에서 최근(30분 내) 스냅샷 진단한 병징이 있으면 결합한다.
  // (로딩 중엔 reading이 null이라 수분 블록 자체가 안 그려져 하이드레이션 불일치 없음)
  const [recentDx] = useState<{ disease: string; confidence: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem("diagnose_last");
      if (!raw) return null;
      const d = JSON.parse(raw) as { deviceId?: string; diseaseName?: string; confidence?: number; at?: number };
      if (d.deviceId === deviceId && typeof d.diseaseName === "string" && typeof d.at === "number" && Date.now() - d.at < 30 * 60 * 1000) {
        return { disease: d.diseaseName, confidence: typeof d.confidence === "number" ? d.confidence : 0 };
      }
    } catch {
      /* sessionStorage 접근 실패는 무시 (센서-only로 동작) */
    }
    return null;
  });
  const {
    cameraDevices,
    selectedCameraId,
    setSelectedCameraId,
    cameraStream,
    cameraError,
    videoRef,
  } = useUsbCamera(device);

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
      sessionStorage.setItem("diagnose_device_id", deviceId);
      // 현재 센서값도 함께 넘겨서 종합 건강 평가에 활용
      if (reading) {
        sessionStorage.setItem(
          "diagnose_sensors",
          JSON.stringify({ temp: reading.temp, hum: reading.hum, soil: reading.soil, stale: reading.stale })
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

  // 💧 수분 상태 판정 (과습/물부족) — 센서 조기경보 + (있으면) 최근 스냅샷 병징 결합
  const watering =
    reading && reading.ok && !reading.stale
      ? inferWatering({
          leafSymptom: recentDx?.disease ?? null,
          confidence: recentDx?.confidence ?? 0,
          soil: reading.soil,
          temp: reading.temp,
          hum: reading.hum,
          stale: reading.stale,
          crop: crop?.crop_name ?? null,
        })
      : null;
  const waterPalette = (l: "ok" | "warn" | "bad") =>
    l === "bad"
      ? { bg: "#FFEAEA", color: "#E05757" }
      : l === "warn"
      ? { bg: "#FFF4E5", color: "#D98A00" }
      : { bg: "#E8F8F0", color: "#2E9E76" };

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
            <CameraSection
              device={device}
              cameraDevices={cameraDevices}
              selectedCameraId={selectedCameraId}
              setSelectedCameraId={setSelectedCameraId}
              cameraStream={cameraStream}
              cameraError={cameraError}
              videoRef={videoRef}
              onSnapshot={handleSnapshot}
            />

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
                  onClick={() => toggle("led")}
                  disabled={busy || !reading?.ok}
                />
                <ControlButton
                  label="FAN"
                  icon={<FanIcon className="w-7 h-7" />}
                  on={reading?.fanOn || false}
                  onClick={() => toggle("fan")}
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

              {/* 💧 수분 상태 판정 (과습/물부족 조기경보) */}
              {watering && (() => {
                const wc = waterPalette(watering.status);
                return (
                  <div className="mt-3 pt-3 border-t border-g3/60">
                    <p className="text-sm font-bold flex items-center gap-1.5">
                      💧 수분 상태
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: wc.color, color: "#fff" }}>
                        {watering.cause}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-bg-soft text-txt2">
                        확신 {watering.certainty}
                      </span>
                    </p>
                    {watering.visionPart && (
                      <p className="text-[11px] text-txt2 mt-1.5 flex items-start gap-1.5">
                        <RobotIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {watering.visionPart}
                      </p>
                    )}
                    {watering.sensorPart && (
                      <p className="text-[11px] text-txt2 mt-1 flex items-start gap-1.5">
                        <SoilIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {watering.sensorPart}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed mt-1.5" style={{ color: wc.color }}>{watering.reason}</p>
                    <p className="text-[11px] text-txt2 leading-relaxed mt-1">👉 {watering.advice}</p>
                  </div>
                );
              })()}
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
          <HistoryTab deviceId={deviceId} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
        )}
      </main>
    </div>
  );
}
