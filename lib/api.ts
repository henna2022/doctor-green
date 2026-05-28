// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 닥터 그린 API 호출 함수 모음
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 기존 server.js의 Vercel URL
// TODO: 본인 URL로 교체!
const API_BASE = "";

// ━━━ 타입 정의 ━━━

export interface WeatherData {
  source: string;
  temp: number | null;       // 현재 기온
  hum: number | null;        // 습도
  sky: number | null;        // 하늘 상태 (1=맑음, 3=구름많음, 4=흐림)
  pty: number | null;        // 강수 형태
  wind: number;              // 풍속
  tmax: number | null;       // 최고기온
  tmin: number | null;       // 최저기온
  rain: number;              // 강수량
  pop: number;               // 강수확률
}

export interface PestAlert {
  crop: string;
  disease: string;
  distance_km: number;
  severity: "low" | "mid" | "high";
  reportedAt?: string;
}

export interface GeocodeResult {
  name: string;
}

// ━━━ API 함수들 ━━━

// 기상청 날씨 정보
export async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/kma?lat=${lat}&lon=${lon}`);
    if (!res.ok) throw new Error("Weather fetch failed");
    return await res.json();
  } catch (e) {
    console.error("Weather error:", e);
    return null;
  }
}

// 역지오코딩 (좌표 → 지역명)
export async function fetchLocationName(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/geocode?lat=${lat}&lon=${lon}`);
    if (!res.ok) throw new Error("Geocode failed");
    const data: GeocodeResult = await res.json();
    return data.name || "현재 위치";
  } catch (e) {
    console.error("Geocode error:", e);
    return "현재 위치";
  }
}

// 주변 병해충 발생 정보
export async function fetchNearbyPests(
  lat: number,
  lon: number,
  radius = 10
): Promise<PestAlert[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/farmmap?lat=${lat}&lon=${lon}&radius=${radius}`
    );
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error("Farmmap error:", e);
    return [];
  }
}

// ━━━ NCPMS 병해충 예찰 ━━━
export interface PestForecast {
  crop: string;
  name: string;       // 병해충 이름
  level: string;      // 발생 수준/경보
  period: string;     // 발생 시기
}

// 작물별 병해충 예찰 정보 가져오기
export async function fetchPestForecast(crops: string[]): Promise<PestForecast[]> {
  if (!crops || crops.length === 0) return [];
  try {
    const res = await fetch(`${API_BASE}/api/ncpms?crops=${encodeURIComponent(crops.join(","))}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error("NCPMS error:", e);
    return [];
  }
}

// ━━━ 헬퍼 함수 ━━━

// 하늘 상태 → 이모지 + 텍스트
export function weatherEmoji(sky: number | null, pty: number | null): string {
  if (pty === 1) return "🌧️ 비";
  if (pty === 2) return "🌨️ 비/눈";
  if (pty === 3) return "❄️ 눈";
  if (pty === 4) return "🌦️ 소나기";
  if (sky === 1) return "☀️ 맑음";
  if (sky === 3) return "⛅ 구름많음";
  if (sky === 4) return "☁️ 흐림";
  return "☀️ 맑음";
}