import { NextRequest, NextResponse } from "next/server";
import { fetchUpstream } from "@/lib/upstream";

const FARMMAP_KEY = process.env.FARMMAP_KEY;

interface FarmmapItem {
  cropName?: string;
  crop?: string;
  pestName?: string;
  disease?: string;
  distance?: string;
  occrrncLvl?: string;
  level?: string;
  reportDate?: string;
}

function mapSeverity(lv?: string): "low" | "mid" | "high" {
  if (!lv) return "mid";
  const s = String(lv);
  if (s.includes("경보") || s === "HIGH" || s === "3") return "high";
  if (s.includes("주의") || s === "MID" || s === "2") return "mid";
  return "low";
}

// radius(km) 허용 범위 — 너무 작거나 비정상적으로 크면 업스트림 오류/과다 응답 유발
const MIN_RADIUS = 1;
const MAX_RADIUS = 50;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get("lat") || "");
  const lon = parseFloat(searchParams.get("lon") || "");
  const radiusRaw = parseInt(searchParams.get("radius") || "10");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "lat, lon required" }, { status: 400 });
  }
  const radius = isNaN(radiusRaw)
    ? 10
    : Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, radiusRaw));

  if (!FARMMAP_KEY) {
    return NextResponse.json({ error: "FARMMAP_KEY 환경변수가 설정되지 않았습니다" }, { status: 500 });
  }

  try {
    const url =
      `https://apis.data.go.kr/1390802/FarmMapPestService/getPestOccurByCoord` +
      `?serviceKey=${encodeURIComponent(FARMMAP_KEY)}` +
      `&lat=${lat}&lon=${lon}&radius=${radius}` +
      `&pageNo=1&numOfRows=20&type=json`;
    const res = await fetchUpstream(url, { next: { revalidate: 3600 } });
    const data = await res.json();

    const items = data?.response?.body?.items?.item || [];
    const itemArr: FarmmapItem[] = Array.isArray(items) ? items : [items];
    const results = itemArr
      .map((it) => ({
        crop: it.cropName || it.crop,
        disease: it.pestName || it.disease,
        distance_km: parseFloat(it.distance || "0"),
        severity: mapSeverity(it.occrrncLvl || it.level),
        reportedAt: it.reportDate,
      }))
      .filter((x) => x.crop && x.disease);

    return NextResponse.json(results);
  } catch (e) {
    console.error("Farmmap error:", e);
    return NextResponse.json({ error: "Farmmap fetch failed" }, { status: 502 });
  }
}