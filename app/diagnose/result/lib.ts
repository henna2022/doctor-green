import { CROP_NAMES } from "@/lib/cropCatalog";

// 병명 접두어 제거용 — "기타"는 실제 작물명이 아니라 제외
export const CROP_PREFIX_PATTERN = new RegExp(`^(${CROP_NAMES.filter((n) => n !== "기타").join("|")})\\s*`);

// 진단 신뢰도 임계값 — 이 미만이면 판독 불가 처리
export const CONFIDENCE_THRESHOLD = 0.75;

// HF Space 워밍 폴링 설정 — 3초 간격, 최대 10회
export const PING_INTERVAL_MS = 3000;
export const PING_MAX_ATTEMPTS = 10;

// 진단 단계 상태
export type Stage = "analyzing" | "done" | "not_detected" | "low_confidence" | "error";

// 분석 진행 세부 단계 — "모델 깨우는 중" → "분석 중"
export type AnalyzingPhase = "waking" | "analyzing";

export interface Detection {
  name: string;
  name_en: string;
  confidence: number;
  box: { x1: number; y1: number; x2: number; y2: number };
}

export interface DiagnosisResult {
  detected: true;
  disease_name: string;
  disease_name_en: string;
  confidence: number;
  severity: "경미" | "보통" | "심각";
  count: number;
  image_width: number;
  image_height: number;
  detections: Detection[];
  all: Array<{ name: string; confidence: number }>;
}

// AI 종합 소견 (LLM verdict) — /api/diagnose/verdict 응답
export interface Verdict {
  verdict: "healthy" | "disease" | "overwatered" | "underwatered" | "env_stress" | "uncertain";
  headline: string;
  reasons: string[];
  actions: string[];
  confidence: "high" | "medium" | "low";
}

// NCPMS 외부 모바일 도감 URL
export function ncpmsExternalUrl(sickKey: string): string {
  return `https://ncpms.rda.go.kr/mobile/MobileSicknsDtlR.ms?dtlKey=${sickKey}&totalSearchYn=Y`;
}

// "딸기 흰가루병(잎)" → keyword="흰가루병" (cropName은 선택된 작물 기준으로 별도 전달)
export function normalizeForSearch(diseaseName: string, fallbackCropName: string): { keyword: string; cropName: string } {
  let keyword = diseaseName;
  keyword = keyword.replace(CROP_PREFIX_PATTERN, "");
  keyword = keyword.replace(/\([^)]+\)/g, "").trim();
  const cropName = fallbackCropName && fallbackCropName !== "미지정" ? fallbackCropName : "기타";
  return { keyword, cropName };
}
