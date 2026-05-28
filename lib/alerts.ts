import { WeatherData, PestAlert, PestForecast } from "./api";

export interface Alert {
  kind: "warn" | "safe";
  badge: string;
  sub: string;
  title: string;
  desc: string;
}

interface GenerateParams {
  weather: WeatherData | null;
  ncpms: PestForecast[];
  farmmap: PestAlert[];
  cityName: string;
}

// 실제 API 데이터만으로 알림 생성 (예시/시뮬레이션 없음)
export function generateAlerts({ weather, ncpms, farmmap, cityName }: GenerateParams): Alert[] {
  const alerts: Alert[] = [];

  // ① 날씨 기반 경보 (기상청 실제 데이터)
  if (weather) {
    const srcLabel = weather.source === "KMA" ? "기상청" : "기상";
    const todayMax = weather.tmax;
    const todayMin = weather.tmin;
    const rainSum = weather.rain;
    const hum = weather.hum;
    const wind = weather.wind;
    const pop = weather.pop;

    if (todayMax != null && todayMax >= 33) {
      alerts.push({
        kind: "warn", badge: "경보", sub: `폭염 (${srcLabel})`, title: "야외활동 주의",
        desc: `${cityName} 오늘 최고 ${Math.round(todayMax)}°C가 예상됩니다. 낮시간 야외작업을 피하고 충분히 수분을 섭취하세요.`,
      });
    } else if (todayMax != null && todayMax >= 30) {
      alerts.push({
        kind: "safe", badge: "주의", sub: `더위 (${srcLabel})`, title: "시설 환기 권장",
        desc: `${cityName} 오늘 최고 ${Math.round(todayMax)}°C. 하우스·시설재배 환기를 권장합니다.`,
      });
    }
    if (todayMin != null && todayMin <= 0) {
      alerts.push({
        kind: "warn", badge: "경보", sub: `저온 (${srcLabel})`, title: "동해 위험",
        desc: `${cityName} 오늘 최저 ${Math.round(todayMin)}°C. 노지작물 동해 위험, 보온덮개를 점검하세요.`,
      });
    }
    if (rainSum != null && rainSum >= 30) {
      alerts.push({
        kind: "warn", badge: "경보", sub: `호우 (${srcLabel})`, title: "배수로 점검",
        desc: `오늘 강수량 ${Math.round(rainSum)}mm 예상. 침수·역병 위험이 높으니 배수로 정비를 권장합니다.`,
      });
    } else if (rainSum != null && rainSum >= 10) {
      alerts.push({
        kind: "safe", badge: "주의", sub: `비 예보 (${srcLabel})`, title: "방제 일정 조정",
        desc: `오늘 비 ${Math.round(rainSum)}mm 예상. 농약 살포 일정을 조정하세요.`,
      });
    } else if (pop != null && pop >= 60) {
      alerts.push({
        kind: "safe", badge: "주의", sub: `강수확률 ${Math.round(pop)}%`, title: "방제 일정 조정",
        desc: `${cityName} 강수확률 ${Math.round(pop)}%. 농약 살포 일정을 조정하세요.`,
      });
    }
    if (wind != null && wind >= 10) {
      alerts.push({
        kind: "warn", badge: "경보", sub: `강풍 (${srcLabel})`, title: "시설물 점검",
        desc: `풍속 ${wind.toFixed(1)}m/s. 비닐하우스·지지대 점검을 권장합니다.`,
      });
    }
    if (hum != null && hum >= 85) {
      alerts.push({
        kind: "safe", badge: "주의", sub: `다습 (${Math.round(hum)}%)`, title: "곰팡이병 위험 ↑",
        desc: `현재 습도 ${Math.round(hum)}%. 통풍을 강화하고 곰팡이성 병해를 주의하세요.`,
      });
    }
  }

  // ② NCPMS 병해충 예찰 (농촌진흥청 실제 데이터)
  if (ncpms && ncpms.length) {
    ncpms.slice(0, 5).forEach((item) => {
      const lv = item.level || "예보";
      const kind: "warn" | "safe" = lv === "경보" || lv === "주의보" ? "warn" : "safe";
      alerts.push({
        kind, badge: lv, sub: `NCPMS · ${item.crop}`,
        title: `${item.crop} ${item.name}`,
        desc: `농촌진흥청 ${lv}: ${item.crop}에 ${item.name} 발생 예찰 정보입니다 (${item.period || "금주"}).`,
      });
    });
  }

  // ③ 팜맵 주변 농가 발생 (실제 데이터)
  if (farmmap && farmmap.length) {
    farmmap.slice(0, 5).forEach((item) => {
      const sev = item.severity || "mid";
      const kind: "warn" | "safe" = sev === "high" ? "warn" : "safe";
      const badge = sev === "high" ? "경보" : sev === "mid" ? "주의" : "안내";
      const dist =
        item.distance_km != null
          ? item.distance_km < 1 ? "1km 이내" : `반경 ${Math.round(item.distance_km)}km`
          : "주변";
      alerts.push({
        kind, badge, sub: `주변 농가 (${dist})`,
        title: `${item.crop} ${item.disease}`,
        desc: `${cityName} ${dist} 농가에서 ${item.crop} ${item.disease} 발생이 보고되었습니다. 예찰을 강화하세요.`,
      });
    });
  }

  // 예시/폴백 없음 — 실제 데이터가 없으면 빈 배열 반환
  return alerts;
}