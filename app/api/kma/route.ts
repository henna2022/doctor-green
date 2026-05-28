import { NextRequest, NextResponse } from "next/server";

const KMA_KEY = "kUANNT3g+CJFAWSYRbk4I7jHAsUbOCiEPs+WdCmP8W+hP+vzeoApnfklBkp4LgJTFyFaP9tpVhtN6aaTtYL58g==";

// 위경도 → 기상청 격자 변환
function latLonToKmaGrid(lat: number, lon: number) {
  const RE = 6371.00877, GRID = 5.0;
  const SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0;
  const XO = 43, YO = 136, DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD, olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = re * sf / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = re * sf / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

// 기상청 base_date/base_time 계산
function getKmaBaseTime() {
  const now = new Date(Date.now() - 10 * 60 * 1000);
  const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23];
  const h = now.getHours();
  let baseHour = BASE_HOURS[0];
  for (let i = BASE_HOURS.length - 1; i >= 0; i--) {
    if (h >= BASE_HOURS[i]) { baseHour = BASE_HOURS[i]; break; }
  }
  const d = new Date(now);
  if (h < 2) { d.setDate(d.getDate() - 1); baseHour = 23; }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(baseHour).padStart(2, "0");
  return { base_date: `${yyyy}${mm}${dd}`, base_time: `${hh}00` };
}

interface KmaItem {
  fcstDate: string;
  fcstTime: string;
  category: string;
  fcstValue: string;
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get("lat") || "");
  const lon = parseFloat(searchParams.get("lon") || "");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "lat, lon required" }, { status: 400 });
  }
  if (!KMA_KEY) {
    return NextResponse.json({ error: "KMA_KEY not set" }, { status: 500 });
  }

  const grid = latLonToKmaGrid(lat, lon);
  const t = getKmaBaseTime();

  const url =
    "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst" +
    `?serviceKey=${encodeURIComponent(KMA_KEY)}` +
    `&pageNo=1&numOfRows=300&dataType=JSON` +
    `&base_date=${t.base_date}&base_time=${t.base_time}` +
    `&nx=${grid.nx}&ny=${grid.ny}`;

  try {
    const res = await fetch(url, { next: { revalidate: 600 } }); // 10분 캐시
    const data = await res.json();
    const parsed = parseKma(data);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("KMA error:", e);
    return NextResponse.json({ error: "KMA fetch failed" }, { status: 502 });
  }
}

function parseKma(raw: {
  response?: { header?: { resultCode?: string }; body?: { items?: { item?: KmaItem[] } } };
}) {
  if (!raw?.response || raw.response.header?.resultCode !== "00") return null;
  const items: KmaItem[] = raw.response?.body?.items?.item || [];
  if (!items.length) return null;

  let today: string | null = null;
  const cats: Record<string, number> = {};
  let dailyMax = -999, dailyMin = 999, maxPop = 0;
  let nowKey: string | null = null;

  items.forEach((it) => {
    const { fcstDate: fd, fcstTime: ft, category: cat, fcstValue: val } = it;
    if (!today) today = fd;
    if (fd !== today) return;
    if (cat === "TMP") {
      const tv = parseFloat(val);
      if (!nowKey) { nowKey = ft; cats.TMP = tv; }
      if (tv > dailyMax) dailyMax = tv;
      if (tv < dailyMin) dailyMin = tv;
    } else if (cat === "TMX") { const v = parseFloat(val); if (v > dailyMax) dailyMax = v; }
    else if (cat === "TMN") { const v = parseFloat(val); if (v < dailyMin) dailyMin = v; }
    else if (cat === "REH" && cats.REH === undefined) cats.REH = parseFloat(val);
    else if (cat === "SKY" && cats.SKY === undefined) cats.SKY = parseInt(val);
    else if (cat === "PTY" && cats.PTY === undefined) cats.PTY = parseInt(val);
    else if (cat === "WSD" && cats.WSD === undefined) cats.WSD = parseFloat(val);
    else if (cat === "POP") { const p = parseFloat(val); if (p > maxPop) maxPop = p; }
  });

  return {
    source: "KMA",
    temp: cats.TMP ?? null,
    hum: cats.REH ?? null,
    sky: cats.SKY ?? null,
    pty: cats.PTY ?? null,
    wind: cats.WSD ?? 0,
    tmax: dailyMax > -999 ? dailyMax : null,
    tmin: dailyMin < 999 ? dailyMin : null,
    pop: maxPop,
  };
}