import { NextRequest, NextResponse } from "next/server";

const KMA_KEY = process.env.KMA_KEY;
const KMA_BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";

// 위경도 → 기상청 격자 좌표 변환 (Lambert Conformal Conic)
function latLonToGrid(lat: number, lon: number) {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;

  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const x = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const y = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  return { x, y };
}

// 가장 가까운 base_time 계산
function getBaseTime() {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000); // KST
  const hour = kstNow.getUTCHours();

  // 단기예보 발표 시각: 02, 05, 08, 11, 14, 17, 20, 23시 (10분 후 부터 사용 가능)
  const baseTimes = [2, 5, 8, 11, 14, 17, 20, 23];
  let baseHour = 23;
  let useYesterday = false;

  for (let i = baseTimes.length - 1; i >= 0; i--) {
    if (hour >= baseTimes[i]) {
      baseHour = baseTimes[i];
      break;
    }
    if (i === 0) useYesterday = true;
  }

  const date = new Date(kstNow);
  if (useYesterday) date.setUTCDate(date.getUTCDate() - 1);

  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(baseHour).padStart(2, "0");

  return { base_date: `${yyyy}${mm}${dd}`, base_time: `${hh}00`, todayDate: kstNow };
}

interface KmaItem {
  fcstDate: string;
  fcstTime: string;
  category: string;
  fcstValue: string;
}

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") || "0");
  const lon = parseFloat(req.nextUrl.searchParams.get("lon") || "0");
  if (!lat || !lon) {
    return NextResponse.json({ error: "lat, lon required" }, { status: 400 });
  }
  if (!KMA_KEY) {
    return NextResponse.json({ error: "KMA_KEY not set" }, { status: 500 });
  }

  try {
    const { x, y } = latLonToGrid(lat, lon);
    const { base_date, base_time, todayDate } = getBaseTime();

    const params = new URLSearchParams();
    params.set("serviceKey", KMA_KEY);
    params.set("pageNo", "1");
    params.set("numOfRows", "1000"); // 하루치(시간별 카테고리 12개 × 24시간 + α)
    params.set("dataType", "JSON");
    params.set("base_date", base_date);
    params.set("base_time", base_time);
    params.set("nx", String(x));
    params.set("ny", String(y));

    const url = `${KMA_BASE}?${params.toString()}`;
    const res = await fetch(url, { next: { revalidate: 600 } }); // 10분 캐시
    const json = await res.json();

    if (json?.response?.header?.resultCode !== "00") {
      console.error("KMA error:", json?.response?.header);
      return NextResponse.json({ error: "KMA fetch failed" }, { status: 502 });
    }

    const items: KmaItem[] = json?.response?.body?.items?.item || [];
    if (!items.length) {
      return NextResponse.json({ error: "no data" }, { status: 502 });
    }

    // 오늘 날짜 (KST)
    const yyyy = todayDate.getUTCFullYear();
    const mm = String(todayDate.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(todayDate.getUTCDate()).padStart(2, "0");
    const todayStr = `${yyyy}${mm}${dd}`;

    // 현재 시각 (가장 가까운 미래 정시)
    const currentHour = todayDate.getUTCHours();
    const currentTimeStr = `${String(currentHour).padStart(2, "0")}00`;

    // 집계용
    let currentTemp: number | null = null;
    let currentHum: number | null = null;
    let currentSky: number | null = null;
    let currentPty: number | null = null;
    let currentWind: number | null = null;

    let humMax: number | null = null; // 오늘 최대 습도
    let humMin: number | null = null; // 오늘 최저 습도
    let humPeakTime: string | null = null; // 최대 습도 시각

    let tmax: number | null = null;
    let tmin: number | null = null;
    let rainSum = 0;
    let maxPop = 0;
    let maxWind = 0;

    // 오늘 데이터만 필터링
    const todayItems = items.filter((it) => it.fcstDate === todayStr);

    todayItems.forEach((it) => {
      const cat = it.category;
      const time = it.fcstTime;
      const valStr = it.fcstValue;

      if (cat === "TMP") {
        const t = parseFloat(valStr);
        // 현재 또는 가장 가까운 미래 시각의 기온
        if (currentTemp === null && time >= currentTimeStr) currentTemp = t;
        if (tmax === null || t > tmax) tmax = t;
        if (tmin === null || t < tmin) tmin = t;
      } else if (cat === "TMX") {
        const v = parseFloat(valStr);
        if (tmax === null || v > tmax) tmax = v;
      } else if (cat === "TMN") {
        const v = parseFloat(valStr);
        if (tmin === null || v < tmin) tmin = v;
      } else if (cat === "REH") {
        const h = parseFloat(valStr);
        if (currentHum === null && time >= currentTimeStr) currentHum = h;
        // 오늘 전체 습도 추적
        if (humMax === null || h > humMax) {
          humMax = h;
          humPeakTime = time;
        }
        if (humMin === null || h < humMin) humMin = h;
      } else if (cat === "SKY") {
        if (currentSky === null && time >= currentTimeStr) currentSky = parseInt(valStr);
      } else if (cat === "PTY") {
        if (currentPty === null && time >= currentTimeStr) currentPty = parseInt(valStr);
      } else if (cat === "WSD") {
        const w = parseFloat(valStr);
        if (currentWind === null && time >= currentTimeStr) currentWind = w;
        if (w > maxWind) maxWind = w;
      } else if (cat === "POP") {
        const p = parseFloat(valStr);
        if (p > maxPop) maxPop = p;
      } else if (cat === "PCP") {
        const s = String(valStr);
        if (s === "강수없음" || s === "-" || s === "0" || s === "0.0") return;
        const n = parseFloat(s.replace(/[^\d.]/g, ""));
        if (!isNaN(n)) rainSum += n;
      }
    });

    // 폴백: currentTemp이 안 잡혔으면 첫 TMP 사용
    if (currentTemp === null) {
      const firstTmp = todayItems.find((it) => it.category === "TMP");
      if (firstTmp) currentTemp = parseFloat(firstTmp.fcstValue);
    }
    if (currentHum === null) {
      const firstReh = todayItems.find((it) => it.category === "REH");
      if (firstReh) currentHum = parseFloat(firstReh.fcstValue);
    }

    // 시각 포맷 (0500 -> 05시)
    const formatTime = (t: string | null) => {
      if (!t) return null;
      return `${t.slice(0, 2)}시`;
    };

    return NextResponse.json({
      source: "KMA",
      temp: currentTemp,
      hum: currentHum,
      humMax,            // 🆕 오늘 최대 습도
      humMin,            // 🆕 오늘 최저 습도
      humPeakTime: formatTime(humPeakTime), // 🆕 최대 습도 시각
      sky: currentSky,
      pty: currentPty,
      wind: currentWind || maxWind,
      windMax: maxWind,  // 🆕 오늘 최대 풍속
      tmax,
      tmin,
      rain: rainSum,
      pop: maxPop,
    });
  } catch (e) {
    console.error("KMA route error:", e);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}