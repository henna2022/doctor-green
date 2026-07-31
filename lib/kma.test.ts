import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { latLonToKmaGrid, getKmaBaseTime, parseKma, KmaItem } from "./kma";

describe("latLonToKmaGrid", () => {
  it("서울시청(37.5665, 126.9780) → 격자 (60, 127) — 기상청 공식 참조값", () => {
    expect(latLonToKmaGrid(37.5665, 126.9780)).toEqual({ nx: 60, ny: 127 });
  });

  it("결과 nx/ny는 정수(Math.floor)여야 한다", () => {
    const { nx, ny } = latLonToKmaGrid(35.1796, 129.0756);
    expect(Number.isInteger(nx)).toBe(true);
    expect(Number.isInteger(ny)).toBe(true);
  });

  it("경도가 기준경도(126°)보다 많이 서쪽/음수여도 NaN 없이 계산된다", () => {
    const { nx, ny } = latLonToKmaGrid(37.0, -10.0);
    expect(Number.isNaN(nx)).toBe(false);
    expect(Number.isNaN(ny)).toBe(false);
  });
});

describe("getKmaBaseTime", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("KST 11:09:59 → 직전 발표시각 08:00 (10분 지연 보정으로 11:00 발표분 아직 미사용)", () => {
    vi.setSystemTime(new Date("2026-07-31T02:09:59.000Z")); // KST 11:09:59
    expect(getKmaBaseTime()).toEqual({ base_date: "20260731", base_time: "0800" });
  });

  it("KST 11:10:00 → 11:00 발표분 사용 가능 (경계값)", () => {
    vi.setSystemTime(new Date("2026-07-31T02:10:00.000Z")); // KST 11:10:00
    expect(getKmaBaseTime()).toEqual({ base_date: "20260731", base_time: "1100" });
  });

  it("KST 01:59:59 (자정 직후, h<2) → 전날 23:00 발표분", () => {
    vi.setSystemTime(new Date("2026-07-30T16:59:59.000Z")); // KST 2026-07-31 01:59:59
    expect(getKmaBaseTime()).toEqual({ base_date: "20260730", base_time: "2300" });
  });

  it("KST 02:10:00 → 당일 02:00 발표분 (h<2 폴백 경계 직후)", () => {
    vi.setSystemTime(new Date("2026-07-30T17:10:00.000Z")); // KST 2026-07-31 02:10:00
    expect(getKmaBaseTime()).toEqual({ base_date: "20260731", base_time: "0200" });
  });

  it("월 경계를 넘는 시각도 올바른 날짜로 보정된다", () => {
    vi.setSystemTime(new Date("2026-06-30T17:10:00.000Z")); // KST 2026-07-01 02:10:00
    expect(getKmaBaseTime()).toEqual({ base_date: "20260701", base_time: "0200" });
  });
});

