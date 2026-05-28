import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

const NCPMS_KEY = "20261d909608d30f1d1a8ba465793731eddd";

interface NcpmsItem {
  sickNameKor?: string;
  insectNameKor?: string;
  name?: string;
  occrrncLvlCode?: string;
  level?: string;
  occrrncPeriod?: string;
  period?: string;
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const cropsParam = searchParams.get("crops") || "";
  const crops = cropsParam.split(",").filter(Boolean);

  if (!crops.length) {
    return NextResponse.json([]);
  }
  if (!NCPMS_KEY) {
    return NextResponse.json([]);
  }

  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
  const results: Array<{ crop: string; name: string; level: string; period: string }> = [];

  try {
    for (const crop of crops) {
      const url =
        `http://ncpms.rda.go.kr/npmsAPI/service` +
        `?apiKey=${encodeURIComponent(NCPMS_KEY)}` +
        `&serviceCode=SVC05&serviceType=AA001` +
        `&cropName=${encodeURIComponent(crop)}&displayCount=5`;

      const res = await fetch(url, { next: { revalidate: 3600 } }); // 1시간 캐시
      const xmlText = await res.text();
      const parsed = parser.parse(xmlText);

      const items = parsed?.service?.list?.item;
      const itemArr: NcpmsItem[] = Array.isArray(items) ? items : items ? [items] : [];

      itemArr.forEach((it) => {
        results.push({
          crop,
          name: it.sickNameKor || it.insectNameKor || it.name || "",
          level: it.occrrncLvlCode || it.level || "예보",
          period: it.occrrncPeriod || it.period || "",
        });
      });
    }
    return NextResponse.json(results);
  } catch (e) {
    console.error("NCPMS error:", e);
    return NextResponse.json([]);
  }
}