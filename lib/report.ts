import { supabase } from "./supabase";
import { assessEnvironment, getGuide, EnvAssessment } from "./cropGuide";

export interface DailyReport {
  hasData: boolean;
  count: number;                 // 오늘 측정 횟수
  avg: { temp: number | null; hum: number | null; soil: number | null };
  range: {
    temp: [number, number] | null;
    hum: [number, number] | null;
    soil: [number, number] | null;
  };
  env: EnvAssessment;
  verdict: { tone: "ok" | "warn" | "bad"; text: string };
  warnings: string[];            // 평균은 양호해도 한때 위험 구간(극값)을 지났으면 표시
}

interface DailyReportRow {
  count: number | string;
  avg_temp: number | null;
  min_temp: number | null;
  max_temp: number | null;
  avg_hum: number | null;
  min_hum: number | null;
  max_hum: number | null;
  avg_soil: number | null;
  min_soil: number | null;
  max_soil: number | null;
}

function stats(vals: number[]): { avg: number | null; min: number | null; max: number | null } {
  if (vals.length === 0) return { avg: null, min: null, max: null };
  const sum = vals.reduce((a, b) => a + b, 0);
  return {
    avg: Math.round((sum / vals.length) * 10) / 10,
    min: Math.min(...vals),
    max: Math.max(...vals),
  };
}

// RPC(daily_report) 부재/에러 시 기존 클라이언트 집계로 폴백 (.limit(2000)이라 측정 주기가
// 매우 짧으면 하루치를 다 못 볼 수 있지만, RPC 미마이그레이션 상태에서 "데이터 없음" 오탐보다는 낫다)
async function fallbackDailyReportRow(
  deviceId: string,
  start: Date
): Promise<DailyReportRow> {
  const { data } = await supabase
    .from("sensor_readings")
    .select("temp, hum, soil")
    .eq("device_id", deviceId)
    .gte("recorded_at", start.toISOString())
    .order("recorded_at", { ascending: false })
    .limit(2000);

  const rows = data || [];
  const t = stats(rows.map((r) => r.temp).filter((v): v is number => v != null));
  const h = stats(rows.map((r) => r.hum).filter((v): v is number => v != null));
  const s = stats(rows.map((r) => r.soil).filter((v): v is number => v != null));

  return {
    count: rows.length,
    avg_temp: t.avg,
    min_temp: t.min,
    max_temp: t.max,
    avg_hum: h.avg,
    min_hum: h.min,
    max_hum: h.max,
    avg_soil: s.avg,
    min_soil: s.min,
    max_soil: s.max,
  };
}

// 순간 최저/최고가 assessEnvironment의 "위험(bad)" 기준을 넘었으면 경고 문구 생성
function extremeWarnings(range: DailyReport["range"], cropName?: string | null): string[] {
  const g = getGuide(cropName);
  const warnings: string[] = [];

  if (range.temp) {
    const [min, max] = range.temp;
    const [lo, hi] = g.temp;
    if (max > hi + 5) warnings.push(`🌡️ 한때 고온(${max}°C)이 있었어요`);
    if (min < lo - 5) warnings.push(`🥶 한때 저온(${min}°C)이 있었어요`);
  }
  if (range.hum) {
    const [min, max] = range.hum;
    const [lo, hi] = g.hum;
    if (max > hi + 10) warnings.push(`💧 한때 다습(${max}%)이 있었어요`);
    if (min < lo - 10) warnings.push(`🏜️ 한때 건조(${min}%)이 있었어요`);
  }
  if (range.soil) {
    const [min, max] = range.soil;
    const [lo, hi] = g.soil;
    if (max > hi + 15) warnings.push(`⚠️ 한때 토양 과습(${max}%)이 있었어요`);
    if (min < lo - 15) warnings.push(`🚰 한때 토양 건조(${min}%)이 있었어요`);
  }
  return warnings;
}

// 오늘(자정 이후) 쌓인 센서값으로 하루 리포트 생성 — daily_report RPC로 서버에서 집계
// (기존 클라이언트 집계는 .limit(2000)에 잘려 측정 주기가 짧으면 하루치를 다 못 봤음)
export async function getDailyReport(
  deviceId: string,
  cropName?: string | null
): Promise<DailyReport> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();

  const { data, error } = await supabase.rpc("daily_report", {
    p_device: deviceId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });

  // RPC 마이그레이션이 아직 배포 DB에 적용되지 않았거나 에러가 나면 기존 방식으로 폴백
  const row: DailyReportRow = !error && data?.[0] ? data[0] : await fallbackDailyReportRow(deviceId, start);
  const count = Number(row.count);

  const avg = { temp: row.avg_temp ?? null, hum: row.avg_hum ?? null, soil: row.avg_soil ?? null };
  const range: DailyReport["range"] = {
    temp: row.min_temp != null ? [row.min_temp, row.max_temp!] : null,
    hum: row.min_hum != null ? [row.min_hum, row.max_hum!] : null,
    soil: row.min_soil != null ? [row.min_soil, row.max_soil!] : null,
  };

  const env = assessEnvironment(avg, cropName);
  const warnings = count > 0 ? extremeWarnings(range, cropName) : [];

  let verdict: DailyReport["verdict"];
  if (count === 0) {
    verdict = { tone: "warn", text: "오늘 아직 센서 데이터가 없어요. 보드가 켜져 있는지 확인해주세요." };
  } else if (env.status === "bad") {
    verdict = { tone: "bad", text: "오늘은 주의가 필요해요 — 아래 항목을 확인하세요." };
  } else if (env.status === "warn" || warnings.length > 0) {
    verdict = {
      tone: "warn",
      text:
        env.status === "warn"
          ? "대체로 양호하지만, 살짝 신경 쓸 부분이 있어요."
          : "평균은 양호하지만, 한때 위험 구간을 지난 적이 있어요.",
    };
  } else {
    verdict = { tone: "ok", text: "오늘은 특별한 일 없이 잘 자라고 있어요 ✅" };
  }

  return {
    hasData: count > 0,
    count,
    avg,
    range,
    env,
    verdict,
    warnings,
  };
}