describe("parseKma", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function withOk(item: KmaItem[]) {
    return { response: { header: { resultCode: "00" }, body: { items: { item } } } };
  }

  it("response가 없으면 null", () => {
    expect(parseKma({})).toBeNull();
  });

  it("resultCode가 00이 아니면 null", () => {
    expect(parseKma({ response: { header: { resultCode: "03" } } })).toBeNull();
  });

  it("item 배열이 비어있으면 null", () => {
    expect(parseKma(withOk([]))).toBeNull();
  });

  it("items.item 자체가 없으면 null", () => {
    expect(parseKma({ response: { header: { resultCode: "00" }, body: {} } })).toBeNull();
  });

  it("오늘 예보를 정상적으로 집계한다", () => {
    // KST 09:00 시점으로 고정 → curHour = "0900"
    vi.setSystemTime(new Date("2026-07-31T00:00:00.000Z"));
    const items = [
      { fcstDate: "20260731", fcstTime: "0600", category: "TMP", fcstValue: "20" },
      { fcstDate: "20260731", fcstTime: "0900", category: "TMP", fcstValue: "23" },
      { fcstDate: "20260731", fcstTime: "1200", category: "TMP", fcstValue: "26" },
      { fcstDate: "20260731", fcstTime: "1200", category: "TMX", fcstValue: "27" },
      { fcstDate: "20260731", fcstTime: "0600", category: "TMN", fcstValue: "15" },
      { fcstDate: "20260731", fcstTime: "0600", category: "REH", fcstValue: "70" },
      { fcstDate: "20260731", fcstTime: "0900", category: "REH", fcstValue: "65" },
      { fcstDate: "20260731", fcstTime: "1200", category: "REH", fcstValue: "80" },
      { fcstDate: "20260731", fcstTime: "0900", category: "SKY", fcstValue: "1" },
      { fcstDate: "20260731", fcstTime: "0900", category: "PTY", fcstValue: "0" },
      { fcstDate: "20260731", fcstTime: "0600", category: "WSD", fcstValue: "2.1" },
      { fcstDate: "20260731", fcstTime: "0900", category: "WSD", fcstValue: "3.5" },
      { fcstDate: "20260731", fcstTime: "1200", category: "WSD", fcstValue: "5.0" },
      { fcstDate: "20260731", fcstTime: "0600", category: "POP", fcstValue: "20" },
      { fcstDate: "20260731", fcstTime: "0900", category: "POP", fcstValue: "60" },
      { fcstDate: "20260731", fcstTime: "1200", category: "POP", fcstValue: "80" },
      { fcstDate: "20260731", fcstTime: "0600", category: "PCP", fcstValue: "강수없음" },
      { fcstDate: "20260731", fcstTime: "0900", category: "PCP", fcstValue: "1.0mm" },
      { fcstDate: "20260731", fcstTime: "1200", category: "PCP", fcstValue: "3.5mm" },
      // 다른 날짜 데이터는 today 필터에서 제외되어야 함
      { fcstDate: "20260801", fcstTime: "0000", category: "TMP", fcstValue: "99" },
    ];
    const result = parseKma(withOk(items));
    expect(result).toEqual({
      source: "KMA",
      temp: 23,
      hum: 65,
      humMax: 80,
      humMin: 65,
      humPeakTime: "12시",
      sky: 1,
      pty: 0,
      wind: 3.5,
      windMax: 5,
      tmax: 27,
      tmin: 15,
      rain: 4.5,
      pop: 80,
    });
  });

  it("현재 시각 이후 데이터가 없으면 해당 카테고리 첫 값으로 폴백한다", () => {
    // KST 23:00 시점 → curHour = "2300", 모든 예보시각(<=1200)이 이보다 이르므로 폴백 발생
    vi.setSystemTime(new Date("2026-07-31T14:00:00.000Z"));
    const items = [
      { fcstDate: "20260731", fcstTime: "0600", category: "TMP", fcstValue: "18" },
      { fcstDate: "20260731", fcstTime: "0900", category: "TMP", fcstValue: "22" },
      { fcstDate: "20260731", fcstTime: "0600", category: "REH", fcstValue: "55" },
    ];
    const result = parseKma(withOk(items));
    expect(result?.temp).toBe(18); // 첫 TMP 값으로 폴백
    expect(result?.hum).toBe(55);  // 첫 REH 값으로 폴백
  });

  it("PCP 값이 '강수없음'/'-'/'0'/'0.0'이면 강수량에 합산하지 않는다", () => {
    vi.setSystemTime(new Date("2026-07-31T00:00:00.000Z"));
    const items = [
      { fcstDate: "20260731", fcstTime: "0600", category: "PCP", fcstValue: "강수없음" },
      { fcstDate: "20260731", fcstTime: "0900", category: "PCP", fcstValue: "-" },
      { fcstDate: "20260731", fcstTime: "1200", category: "PCP", fcstValue: "0" },
      { fcstDate: "20260731", fcstTime: "1500", category: "PCP", fcstValue: "0.0" },
    ];
    const result = parseKma(withOk(items));
    expect(result?.rain).toBe(0);
  });

  it("WSD 데이터가 없으면 wind/windMax는 0", () => {
    vi.setSystemTime(new Date("2026-07-31T00:00:00.000Z"));
    const items = [{ fcstDate: "20260731", fcstTime: "0600", category: "TMP", fcstValue: "20" }];
    const result = parseKma(withOk(items));
    expect(result?.wind).toBe(0);
    expect(result?.windMax).toBe(0);
  });

  it("today는 배열의 첫 item의 fcstDate 기준으로 필터링한다", () => {
    vi.setSystemTime(new Date("2026-07-31T00:00:00.000Z"));
    const items = [
      { fcstDate: "20260801", fcstTime: "0000", category: "TMP", fcstValue: "30" },
      { fcstDate: "20260731", fcstTime: "0600", category: "TMP", fcstValue: "20" }, // 필터링되어 무시됨
    ];
    const result = parseKma(withOk(items));
    expect(result?.tmax).toBe(30);
    expect(result?.tmin).toBe(30);
  });
});
