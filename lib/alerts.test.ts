import { describe, it, expect } from "vitest";
import { generateAlerts } from "./alerts";
import { WeatherData, PestAlert, PestForecast } from "./api";

function weather(overrides: Partial<WeatherData> = {}): WeatherData {
  return {
    source: "KMA",
    temp: 20,
    hum: 50,
    humMax: 50,
    humMin: 50,
    humPeakTime: null,
    sky: 1,
    pty: 0,
    wind: 2,
    windMax: 2,
    tmax: 25,
    tmin: 15,
    rain: 0,
    pop: 10,
    ...overrides,
  };
}

const base = { ncpms: [] as PestForecast[], farmmap: [] as PestAlert[], cityName: "서울" };

describe("generateAlerts - weather 없음", () => {
  it("weather가 null이고 다른 데이터도 없으면 빈 배열", () => {
    expect(generateAlerts({ weather: null, ...base })).toEqual([]);
  });
});

describe("generateAlerts - 폭염/더위", () => {
  it("최고기온 33도 이상 → 폭염 경보", () => {
    const alerts = generateAlerts({ weather: weather({ tmax: 33 }), ...base });
    expect(alerts[0]).toMatchObject({ kind: "warn", badge: "경보", title: "야외활동 주의" });
  });

  it("최고기온 30~33도 미만 → 더위 주의", () => {
    const alerts = generateAlerts({ weather: weather({ tmax: 30 }), ...base });
    expect(alerts[0]).toMatchObject({ kind: "safe", badge: "주의", title: "시설 환기 권장" });
  });

  it("최고기온 30도 미만이면 폭염/더위 알림 없음", () => {
    const alerts = generateAlerts({ weather: weather({ tmax: 29.9 }), ...base });
    expect(alerts.find((a) => a.title === "야외활동 주의" || a.title === "시설 환기 권장")).toBeUndefined();
  });
});

describe("generateAlerts - 한파/저온", () => {
  it("최저기온 0도 이하 → 저온 경보", () => {
    const alerts = generateAlerts({ weather: weather({ tmin: 0 }), ...base });
    expect(alerts[0]).toMatchObject({ kind: "warn", badge: "경보", title: "동해 위험" });
  });

  it("최저기온 0도 초과면 저온 경보 없음", () => {
    const alerts = generateAlerts({ weather: weather({ tmin: 0.1 }), ...base });
    expect(alerts.find((a) => a.title === "동해 위험")).toBeUndefined();
  });
});

describe("generateAlerts - 강수/강수확률 (else-if 우선순위)", () => {
  it("강수량 30mm 이상 → 호우 경보", () => {
    const alerts = generateAlerts({ weather: weather({ rain: 30, pop: 90 }), ...base });
    expect(alerts[0]).toMatchObject({ kind: "warn", badge: "경보", title: "배수로 점검" });
  });

  it("강수량 10~30mm 미만 → 비 예보 주의 (pop이 높아도 rain 우선)", () => {
    const alerts = generateAlerts({ weather: weather({ rain: 10, pop: 90 }), ...base });
    expect(alerts[0]).toMatchObject({ kind: "safe", badge: "주의", sub: expect.stringContaining("비 예보") });
  });

  it("강수량 10mm 미만이고 강수확률 60% 이상 → 강수확률 주의", () => {
    const alerts = generateAlerts({ weather: weather({ rain: 5, pop: 60 }), ...base });
    expect(alerts[0]).toMatchObject({ title: "방제 일정 조정", sub: "강수확률 60%" });
  });

  it("강수량 적고 강수확률도 낮으면 강수 관련 알림 없음", () => {
    const alerts = generateAlerts({ weather: weather({ rain: 0, pop: 10 }), ...base });
    expect(alerts.find((a) => a.title === "방제 일정 조정" || a.title === "배수로 점검")).toBeUndefined();
  });
});

describe("generateAlerts - 강풍", () => {
  it("windMax 10 이상 → 강풍 경보", () => {
    const alerts = generateAlerts({ weather: weather({ windMax: 10, wind: 1 }), ...base });
    expect(alerts[0]).toMatchObject({ kind: "warn", title: "시설물 점검" });
  });

  it("windMax가 0(falsy)이면 wind로 폴백해 판단한다", () => {
    const alerts = generateAlerts({ weather: weather({ windMax: 0, wind: 12 }), ...base });
    expect(alerts[0]).toMatchObject({ title: "시설물 점검" });
  });

  it("windMax, wind 모두 10 미만이면 강풍 경보 없음", () => {
    const alerts = generateAlerts({ weather: weather({ windMax: 9.9, wind: 9.9 }), ...base });
    expect(alerts.find((a) => a.title === "시설물 점검")).toBeUndefined();
  });
});

