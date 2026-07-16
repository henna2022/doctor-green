// ━━━ 비전 병징 + 실시간 센서(토양수분)로 과습/물부족을 추론 ━━━
// cropGuide의 CROP_GUIDE 적정범위와 진단 CONFIDENCE_THRESHOLD를 "재사용"한다.
// (임계값·범위를 여기서 다시 하드코딩하지 않는다 — 단일 소스 유지)

import { getGuide, type Level } from "./cropGuide";
import { CONFIDENCE_THRESHOLD } from "@/app/diagnose/result/lib";

// 최종 원인 분류 (색상/뱃지에 그대로 노출)
export type WateringCause =
  | "정상"
  | "과습"
  | "물부족"
  | "병해"
  | "영양·기타의심"
  | "판단보류";

// 판정 확신도
export type Certainty = "높음" | "보통" | "낮음";

export interface WateringInput {
  leafSymptom: string | null; // 비전 결과 원문(예: disease_name). 없으면 null = 미탐지
  confidence: number;         // 비전 신뢰도 0~1 (미탐지면 0)
  soil: number | null;
  temp: number | null;
  hum: number | null;
  stale: boolean;             // 센서가 오래된(무응답) 값이면 true
  crop: string | null;
}

export interface WateringInference {
  cause: WateringCause;
  certainty: Certainty;
  status: Level; // "ok" | "warn" | "bad" — cropGuide 색상 컨벤션 재사용
  reason: string; // 근거 한 문장(한국어)
  advice: string; // 조치 한 문장(한국어)
  visionPart: string | null; // "잎에서 '황화' 감지 (신뢰도 82%)" — 비전 없으면 null
  sensorPart: string | null; // "토양수분 88% — 적정(40~70%)보다 높음" — 센서 없으면 null
}

// 잎 증상 카테고리 (모델이 작물명 접두어를 붙일 수 있어 includes 매칭)
type LeafCategory = "황화" | "잎끝마름" | "역병" | "시들음병" | "정상" | "기타";
type SoilBand = "매우높음" | "높음" | "적정" | "낮음" | "매우낮음" | "센서없음";

// 비전 원문 → 카테고리 정규화
export function categorizeLeafSymptom(raw: string | null | undefined): LeafCategory {
  if (!raw || raw.trim() === "") return "정상"; // 미탐지 = 증상 없음으로 취급
  if (raw.includes("황화")) return "황화";
  if (raw.includes("잎끝마름") || raw.includes("잎끝")) return "잎끝마름";
  if (raw.includes("역병")) return "역병";
  if (raw.includes("시들음")) return "시들음병";
  if (raw.includes("정상")) return "정상";
  return "기타";
}

// 토양수분을 작물 적정범위(soil [lo,hi]) 기준으로 구간화
function classifySoil(soil: number | null, stale: boolean, [lo, hi]: [number, number]): SoilBand {
  if (soil == null || stale) return "센서없음";
  if (soil >= hi + 15) return "매우높음";
  if (soil > hi) return "높음";
  if (soil >= lo) return "적정"; // lo ~ hi
  if (soil <= lo - 15) return "매우낮음";
  return "낮음"; // lo-15 < soil < lo
}

