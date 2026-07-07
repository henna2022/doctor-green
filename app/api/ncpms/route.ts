import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { fetchUpstream } from "@/lib/upstream";

const NCPMS_KEY = process.env.NCPMS_KEY;

interface NcpmsItem {
  sickNameKor?: string;
  insectNameKor?: string;
  name?: string;
  occrrncLvlCode?: string;
  level?: string;
  occrrncPeriod?: string;
  period?: string;
}

// 단일 작물에 대한 NCPMS 예찰 정보 조회
async function fetchForecastForCrop(
  crop: string,
  ncpmsKey: string,
  parser: XMLParser
): Promise<Array<{ crop: string; name: string; level: string; period: string }>> {
  const url =
    `http://ncpms.rda.go.kr/npmsAPI/service` +
    `?apiKey=${encodeURIComponent(ncpmsKey)}` +
    `&serviceCode=SVC05&serviceType=AA001` +
    `&cropName=${encodeURIComponent(crop)}&displayCount=5`;

  const res = await fetchUpstream(url, { next: { revalidate: 3600 } }); // 1시간 캐시
  const xmlText = await res.text();
  const parsed = parser.parse(xmlText);

  const items = parsed?.service?.list?.item;
  const itemArr: NcpmsItem[] = Array.isArray(items) ? items : items ? [items] : [];

  return itemArr.map((it) => ({
    crop,
    name: it.sickNameKor || it.insectNameKor || it.name || "",
    level: it.occrrncLvlCode || it.level || "예보",
    period: it.occrrncPeriod || it.period || "",
  }));
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const cropsParam = searchParams.get("crops") || "";
  const crops = cropsParam.split(",").filter(Boolean);

  if (!crops.length) {
    return NextResponse.json([]);
  }
  if (!NCPMS_KEY) {
    return NextResponse.json({ error: "NCPMS_KEY 환경변수가 설정되지 않았습니다" }, { status: 500 });
  }

  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

  try {
    // 작물별로 병렬 호출 (하나가 실패해도 나머지는 살리기 위해 allSettled 사용)
    const settled = await Promise.allSettled(
      crops.map((crop) => fetchForecastForCrop(crop, NCPMS_KEY!, parser))
    );

    // 전부 실패한 경우에만 업스트림 실패로 처리, 일부 성공이면 성공분만 반환
    const allFailed = settled.every((r) => r.status === "rejected");
    if (allFailed) {
      throw new Error("모든 작물 조회 실패");
    }

    const results = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    return NextResponse.json(results);
  } catch (e) {
    console.error("NCPMS error:", e);
    return NextResponse.json({ error: "NCPMS fetch failed" }, { status: 502 });
  }
}