describe("generateAlerts - 습도 (4단계 우선순위)", () => {
  it("현재 습도 85% 이상 → 즉시 다습 경보", () => {
    const alerts = generateAlerts({ weather: weather({ hum: 85, humMax: 90 }), ...base });
    expect(alerts[0]).toMatchObject({ kind: "warn", title: "곰팡이병 위험 ↑", sub: expect.stringContaining("다습") });
  });

  it("현재는 낮지만 오늘 중 최대 85% 이상 예상 → 다습 예상 주의 (humPeakTime 있음)", () => {
    const alerts = generateAlerts({ weather: weather({ hum: 50, humMax: 85, humPeakTime: "15시" }), ...base });
    expect(alerts[0]).toMatchObject({ badge: "주의", sub: "다습 예상 (15시경)" });
  });

  it("humPeakTime이 없으면 '오늘 중'으로 표시", () => {
    const alerts = generateAlerts({ weather: weather({ hum: 50, humMax: 85, humPeakTime: null }), ...base });
    expect(alerts[0].sub).toBe("다습 예상 (오늘 중)");
  });

  it("오늘 중 70~85% 미만 예상 → 습도 상승 안내", () => {
    const alerts = generateAlerts({ weather: weather({ hum: 50, humMax: 70 }), ...base });
    expect(alerts[0]).toMatchObject({ badge: "안내", title: "다습 주의" });
  });

  it("종일 건조(humMin 30% 미만) → 관수 권장", () => {
    const alerts = generateAlerts({ weather: weather({ hum: 40, humMax: 40, humMin: 29 }), ...base });
    expect(alerts[0]).toMatchObject({ badge: "안내", title: "관수 권장" });
  });

  it("모든 습도 조건에 해당 안되면 습도 알림 없음", () => {
    const alerts = generateAlerts({ weather: weather({ hum: 50, humMax: 65, humMin: 40 }), ...base });
    expect(alerts.find((a) => a.title.includes("곰팡이") || a.title === "다습 주의" || a.title === "관수 권장")).toBeUndefined();
  });
});

describe("generateAlerts - NCPMS 병해충 예찰", () => {
  it("경보/주의보 등급은 warn, 그 외는 safe", () => {
    const ncpms: PestForecast[] = [
      { crop: "딸기", name: "흰가루병", level: "경보", period: "1주" },
      { crop: "토마토", name: "역병", level: "예보", period: "2주" },
    ];
    const alerts = generateAlerts({ weather: null, ncpms, farmmap: [], cityName: "서울" });
    expect(alerts[0].kind).toBe("warn");
    expect(alerts[1].kind).toBe("safe");
  });

  it("level이 없으면 '예보'로 기본 처리(safe)", () => {
    const ncpms = [{ crop: "딸기", name: "탄저병" }] as PestForecast[];
    const alerts = generateAlerts({ weather: null, ncpms, farmmap: [], cityName: "서울" });
    expect(alerts[0]).toMatchObject({ kind: "safe", badge: "예보" });
  });

  it("최대 5건까지만 표시한다", () => {
    const ncpms: PestForecast[] = Array.from({ length: 8 }, (_, i) => ({
      crop: "딸기", name: `병${i}`, level: "예보", period: "1주",
    }));
    const alerts = generateAlerts({ weather: null, ncpms, farmmap: [], cityName: "서울" });
    expect(alerts).toHaveLength(5);
  });
});

describe("generateAlerts - 팜맵 주변 농가 발생", () => {
  it("severity별 badge/kind 매핑", () => {
    const farmmap: PestAlert[] = [
      { crop: "딸기", disease: "탄저병", distance_km: 2, severity: "high" },
      { crop: "토마토", disease: "역병", distance_km: 3, severity: "mid" },
      { crop: "오이", disease: "노균병", distance_km: 4, severity: "low" },
    ];
    const alerts = generateAlerts({ weather: null, ncpms: [], farmmap, cityName: "서울" });
    expect(alerts.map((a) => a.badge)).toEqual(["경보", "주의", "안내"]);
    expect(alerts[0].kind).toBe("warn");
    expect(alerts[1].kind).toBe("safe");
  });

  it("distance_km 1 미만이면 '1km 이내'로 표시", () => {
    const farmmap: PestAlert[] = [{ crop: "딸기", disease: "탄저병", distance_km: 0.5, severity: "high" }];
    const alerts = generateAlerts({ weather: null, ncpms: [], farmmap, cityName: "서울" });
    expect(alerts[0].sub).toContain("1km 이내");
  });

  it("distance_km이 없으면 '주변'으로 표시", () => {
    const farmmap = [{ crop: "딸기", disease: "탄저병", severity: "high" }] as unknown as PestAlert[];
    const alerts = generateAlerts({ weather: null, ncpms: [], farmmap, cityName: "서울" });
    expect(alerts[0].sub).toContain("주변");
  });

  it("최대 5건까지만 표시한다", () => {
    const farmmap: PestAlert[] = Array.from({ length: 7 }, (_, i) => ({
      crop: "딸기", disease: `병${i}`, distance_km: 1, severity: "mid",
    }));
    const alerts = generateAlerts({ weather: null, ncpms: [], farmmap, cityName: "서울" });
    expect(alerts).toHaveLength(5);
  });
});
