"use client";

// ━━━ 내 스마트팜 앱 미리보기 (/control/app) ━━━
//   3개 스테이션 연결 상태에 따라 홈 날씨 / AI 진단 / 실시간 분석이 켜진다.
//   잠긴 기능은 어떤 STEP을 해야 켜지는지 안내한다.
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer,
} from "recharts";
import { useRoom, useRoomState, completedCount } from "@/lib/sim";
import { ControlShell, fmtTime } from "../shared";

const SKY_EMOJI: Record<string, string> = { 맑음: "☀️", 구름: "⛅", 비: "🌧️" };
const LABEL_COLOR: Record<string, string> = {
  "건강한 잎": "#4ECAA0",
  "병해 의심": "#F08080",
  "해충 흔적": "#FFA500",
};

function Locked({ step, href, label }: { step: string; href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 bg-[#F4F4F1] border border-dashed border-brd rounded-2xl p-4 text-txt3"
    >
      <span className="text-lg">🔒</span>
      <p className="text-[12px] leading-snug">
        <b className="text-txt2">{step}</b>을 먼저 연결하면 {label}이 켜져요 ›
      </p>
    </Link>
  );
}

export default function AppPreviewPage() {
  const [room] = useRoom();
  const state = useRoomState(room);
  const done = completedCount(state);

  const weather = state.weather_cache[state.weather_cache.length - 1];
  const diag = state.diagnoses[state.diagnoses.length - 1];
  const sensor = state.sensor_readings[state.sensor_readings.length - 1];
  const chart = state.sensor_readings.slice(-30).map((r) => ({
    time: fmtTime(r.created_at),
    온도: r.temp,
    습도: r.hum,
  }));

  return (
    <ControlShell title="내 스마트팜 앱" room={room}>
      {done === 3 && (
        <div
          className="rounded-2xl bg-g1 text-white p-4 mb-5 text-center"
          style={{ animation: "fadeIn 0.4s" }}
        >
          <p className="text-2xl mb-1">🎉</p>
          <p className="text-sm font-extrabold">내 스마트팜 앱 완성!</p>
          <p className="text-[12px] text-g4 mt-1">3개 기능을 모두 직접 연결했어요</p>
        </div>
      )}

      {done < 3 && (
        <p className="text-[13px] text-txt2 mb-5 leading-relaxed">
          연결한 기능만 살아나요. 지금 <b className="text-g1">{done}/3</b> 완성!
          남은 단계를 연결해 앱을 완성해 보세요.
        </p>
      )}

      {/* 폰 목업 */}
      <div className="rounded-[28px] border-4 border-[#1f2933] bg-bg-main overflow-hidden">
        <div className="bg-[#1f2933] text-white text-center text-[11px] py-1 font-bold">
          🌱 닥터 그린
        </div>
        <div className="p-3 space-y-3">
          {/* 홈 · 날씨 */}
          <div>
            <p className="text-[11px] font-bold text-txt3 mb-1.5 px-1">홈 · 오늘 날씨</p>
            {weather ? (
              <div className="flex items-center gap-3 bg-bg-card border border-brd rounded-2xl p-4">
                <span className="text-3xl">{SKY_EMOJI[weather.sky] ?? "🌡"}</span>
                <div>
                  <p className="text-base font-extrabold">
                    {weather.region} {weather.temp}°C
                  </p>
                  <p className="text-[12px] text-txt3">{weather.sky}</p>
                </div>
              </div>
            ) : (
              <Locked step="STEP 1" href="/control/weather" label="날씨" />
            )}
          </div>

          {/* AI 진단 */}
          <div>
            <p className="text-[11px] font-bold text-txt3 mb-1.5 px-1">AI 진단</p>
            {diag ? (
              <div className="bg-bg-card border border-brd rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[12px] font-extrabold px-2 py-0.5 rounded-full text-white"
                    style={{ background: LABEL_COLOR[diag.label] ?? "#999" }}
                  >
                    {diag.label}
                  </span>
                  <span className="text-sm font-extrabold text-g1">{diag.confidence}%</span>
                </div>
                <p className="text-[12px] text-txt2">
                  {diag.crop} · 최근 진단 {state.diagnoses.length}건
                </p>
              </div>
            ) : (
              <Locked step="STEP 2" href="/control/yolo" label="AI 진단" />
            )}
          </div>

          {/* 실시간 분석 */}
          <div>
            <p className="text-[11px] font-bold text-txt3 mb-1.5 px-1">실시간 분석</p>
            {sensor && chart.length > 0 ? (
              <div className="bg-bg-card border border-brd rounded-2xl p-3">
                <div className="flex gap-2 mb-2">
                  <span className="text-[12px] font-bold text-orange">🌡 {sensor.temp}°C</span>
                  <span className="text-[12px] font-bold text-blue">💧 {sensor.hum}%</span>
                </div>
                <ResponsiveContainer width="100%" height={90}>
                  <LineChart data={chart}>
                    <XAxis dataKey="time" hide />
                    <YAxis hide domain={[0, 100]} />
                    <Line type="monotone" dataKey="온도" stroke="#FFA500" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="습도" stroke="#4A90E2" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Locked step="STEP 3" href="/control/sensor" label="실시간 그래프" />
            )}
          </div>
        </div>
      </div>

      <Link
        href="/control"
        className="mt-6 block text-center w-full bg-bg-card border border-brd text-txt2 font-bold text-sm py-3 rounded-2xl"
      >
        ← 실습실로 돌아가기
      </Link>
    </ControlShell>
  );
}
