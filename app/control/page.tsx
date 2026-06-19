"use client";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 가상 실습실 허브 (/control)
//   ▸ 방 번호 1~15 선택 (학생별 격리)
//   ▸ 3개 스테이션(날씨·YOLO·센서)을 직접 연결해 앱을 완성
//   ▸ 모든 데이터는 브라우저 안의 "가상 Supabase"에만 저장 (네트워크 0)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import {
  ROOMS,
  Station,
  useRoom,
  useRoomState,
  resetRoom,
  completedCount,
} from "@/lib/sim";
import { SupabasePanel, fmtTime } from "./shared";

const STATIONS: {
  key: Station;
  href: string;
  n: number;
  emoji: string;
  title: string;
  desc: string;
  table: string;
}[] = [
  {
    key: "weather",
    href: "/control/weather",
    n: 1,
    emoji: "🌤",
    title: "공공데이터 날씨 연결",
    desc: "기상청 공공 API로 우리 동네 날씨를 받아와요",
    table: "weather_cache",
  },
  {
    key: "yolo",
    href: "/control/yolo",
    n: 2,
    emoji: "🔍",
    title: "AI 비전(YOLO) 학습",
    desc: "작물 사진으로 병해충 찾는 AI를 학습시켜요",
    table: "diagnoses",
  },
  {
    key: "sensor",
    href: "/control/sensor",
    n: 3,
    emoji: "🌡",
    title: "IoT 센서 연결",
    desc: "온습도 센서 값을 실시간으로 전송해요",
    table: "sensor_readings",
  },
];

export default function ControlHubPage() {
  const [room, setRoom] = useRoom();
  const state = useRoomState(room);
  const [showDB, setShowDB] = useState(false);

  const done = completedCount(state);
  const counts: Record<string, number> = {
    weather_cache: state.weather_cache.length,
    diagnoses: state.diagnoses.length,
    sensor_readings: state.sensor_readings.length,
  };

  return (
    <div className="phone-frame overflow-y-auto pb-12">
      <PageHeader title="스마트팜 가상 실습실" backHref="/home" />

      <main className="px-5 py-5">
        {/* 방 번호 선택 */}
        <section className="mb-5">
          <p className="text-xs font-bold text-txt2 mb-2">내 방 번호를 골라주세요</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {ROOMS.map((r) => (
              <button
                key={r}
                onClick={() => setRoom(r)}
                className={`shrink-0 w-9 h-9 rounded-xl text-sm font-bold transition ${
                  r === room
                    ? "bg-g1 text-white"
                    : "bg-bg-card border border-brd text-txt2"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </section>

        {/* 인트로 + 진행도 */}
        <section className="bg-g5 border border-g4 rounded-2xl p-4 mb-5">
          <p className="text-[13px] text-txt2 leading-relaxed mb-3">
            아래 3단계를 직접 연결해서 <b className="text-g1">나만의 스마트팜 앱</b>을 완성해요.
            모두 가상 환경이라 마음껏 눌러봐도 안전해요.
          </p>
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-g1">내 앱 완성도</span>
            <span className="text-txt2">{done} / 3</span>
          </div>
          <div className="h-2.5 rounded-full bg-white overflow-hidden">
            <div
              className="h-full bg-g3 transition-all duration-500"
              style={{ width: `${(done / 3) * 100}%` }}
            />
          </div>
        </section>

        {/* 스테이션 카드 */}
        <section className="space-y-3 mb-6">
          {STATIONS.map((s) => {
            const on = state.stations[s.key].active;
            return (
              <Link
                key={s.key}
                href={s.href}
                className="flex items-center gap-3.5 bg-bg-card border border-brd rounded-2xl p-4 active:scale-[0.99] transition hover:border-g3"
              >
                <span className="text-2xl shrink-0">{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold text-g1">STEP {s.n}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        on ? "bg-g3 text-g1" : "bg-[#F2F2EE] text-txt3"
                      }`}
                    >
                      {on ? "연결됨" : "미연결"}
                    </span>
                  </div>
                  <h2 className="text-[15px] font-extrabold mt-0.5">{s.title}</h2>
                  <p className="text-[12px] text-txt3 mt-0.5 leading-snug">{s.desc}</p>
                </div>
                <span className="text-txt3 text-lg shrink-0">›</span>
              </Link>
            );
          })}
        </section>

        {/* 내 앱 미리보기 CTA */}
        <Link
          href="/control/app"
          className="flex items-center justify-center gap-2 w-full bg-g1 text-white font-extrabold text-sm py-3.5 rounded-2xl active:scale-[0.99] transition mb-6"
        >
          📱 내 스마트팜 앱 미리보기
        </Link>

        {/* 가상 데이터베이스 요약 */}
        <section className="mb-6">
          <button
            onClick={() => setShowDB((v) => !v)}
            className="flex items-center justify-between w-full bg-bg-card border border-brd rounded-2xl p-4"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🗄</span>
              <div className="text-left">
                <p className="text-sm font-extrabold">가상 데이터베이스</p>
                <p className="text-[11px] text-txt3">
                  날씨 {counts.weather_cache} · 진단 {counts.diagnoses} · 센서{" "}
                  {counts.sensor_readings} 행
                </p>
              </div>
            </div>
            <span className="text-txt3 text-sm">{showDB ? "접기 ▲" : "전체 보기 ▼"}</span>
          </button>

          {showDB && (
            <div className="space-y-3 mt-3" style={{ animation: "fadeIn 0.3s" }}>
              <SupabasePanel
                table="weather_cache"
                columns={[
                  { key: "id", label: "id" },
                  { key: "region", label: "region" },
                  { key: "temp", label: "temp" },
                  { key: "sky", label: "sky" },
                  { key: "created_at", label: "created_at" },
                ]}
                rows={state.weather_cache}
                format={(k, v) => (k === "created_at" ? fmtTime(v) : String(v ?? "—"))}
              />
              <SupabasePanel
                table="diagnoses"
                columns={[
                  { key: "id", label: "id" },
                  { key: "crop", label: "crop" },
                  { key: "label", label: "label" },
                  { key: "confidence", label: "conf" },
                  { key: "created_at", label: "created_at" },
                ]}
                rows={state.diagnoses}
                format={(k, v) =>
                  k === "created_at"
                    ? fmtTime(v)
                    : k === "confidence"
                    ? `${v}%`
                    : String(v ?? "—")
                }
              />
              <SupabasePanel
                table="sensor_readings"
                columns={[
                  { key: "id", label: "id" },
                  { key: "device_id", label: "device_id" },
                  { key: "temp", label: "temp" },
                  { key: "hum", label: "hum" },
                  { key: "created_at", label: "created_at" },
                ]}
                rows={state.sensor_readings}
                format={(k, v) => (k === "created_at" ? fmtTime(v) : String(v ?? "—"))}
              />
            </div>
          )}
        </section>

        {/* 방 초기화 */}
        <button
          onClick={() => {
            if (confirm(`${room}번 방의 가상 데이터를 모두 지울까요?`)) resetRoom(room);
          }}
          className="w-full text-[12px] font-bold text-txt3 border border-brd rounded-xl py-2.5"
        >
          ↺ 이 방 초기화 (처음부터 다시)
        </button>
      </main>
    </div>
  );
}
