// ━━━ 작물별 생육 최적범위 + 환경 평가 ━━━
// AI 진단(②)과 작물 가이드라인(③)에서 공용으로 사용.

export interface OptimalRange {
  label: string;
  emoji: string;
  temp: [number, number]; // 적정 온도 (°C)
  hum: [number, number];  // 적정 습도 (%)
  soil: [number, number]; // 적정 토양수분 (%)
  tip: string;            // 한 줄 재배 팁
}

// 대표 작물 최적범위 (원예 일반 기준)
export const CROP_GUIDE: Record<string, OptimalRange> = {
  "딸기":   { label: "딸기",   emoji: "🍓", temp: [18, 24], hum: [60, 75], soil: [40, 70], tip: "서늘하고 통풍 잘되는 환경을 좋아해요. 과습에 약하니 물은 흙이 마르면 주세요." },
  "토마토": { label: "토마토", emoji: "🍅", temp: [20, 28], hum: [60, 80], soil: [50, 75], tip: "햇빛을 많이 받게 하고, 물은 규칙적으로 주되 잎에는 닿지 않게 하세요." },
  "상추":   { label: "상추",   emoji: "🥬", temp: [15, 22], hum: [60, 80], soil: [50, 75], tip: "서늘한 환경에서 잘 자라요. 흙이 마르지 않게 자주 살짝 주세요." },
  "고추":   { label: "고추",   emoji: "🌶️", temp: [22, 30], hum: [55, 75], soil: [45, 70], tip: "따뜻하고 햇빛 많은 곳을 좋아해요. 과습보다 약간 건조하게 관리하세요." },
  "오이":   { label: "오이",   emoji: "🥒", temp: [22, 28], hum: [70, 85], soil: [55, 80], tip: "물을 많이 좋아해요. 습도와 토양수분을 넉넉히 유지하세요." },
  "바질":   { label: "바질",   emoji: "🌿", temp: [20, 28], hum: [50, 70], soil: [45, 70], tip: "따뜻하고 햇빛 좋은 곳. 흙 표면이 마르면 물을 주세요." },
};

export const DEFAULT_GUIDE: OptimalRange = {
  label: "작물", emoji: "🌱", temp: [18, 26], hum: [55, 80], soil: [40, 70],
  tip: "온도·습도·토양수분을 적정 범위로 유지하고, 과습과 건조를 피하세요.",
};

// 작물 이름으로 가이드 찾기 (부분일치)
export function getGuide(cropName?: string | null): OptimalRange {
  if (!cropName) return DEFAULT_GUIDE;
  for (const key of Object.keys(CROP_GUIDE)) {
    if (cropName.includes(key)) return CROP_GUIDE[key];
  }
  return DEFAULT_GUIDE;
}

export type Level = "ok" | "warn" | "bad";

export interface EnvItem {
  kind: "온도" | "습도" | "토양수분";
  icon: string;
  level: Level;
  value: number;
  text: string;
}

export interface EnvAssessment {
  status: Level;        // 전체 상태 (가장 나쁜 항목 기준)
  items: EnvItem[];
  hasSensors: boolean;
}

interface Sensors {
  temp: number | null;
  hum: number | null;
  soil: number | null;
}

function worse(a: Level, b: Level): Level {
  const rank = { ok: 0, warn: 1, bad: 2 };
  return rank[a] >= rank[b] ? a : b;
}

// 센서값을 작물 최적범위와 비교해 평가
export function assessEnvironment(s: Sensors, cropName?: string | null): EnvAssessment {
  const g = getGuide(cropName);
  const items: EnvItem[] = [];
  let status: Level = "ok";

  // ── 온도 ──
  if (s.temp != null) {
    const [lo, hi] = g.temp;
    let level: Level = "ok";
    let text = `적정 범위(${lo}~${hi}°C) 안이에요 ✅`;
    if (s.temp > hi + 5)      { level = "bad";  text = `고온(${s.temp}°C) — 환기·차광이 필요해요. 고온이 지속되면 꽃·잎이 상해요.`; }
    else if (s.temp > hi)     { level = "warn"; text = `약간 높아요(${s.temp}°C, 적정 ${lo}~${hi}). 통풍을 늘려주세요.`; }
    else if (s.temp < lo - 5) { level = "bad";  text = `저온(${s.temp}°C) — 보온이 필요해요. 생육이 느려지고 냉해 위험이 있어요.`; }
    else if (s.temp < lo)     { level = "warn"; text = `약간 낮아요(${s.temp}°C, 적정 ${lo}~${hi}).`; }
    items.push({ kind: "온도", icon: "🌡️", level, value: s.temp, text });
    status = worse(status, level);
  }

  // ── 습도 ──
  if (s.hum != null) {
    const [lo, hi] = g.hum;
    let level: Level = "ok";
    let text = `적정 범위(${lo}~${hi}%) 안이에요 ✅`;
    if (s.hum > hi + 10)      { level = "bad";  text = `다습(${s.hum}%) — 잿빛곰팡이 등 곰팡이병 위험. 환기·팬으로 습기를 낮추세요.`; }
    else if (s.hum > hi)      { level = "warn"; text = `약간 습해요(${s.hum}%). 통풍에 신경 써주세요.`; }
    else if (s.hum < lo - 10) { level = "bad";  text = `건조(${s.hum}%) — 잎끝 마름·생육 저하 위험. 가습이 필요해요.`; }
    else if (s.hum < lo)      { level = "warn"; text = `약간 건조해요(${s.hum}%).`; }
    items.push({ kind: "습도", icon: "💧", level, value: s.hum, text });
    status = worse(status, level);
  }

  // ── 토양수분 (과습/물부족 = 잎 흑변·시들음과 직결) ──
  if (s.soil != null) {
    const [lo, hi] = g.soil;
    let level: Level = "ok";
    let text = `적정 범위(${lo}~${hi}%) 안이에요 ✅`;
    if (s.soil > hi + 15)      { level = "bad";  text = `토양 과습(${s.soil}%) — 과습이 오래되면 잎이 검게 변하거나 뿌리가 썩을 수 있어요. 급수를 멈추고 통풍하세요.`; }
    else if (s.soil > hi)      { level = "warn"; text = `약간 과습(${s.soil}%, 적정 ${lo}~${hi}). 다음 급수를 미뤄주세요.`; }
    else if (s.soil < lo - 15) { level = "bad";  text = `토양 매우 건조(${s.soil}%) — 물부족으로 잎이 시들거나 잎끝이 마를 수 있어요. 즉시 급수하세요.`; }
    else if (s.soil < lo)      { level = "warn"; text = `약간 건조(${s.soil}%, 적정 ${lo}~${hi}). 곧 물을 주세요.`; }
    items.push({ kind: "토양수분", icon: "🌱", level, value: s.soil, text });
    status = worse(status, level);
  }

  return { status, items, hasSensors: items.length > 0 };
}