export function inferWatering(input: WateringInput): WateringInference {
  const { leafSymptom, confidence, soil, temp, hum, stale, crop } = input;
  const guide = getGuide(crop);
  const [slo, shi] = guide.soil;

  const cat = categorizeLeafSymptom(leafSymptom);
  const hasVision = leafSymptom != null && leafSymptom.trim() !== "";
  const band = classifySoil(soil, stale, guide.soil);
  const confident = confidence >= CONFIDENCE_THRESHOLD;
  const pct = Math.round((confidence || 0) * 100);

  const wet = band === "높음" || band === "매우높음";
  const dry = band === "낮음" || band === "매우낮음";
  const noSensor = band === "센서없음";

  // ── visionPart ──
  let visionPart: string | null = null;
  if (hasVision) {
    if (cat === "정상") {
      visionPart = "잎에서 뚜렷한 병징이 보이지 않아요 (정상)";
    } else if (cat === "기타") {
      visionPart = `잎에서 '${leafSymptom!.trim()}' 감지 (신뢰도 ${pct}%)`;
    } else {
      visionPart = `잎에서 '${cat}' 감지 (신뢰도 ${pct}%)`;
    }
  }

  // ── sensorPart ──
  let sensorPart: string | null = null;
  if (!noSensor && soil != null) {
    const rel = wet
      ? `적정(${slo}~${shi}%)보다 높음`
      : dry
      ? `적정(${slo}~${shi}%)보다 낮음`
      : `적정 범위(${slo}~${shi}%)`;
    sensorPart = `토양수분 ${soil}% — ${rel}`;
  }

  let cause: WateringCause;
  let status: Level;
  let certainty: Certainty;
  let reason: string;
  let advice: string;

  // 2) 병해 우선 — 역병/시들음병이 확신도 이상으로 감지되면 방제가 먼저
  if ((cat === "역병" || cat === "시들음병") && confident) {
    cause = "병해";
    status = "bad";
    certainty = "높음";
    reason = `잎에서 '${cat}'이(가) 감지됐어요 — 수분 조절보다 병해 방제가 먼저예요.`;
    advice = "도감의 방제법을 우선 적용하고 감염 부위를 정리하세요.";
    if (wet) {
      reason += " 게다가 흙이 과습해 병을 더 악화시킬 수 있어요.";
      advice += " 급수를 멈추고 통풍을 늘리세요.";
    }
  }
  // 3) 매트릭스 — 황화
  else if (cat === "황화") {
    if (wet) {
      cause = "과습";
      status = band === "매우높음" ? "bad" : "warn";
      certainty = confident ? "높음" : "낮음";
      reason = "노란 잎(황화)에 흙까지 젖어 있어 뿌리가 숨쉬기 어려운 과습으로 보여요.";
      advice = "급수를 멈추고 흙 표면이 마를 때까지 기다리며 통풍하세요.";
    } else if (band === "적정") {
      cause = "영양·기타의심";
      status = "warn";
      certainty = confident ? "보통" : "낮음";
      reason = "잎은 노랗지만(황화) 토양수분은 적정 범위예요 — 과습보다 영양(질소 등) 부족 등 다른 원인일 수 있어요.";
      advice = "수분은 유지하고 비료 상태와 햇빛을 점검하세요.";
    } else if (dry) {
      cause = "판단보류";
      status = "warn";
      certainty = "낮음";
      reason = "잎은 노란데(황화) 흙은 마른 상태라 신호가 서로 엇갈려요 — 원인을 단정하기 어려워요.";
      advice = "가벼운 관수 후 며칠 관찰하며 잎 변화를 확인하세요.";
    } else {
      // 센서없음
      cause = "판단보류";
      status = "warn";
      certainty = "낮음";
      reason = "잎에서 황화가 보이지만 토양수분 센서가 없어 과습·영양 중 원인을 가리기 어려워요.";
      advice = "토양수분을 측정해 흙 상태를 함께 확인하세요.";
    }
  }
  // 매트릭스 — 잎끝마름
  else if (cat === "잎끝마름") {
    if (dry) {
      cause = "물부족";
      status = band === "매우낮음" ? "bad" : "warn";
      certainty = confident ? "높음" : "낮음";
      reason = "잎끝이 마르고(잎끝마름) 흙도 말라 있어 물부족으로 보여요.";
      advice = "지금 관수하고, 흙이 자주 마르면 급수 주기를 줄이세요.";
    } else if (band === "적정") {
      cause = "영양·기타의심";
      status = "warn";
      certainty = confident ? "보통" : "낮음";
      reason = "잎끝은 말랐지만(잎끝마름) 토양수분은 적정이에요 — 물부족보다 염류 축적 등이 원인일 수 있어요(EC 센서가 없어 정확한 확인은 어려움).";
      advice = "관수량을 조절하고 비료 농도를 낮춰보세요.";
    } else if (wet) {
      cause = "판단보류";
      status = "warn";
      certainty = "낮음";
      reason = "잎끝은 말랐는데 흙은 젖어 있어 신호가 엇갈려요 — 과습에 의한 뿌리 손상이나 염류 문제일 수 있어요.";
      advice = "급수를 잠시 멈추고 통풍하며 잎 상태를 관찰하세요.";
    } else {
      // 센서없음
      cause = "판단보류";
      status = "warn";
      certainty = "낮음";
      reason = "잎끝마름이 보이지만 토양수분 센서가 없어 물부족·염류 중 원인을 가리기 어려워요.";
      advice = "토양수분을 측정해 흙이 말랐는지 먼저 확인하세요.";
    }
  }
  // 매트릭스 — 정상잎 (비전이 '병징 없음'을 확인한 경우)
  else if (cat === "정상" && hasVision) {
    if (wet) {
      cause = "과습";
      status = band === "매우높음" ? "bad" : "warn";
      certainty = "보통";
      reason = "잎엔 아직 증상이 없지만 흙이 과습 상태예요 — 지금 관리하면 과습 피해를 예방할 수 있어요(조기경보).";
      advice = "급수를 미루고 통풍을 늘리세요.";
    } else if (dry) {
      cause = "물부족";
      status = band === "매우낮음" ? "bad" : "warn";
      certainty = "보통";
      reason = "잎은 아직 괜찮지만 흙이 말라가고 있어요 — 미리 관수하면 물부족을 예방할 수 있어요(조기경보).";
      advice = "곧 관수해 흙이 완전히 마르지 않게 하세요.";
    } else if (band === "적정") {
      cause = "정상";
      status = "ok";
      certainty = confident ? "높음" : "보통";
      reason = "잎도 깨끗하고 토양수분도 적정 범위예요 — 지금처럼 관리하면 좋아요.";
      advice = "현재 관수 습관을 그대로 유지하세요.";
    } else {
      // 센서없음
      cause = "정상";
      status = "ok";
      certainty = "낮음";
      reason = "잎에는 병징이 없어요. 다만 토양수분 센서가 없어 수분 상태는 판단을 보류해요.";
      advice = "흙 표면을 만져 마름 정도를 확인해보세요.";
    }
  }
  // 기타/미탐지 → 센서 기준 조기경보 (잎 신호가 없거나 매핑 불가)
  else {
    if (wet) {
      cause = "과습";
      status = band === "매우높음" ? "bad" : "warn";
      certainty = "보통";
      reason = "토양이 과습 상태예요 — 흙 기준으로 과습 위험이 있어요(조기경보).";
      advice = "급수를 미루고 통풍을 늘리세요.";
    } else if (dry) {
      cause = "물부족";
      status = band === "매우낮음" ? "bad" : "warn";
      certainty = "보통";
      reason = "토양이 말라 있어요 — 흙 기준으로 물부족 위험이 있어요(조기경보).";
      advice = "곧 관수하세요.";
    } else if (band === "적정") {
      cause = "정상";
      status = "ok";
      certainty = "보통";
      reason = "토양수분이 적정 범위예요 — 흙 기준으로 수분 상태는 양호해요.";
      advice = "현재 관수 습관을 유지하세요.";
    } else {
      // 센서없음
      cause = "판단보류";
      status = "warn";
      certainty = "낮음";
      reason = hasVision
        ? "잎 병징이 감지됐지만 토양수분 센서가 없어 수분 상태(과습/물부족)는 판단을 보류해요."
        : "비전 결과도 토양수분 센서값도 없어 수분 상태를 판단할 수 없어요.";
      advice = "카메라 진단 또는 토양수분 센서를 연결하면 과습/물부족까지 함께 판정할 수 있어요.";
    }
  }

  // 5) 온·습도 보정 (advice에 덧붙임) — 임계는 CROP_GUIDE 적정 상한 사용
  if (cause === "과습" && hum != null && hum > guide.hum[1]) {
    advice += ` 습도도 높은 편(${hum}%)이니 팬으로 환기하세요.`;
  }
  if (cause === "물부족" && temp != null && temp > guide.temp[1]) {
    advice += ` 기온이 높아(${temp}°C) 증발이 빨라요 — 관수 주기를 짧게 하세요.`;
  }

  return { cause, status, certainty, reason, advice, visionPart, sensorPart };
}
