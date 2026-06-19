"use client";

// ━━━ STEP 3 — IoT 센서 연결 (완전 가상 ESP32) ━━━
//   전원 ON → 온습도 슬라이더로 값 조절 → 측정값 전송(단발/자동/입김)
//   → sensor_readings 테이블에 INSERT → 실시간 차트 → 실시간 분석 기능 ON
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  useRoom,
  useRoomState,
  insertSensor,
  activateStation,
  deactivateStation,
} from "@/lib/sim";
import {
  ControlShell,
  ConceptCard,
  StatusPill,
  StepTitle,
  FlowDiagram,
  SupabasePanel,
  DoneBanner,
  fmtTime,
} from "../shared";

export default function SensorStationPage() {
  const [room] = useRoom();
  const state = useRoomState(room);
  const active = state.stations.sensor.active;
  const deviceId = `esp32-${room.padStart(2, "0")}`;

  const [power, setPower] = useState(active);
  const [temp, setTemp] = useState(24);
  const [hum, setHum] = useState(60);
  const [auto, setAuto] = useState(false);
  const [ping, setPing] = useState(0);

  // 측정값 전송 (현재 슬라이더 값 기준)
  const send = useCallback(
    (breath = false) => {
      const t = +(temp + (Math.random() * 1.2 - 0.6)).toFixed(1);
      let h = hum + (Math.random() * 3 - 1.5) + (breath ? 22 : 0);
      h = +Math.max(0, Math.min(100, h)).toFixed(1);
      insertSensor(room, { device_id: deviceId, temp: t, hum: h });
      setPing((p) => p + 1);
    },
    [temp, hum, room, deviceId]
  );

  // 자동 측정이 항상 최신 send 를 쓰도록 ref 갱신 (effect 안에서만 접근)
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const powerOn = (on: boolean) => {
    setPower(on);
    if (on) activateStation(room, "sensor", { device_id: deviceId });
    else setAuto(false);
  };

  // 자동 측정 (1.5초마다)
  useEffect(() => {
    if (!auto || !power) return;
    const id = setInterval(() => sendRef.current(false), 1500);
    return () => clearInterval(id);
  }, [auto, power]);

  const rows = state.sensor_readings;
  const chart = rows.slice(-30).map((r) => ({
    time: fmtTime(r.created_at),
    온도: r.temp,
    습도: r.hum,
  }));
  const last = rows[rows.length - 1];

  return (
    <ControlShell title="STEP 3 · IoT 센서" room={room}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-txt2">온습도 센서 실시간 전송하기</p>
        <StatusPill active={active} />
      </div>

      <ConceptCard emoji="📡" title="센서 값은 어떻게 앱까지 올까요?">
        센서가 잰 값을 작은 컴퓨터 <b>ESP32</b>가 인터넷으로 <b>Supabase(데이터베이스)</b>에
        보내고, 앱은 그 데이터를 <b>실시간</b>으로 받아 그래프로 그려요.
      </ConceptCard>

      {/* 가상 ESP32 보드 */}
      <StepTitle n={1}>센서 보드 전원 켜기</StepTitle>
      <div
        className={`rounded-2xl p-4 mb-4 border-2 transition ${
          power ? "border-g3 bg-g5" : "border-brd bg-bg-card"
        }`}
        style={power ? { animation: "simPulse 2s ease-in-out infinite" } : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{power ? "🟢" : "⚫"}</span>
            <div>
              <p className="text-sm font-extrabold">ESP32 보드</p>
              <p className="text-[11px] font-mono text-txt3">device_id: {deviceId}</p>
            </div>
          </div>
          <button
            onClick={() => powerOn(!power)}
            className={`px-4 py-2 rounded-xl text-sm font-extrabold transition ${
              power ? "bg-bg-card border border-brd text-txt2" : "bg-g1 text-white"
            }`}
          >
            {power ? "전원 끄기" : "전원 켜기"}
          </button>
        </div>
      </div>

      {power && (
        <>
          {/* 센서 값 슬라이더 */}
          <StepTitle n={2}>센서가 재는 값 (직접 조절)</StepTitle>
          <div className="bg-bg-card border border-brd rounded-2xl p-4 mb-3 space-y-4">
            <div>
              <div className="flex justify-between text-[13px] font-bold mb-1">
                <span>🌡 온도</span>
                <span className="text-orange">{temp}°C</span>
              </div>
              <input
                type="range" min={0} max={40} step={0.5} value={temp}
                onChange={(e) => setTemp(+e.target.value)}
                className="w-full accent-orange"
              />
            </div>
            <div>
              <div className="flex justify-between text-[13px] font-bold mb-1">
                <span>💧 습도</span>
                <span className="text-blue">{hum}%</span>
              </div>
              <input
                type="range" min={0} max={100} step={1} value={hum}
                onChange={(e) => setHum(+e.target.value)}
                className="w-full accent-blue"
              />
            </div>
          </div>

          {/* 전송 흐름 애니메이션 */}
          <FlowDiagram from={`🌡 센서 → ESP32`} pingKey={ping} />

          {/* 전송 버튼들 */}
          <StepTitle n={3}>측정값 전송하기</StepTitle>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => send(false)}
              className="flex-1 bg-g1 text-white font-extrabold text-sm py-3 rounded-2xl active:scale-[0.98] transition"
            >
              📤 측정값 1회 전송
            </button>
            <button
              onClick={() => setAuto((a) => !a)}
              className={`flex-1 font-extrabold text-sm py-3 rounded-2xl active:scale-[0.98] transition ${
                auto ? "bg-red text-white" : "bg-g3 text-g1"
              }`}
            >
              {auto ? "⏸ 자동측정 정지" : "▶ 자동측정 시작"}
            </button>
          </div>
          <button
            onClick={() => send(true)}
            className="w-full bg-bg-card border-2 border-brd text-txt2 font-bold text-sm py-2.5 rounded-2xl mb-5"
          >
            🫧 센서에 입김 불기 (습도 ↑)
          </button>

          {/* 실시간 최신값 */}
          {last && (
            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-[#FFF3E6] rounded-2xl p-3 text-center">
                <p className="text-[11px] text-txt3">실시간 온도</p>
                <p className="text-2xl font-extrabold text-orange">{last.temp}°C</p>
              </div>
              <div className="flex-1 bg-[#E9F2FC] rounded-2xl p-3 text-center">
                <p className="text-[11px] text-txt3">실시간 습도</p>
                <p className="text-2xl font-extrabold text-blue">{last.hum}%</p>
              </div>
            </div>
          )}

          {/* 실시간 차트 */}
          {chart.length > 0 && (
            <div className="bg-bg-card border border-brd rounded-2xl p-3 mb-5">
              <p className="text-[11px] font-bold text-txt2 mb-1">실시간 측정 추이</p>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveEnd" />
                  <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="온도" stroke="#FFA500" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="습도" stroke="#4A90E2" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* 가상 Supabase */}
      <p className="text-xs font-bold text-txt2 mb-2">측정값이 이렇게 전송·저장돼요 👇</p>
      <SupabasePanel
        table="sensor_readings"
        columns={[
          { key: "id", label: "id" },
          { key: "device_id", label: "device_id" },
          { key: "temp", label: "temp" },
          { key: "hum", label: "hum" },
          { key: "created_at", label: "created_at" },
        ]}
        rows={rows}
        emptyHint="전원을 켜고 '측정값 전송'을 누르면 행이 쌓여요."
        format={(k, v) => (k === "created_at" ? fmtTime(v) : String(v ?? "—"))}
      />

      {active && (
        <>
          <DoneBanner href="/control/app" cta="📱 내 앱에서 확인하기">
            실시간 분석 기능이 켜졌어요! ({rows.length}개 측정값 전송됨)
          </DoneBanner>
          <button
            onClick={() => {
              deactivateStation(room, "sensor");
              setPower(false);
              setAuto(false);
            }}
            className="mt-3 w-full text-[12px] font-bold text-txt3 border border-brd rounded-xl py-2.5"
          >
            연결 해제
          </button>
        </>
      )}
    </ControlShell>
  );
}
