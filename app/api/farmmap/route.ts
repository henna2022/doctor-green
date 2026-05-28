import { NextRequest, NextResponse } from "next/server";

const FARMMAP_KEY = "kUANNT3g+CJFAWSYRbk4I7jHAsUbOCiEPs+WdCmP8W+hP+vzeoApnfklBkp4LgJTFyFaP9tpVhtN6aaTtYL58g==";

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

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get("lat") || "");
  const lon = parseFloat(searchParams.get("lon") || "");
  const radius = parseInt(searchParams.get("radius") || "10");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json([]);
  }
  if (!FARMMAP_KEY) {
    return NextResponse.json([]);
  }

  try {
    const url =
      `https://apis.data.go.kr/1390802/FarmMapPestService/getPestOccurByCoord` +
      `?serviceKey=${encodeURIComponent(FARMMAP_KEY)}` +
      `&lat=${lat}&lon=${lon}&radius=${radius}` +
      `&pageNo=1&numOfRows=20&type=json`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
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
    return NextResponse.json([]);
  }
}