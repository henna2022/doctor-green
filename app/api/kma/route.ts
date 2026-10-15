import { NextRequest, NextResponse } from "next/server";
import { fetchUpstream } from "@/lib/upstream";
import { latLonToKmaGrid, getKmaBaseTime, parseKma } from "@/lib/kma";

const KMA_KEY = process.env.KMA_KEY;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get("lat") || "");
  const lon = parseFloat(searchParams.get("lon") || "");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "lat, lon required" }, { status: 400 });
  }
  if (!KMA_KEY) {
    return NextResponse.json(
      { error: "KMA_KEY 환경변수가 설정되지 않았습니다 (.env.local 확인)" },
      { status: 500 }
    );
  }

  const grid = latLonToKmaGrid(lat, lon);
  const t = getKmaBaseTime();

  const url =
    "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst" +
    `?serviceKey=${encodeURIComponent(KMA_KEY)}` +
    `&pageNo=1&numOfRows=1000&dataType=JSON` +
    `&base_date=${t.base_date}&base_time=${t.base_time}` +
    `&nx=${grid.nx}&ny=${grid.ny}`;

  try {
    const res = await fetchUpstream(url, { next: { revalidate: 600 } }); // 10분 캐시
    const data = await res.json();
    const parsed = parseKma(data);
    if (!parsed) {
      return NextResponse.json({ error: "KMA parse failed" }, { status: 502 });
    }
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("KMA error:", e);
    return NextResponse.json({ error: "KMA fetch failed" }, { status: 502 });
  }
}
