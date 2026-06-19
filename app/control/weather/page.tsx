"use client";

// ━━━ STEP 1 — 공공데이터 날씨 연결 (완전 가상) ━━━
//   ① 인증키 발급(가상)  ② 코드에 키 자동 끼우기  ③ 날씨 데이터 받아오기
//   → weather_cache 테이블에 INSERT → 홈 날씨 기능 ON
import { useState } from "react";
import {
  useRoom,
  useRoomState,
  insertWeather,
  activateStation,
  deactivateStation,
} from "@/lib/sim";
import {
  ControlShell,
  ConceptCard,
  StatusPill,
  StepTitle,
  CodeView,
  SupabasePanel,
  DoneBanner,
  fmtTime,
} from "../shared";

const REGIONS = [
  { name: "서울", base: 26, skies: ["맑음", "구름"] },
  { name: "대전", base: 28, skies: ["맑음", "구름", "비"] },
  { name: "광주", base: 29, skies: ["구름", "비"] },
  { name: "부산", base: 25, skies: ["맑음", "구름"] },
  { name: "제주", base: 27, skies: ["비", "구름"] },
];

const SKY_EMOJI: Record<string, string> = { 맑음: "☀️", 구름: "⛅", 비: "🌧️" };

// 가짜 인증키 생성 (data.go.kr 인코딩 키 느낌)
function genKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s + "%3D%3D";
}

type Phase = "idle" | "issuing" | "keyed" | "fetching";

export default function WeatherStationPage() {
  const [room] = useRoom();
  const state = useRoomState(room);
  const active = state.stations.weather.active;

  const [region, setRegion] = useState(REGIONS[0]);
  const [phase, setPhase] = useState<Phase>(active ? "keyed" : "idle");
  const [apiKey, setApiKey] = useState<string | null>(null);

  const issueKey = () => {
    setPhase("issuing");
    setTimeout(() => {
      setApiKey(genKey());
      setPhase("keyed");
    }, 900);
  };

  const fetchWeather = () => {
    setPhase("fetching");
    setTimeout(() => {
      const sky = region.skies[Math.floor(Math.random() * region.skies.length)];
      const temp = +(region.base + (Math.random() * 4 - 2)).toFixed(1);
      insertWeather(room, { region: region.name, temp, sky });
      activateStation(room, "weather", { region: region.name, temp, sky });
      setPhase("keyed");
    }, 1100);
  };

  const keyMasked = apiKey ? apiKey.slice(0, 8) + "…" + apiKey.slice(-4) : null;
  const latest = state.weather_cache[state.weather_cache.length - 1];

  return (
    <ControlShell title="STEP 1 · 공공데이터 날씨" room={room}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-txt2">기상청 공공 API 연결하기</p>
        <StatusPill active={active} />
      </div>

      <ConceptCard emoji="🏛️" title="공공데이터가 뭐예요?">
        날씨·미세먼지 같은 정보는 <b>정부가 무료로 공개</b>해요(data.go.kr). 단, 누가 쓰는지
        확인하려고 <b>인증키(출입증)</b>가 필요해요. 우리 앱은 이 키로 기상청에 날씨를
        물어봅니다.
      </ConceptCard>

      {/* ① 인증키 발급 */}
      <StepTitle n={1}>인증키 발급받기 (가상)</StepTitle>
      <p className="text-[13px] text-txt2 mb-3">
        실제 수업에선 data.go.kr에서 받지만, 여기선 버튼 한 번으로 발급돼요.
      </p>
      {phase === "idle" ? (
        <button
          onClick={issueKey}
          className="w-full bg-g1 text-white font-extrabold text-sm py-3 rounded-2xl active:scale-[0.99] transition mb-5"
        >
          🔑 인증키 발급받기
        </button>
      ) : phase === "issuing" ? (
        <div className="w-full bg-bg-card border border-brd text-txt3 font-bold text-sm py-3 rounded-2xl text-center mb-5">
          발급 중…
        </div>
      ) : (
        <div className="bg-g5 border border-g4 rounded-2xl p-3.5 mb-5 flex items-center gap-2">
          <span>✅</span>
          <div className="min-w-0">
            <p className="text-[11px] text-txt3">발급된 인증키</p>
            <p className="text-[12px] font-mono font-bold text-g1 truncate">{keyMasked}</p>
          </div>
        </div>
      )}

      {/* ② 코드에 키 자동 끼우기 */}
      <StepTitle n={2}>이 키가 실제 코드에 들어가요</StepTitle>
      <p className="text-[13px] text-txt2 mb-3">
        직접 타이핑하지 않아도 돼요. 발급되면 <b>serviceKey 자리</b>에 자동으로 채워집니다.
      </p>
      <CodeView
        parts={[
          "// app/api/kma/route.ts (실제 앱 코드)\n",
          "const url =\n  `...getVilageFcst?serviceKey=",
          { slot: "인증키", value: phase === "idle" || phase === "issuing" ? null : keyMasked },
          "`\n  + `&nx=${nx}&ny=${ny}`;\n",
          "const res = await fetch(url); // 기상청에 날씨 요청",
        ]}
      />

      {/* ③ 지역 선택 + 데이터 받아오기 */}
      <StepTitle n={3}>날씨 데이터 받아오기</StepTitle>
      <p className="text-[13px] text-txt2 mb-2">우리 동네를 고르고 호출해 보세요.</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {REGIONS.map((r) => (
          <button
            key={r.name}
            onClick={() => setRegion(r)}
            disabled={phase === "issuing" || phase === "fetching"}
            className={`px-3 py-1.5 rounded-xl text-[13px] font-bold transition ${
              region.name === r.name
                ? "bg-g1 text-white"
                : "bg-bg-card border border-brd text-txt2"
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>
      <button
        onClick={fetchWeather}
        disabled={phase === "idle" || phase === "issuing" || phase === "fetching"}
        className="w-full bg-g3 text-g1 font-extrabold text-sm py-3 rounded-2xl active:scale-[0.99] transition mb-5 disabled:opacity-40"
      >
        {phase === "fetching"
          ? "기상청에서 받아오는 중…"
          : phase === "idle"
          ? "먼저 인증키를 발급받아 주세요"
          : "🌤 날씨 데이터 받아오기"}
      </button>

      {/* 최신 결과 미리보기 */}
      {latest && (
        <div className="flex items-center gap-3 bg-bg-card border border-brd rounded-2xl p-4 mb-5">
          <span className="text-3xl">{SKY_EMOJI[latest.sky] ?? "🌡"}</span>
          <div>
            <p className="text-sm font-extrabold">
              {latest.region} {latest.temp}°C · {latest.sky}
            </p>
            <p className="text-[11px] text-txt3">방금 기상청에서 받아온 값</p>
          </div>
        </div>
      )}

      {/* 가상 Supabase */}
      <p className="text-xs font-bold text-txt2 mb-2">데이터가 이렇게 저장돼요 👇</p>
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
        emptyHint="아직 호출 전이에요. ③에서 '날씨 데이터 받아오기'를 눌러보세요."
        format={(k, v) => (k === "created_at" ? fmtTime(v) : String(v ?? "—"))}
      />

      {active && (
        <>
          <DoneBanner href="/control/app" cta="📱 내 앱에서 확인하기">
            홈 화면의 날씨 기능이 켜졌어요!
          </DoneBanner>
          <button
            onClick={() => deactivateStation(room, "weather")}
            className="mt-3 w-full text-[12px] font-bold text-txt3 border border-brd rounded-xl py-2.5"
          >
            연결 해제
          </button>
        </>
      )}
    </ControlShell>
  );
}
