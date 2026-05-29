import { NextRequest, NextResponse } from "next/server";

const KMA_KEY = process.env.KMA_KEY;

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
    const res = await fetch(url, { next: { revalidate: 600 } }); // 10분 캐시
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

function parseKma(raw: {
  response?: { header?: { resultCode?: string }; body?: { items?: { item?: KmaItem[] } } };
}) {
  if (!raw?.response || raw.response.header?.resultCode !== "00") return null;
  const items: KmaItem[] = raw.response?.body?.items?.item || [];
  if (!items.length) return null;

  // 오늘 날짜만 추리기
  let today: string | null = null;
  for (const it of items) {
    if (!today) { today = it.fcstDate; break; }
  }
  if (!today) return null;
  const todayItems = items.filter((it) => it.fcstDate === today);

  // 현재 시각 (가장 가까운 미래 정시)
  const now = new Date();
  const curHour = String(now.getHours()).padStart(2, "0") + "00";

  // 집계 변수
  let currentTemp: number | null = null;
  let currentHum: number | null = null;
  let currentSky: number | null = null;
  let currentPty: number | null = null;
  let currentWind: number | null = null;

  let humMax: number | null = null;
  let humMin: number | null = null;
  let humPeakTime: string | null = null;

  let tmax: number | null = null;
  let tmin: number | null = null;
  let rainSum = 0;
  let maxPop = 0;
  let maxWind = 0;

  todayItems.forEach((it) => {
    const cat = it.category;
    const time = it.fcstTime;
    const val = it.fcstValue;

    if (cat === "TMP") {
      const t = parseFloat(val);
      if (currentTemp === null && time >= curHour) currentTemp = t;
      if (tmax === null || t > tmax) tmax = t;
      if (tmin === null || t < tmin) tmin = t;
    } else if (cat === "TMX") {
      const v = parseFloat(val);
      if (tmax === null || v > tmax) tmax = v;
    } else if (cat === "TMN") {
      const v = parseFloat(val);
      if (tmin === null || v < tmin) tmin = v;
    } else if (cat === "REH") {
      const h = parseFloat(val);
      if (currentHum === null && time >= curHour) currentHum = h;
      if (humMax === null || h > humMax) { humMax = h; humPeakTime = time; }
      if (humMin === null || h < humMin) humMin = h;
    } else if (cat === "SKY") {
      if (currentSky === null && time >= curHour) currentSky = parseInt(val);
    } else if (cat === "PTY") {
      if (currentPty === null && time >= curHour) currentPty = parseInt(val);
    } else if (cat === "WSD") {
      const w = parseFloat(val);
      if (currentWind === null && time >= curHour) currentWind = w;
      if (w > maxWind) maxWind = w;
    } else if (cat === "POP") {
      const p = parseFloat(val);
      if (p > maxPop) maxPop = p;
    } else if (cat === "PCP") {
      const s = String(val);
      if (s === "강수없음" || s === "-" || s === "0" || s === "0.0") return;
      const n = parseFloat(s.replace(/[^\d.]/g, ""));
      if (!isNaN(n)) rainSum += n;
    }
  });

  // 폴백: 현재 시각 데이터 못 잡으면 첫 값 사용
  if (currentTemp === null) {
    const f = todayItems.find((it) => it.category === "TMP");
    if (f) currentTemp = parseFloat(f.fcstValue);
  }
  if (currentHum === null) {
    const f = todayItems.find((it) => it.category === "REH");
    if (f) currentHum = parseFloat(f.fcstValue);
  }

  // 시각 포맷 (0500 → 05시)
  const formatTime = (t: string | null) => t ? `${t.slice(0, 2)}시` : null;

  return {
    source: "KMA",
    temp: currentTemp,
    hum: currentHum,
    humMax,
    humMin,
    humPeakTime: formatTime(humPeakTime),
    sky: currentSky,
    pty: currentPty,
    wind: currentWind ?? 0,
    windMax: maxWind,
    tmax,
    tmin,
    rain: rainSum,
    pop: maxPop,
  };
}