import { supabase } from "./supabase";
import { assessEnvironment, EnvAssessment } from "./cropGuide";

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

// 오늘(자정 이후) 쌓인 센서값으로 하루 리포트 생성
export async function getDailyReport(
  deviceId: string,
  cropName?: string | null
): Promise<DailyReport> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

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

  const avg = { temp: t.avg, hum: h.avg, soil: s.avg };
  const env = assessEnvironment(avg, cropName);

  let verdict: DailyReport["verdict"];
  if (rows.length === 0) {
    verdict = { tone: "warn", text: "오늘 아직 센서 데이터가 없어요. 보드가 켜져 있는지 확인해주세요." };
  } else if (env.status === "ok") {
    verdict = { tone: "ok", text: "오늘은 특별한 일 없이 잘 자라고 있어요 ✅" };
  } else if (env.status === "warn") {
    verdict = { tone: "warn", text: "대체로 양호하지만, 살짝 신경 쓸 부분이 있어요." };
  } else {
    verdict = { tone: "bad", text: "오늘은 주의가 필요해요 — 아래 항목을 확인하세요." };
  }

  return {
    hasData: rows.length > 0,
    count: rows.length,
    avg,
    range: {
      temp: t.min != null ? [t.min, t.max!] : null,
      hum: h.min != null ? [h.min, h.max!] : null,
      soil: s.min != null ? [s.min, s.max!] : null,
    },
    env,
    verdict,
  };
}
