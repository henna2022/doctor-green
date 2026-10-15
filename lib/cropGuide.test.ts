import { describe, it, expect } from "vitest";
import { assessEnvironment, getGuide, CROP_GUIDE, DEFAULT_GUIDE } from "./cropGuide";

describe("getGuide", () => {
  it("정확히 일치하는 작물명은 해당 가이드를 반환한다", () => {
    expect(getGuide("딸기")).toBe(CROP_GUIDE["딸기"]);
  });

  it("부분 일치(포함)하는 작물명도 가이드를 반환한다 (방울토마토 → 토마토)", () => {
    expect(getGuide("방울토마토")).toBe(CROP_GUIDE["토마토"]);
  });

  it("등록되지 않은 작물명은 기본 가이드를 반환한다", () => {
    expect(getGuide("수박")).toBe(DEFAULT_GUIDE);
  });

  it("cropName이 null이면 기본 가이드를 반환한다", () => {
    expect(getGuide(null)).toBe(DEFAULT_GUIDE);
  });

  it("cropName이 undefined이면 기본 가이드를 반환한다", () => {
    expect(getGuide(undefined)).toBe(DEFAULT_GUIDE);
  });

  it("cropName이 빈 문자열이면 기본 가이드를 반환한다", () => {
    expect(getGuide("")).toBe(DEFAULT_GUIDE);
  });
});

describe("assessEnvironment - 온도 (딸기 18~24°C)", () => {
  it.each([
    [24, "ok"],      // 상한 경계 = ok
    [24.1, "warn"],  // 상한 초과 = warn
    [29, "warn"],    // hi+5 경계 = 아직 warn
    [29.1, "bad"],   // hi+5 초과 = bad
    [18, "ok"],      // 하한 경계 = ok
    [17.9, "warn"],  // 하한 미만 = warn
    [13, "warn"],    // lo-5 경계 = 아직 warn
    [12.9, "bad"],   // lo-5 미만 = bad
  ])("temp=%s → %s", (temp, level) => {
    const result = assessEnvironment({ temp, hum: null, soil: null }, "딸기");
    expect(result.items[0].level).toBe(level);
    expect(result.status).toBe(level);
  });

  it("센서가 없으면(null) 온도 항목이 생성되지 않는다", () => {
    const result = assessEnvironment({ temp: null, hum: null, soil: null }, "딸기");
    expect(result.items).toHaveLength(0);
    expect(result.hasSensors).toBe(false);
    expect(result.status).toBe("ok");
  });
});

describe("assessEnvironment - 습도 (딸기 60~75%)", () => {
  it.each([
    [75, "ok"],
    [75.1, "warn"],
    [85, "warn"],   // hi+10 경계 = 아직 warn
    [85.1, "bad"],
    [60, "ok"],
    [59.9, "warn"],
    [50, "warn"],   // lo-10 경계 = 아직 warn
    [49.9, "bad"],
  ])("hum=%s → %s", (hum, level) => {
    const result = assessEnvironment({ temp: null, hum, soil: null }, "딸기");
    expect(result.items[0].level).toBe(level);
  });
});

describe("assessEnvironment - 토양수분 (딸기 40~70%)", () => {
  it.each([
    [70, "ok"],
    [70.1, "warn"],
    [85, "warn"],   // hi+15 경계 = 아직 warn
    [85.1, "bad"],
    [40, "ok"],
    [39.9, "warn"],
    [25, "warn"],   // lo-15 경계 = 아직 warn
    [24.9, "bad"],
  ])("soil=%s → %s", (soil, level) => {
    const result = assessEnvironment({ temp: null, hum: null, soil }, "딸기");
    expect(result.items[0].level).toBe(level);
  });
});

describe("assessEnvironment - 종합 상태(worse) 및 미지 작물 폴백", () => {
  it("모든 항목이 ok면 전체 상태도 ok", () => {
    const result = assessEnvironment({ temp: 20, hum: 65, soil: 50 }, "딸기");
    expect(result.status).toBe("ok");
    expect(result.items).toHaveLength(3);
  });

  it("하나라도 bad면 전체 상태는 bad (가장 나쁜 항목 기준)", () => {
    const result = assessEnvironment({ temp: 20, hum: 65, soil: 5 }, "딸기"); // soil 5 → bad
    expect(result.status).toBe("bad");
  });

  it("warn과 bad가 섞이면 bad가 우선한다", () => {
    const result = assessEnvironment({ temp: 30, hum: 90, soil: 50 }, "딸기"); // temp warn, hum bad
    expect(result.status).toBe("bad");
  });

  it("ok와 warn이 섞이면 warn이 된다", () => {
    const result = assessEnvironment({ temp: 25, hum: 65, soil: 50 }, "딸기"); // temp warn만
    expect(result.status).toBe("warn");
  });

  it("등록되지 않은 작물명은 기본 범위(18~26/55~80/40~70)로 평가한다", () => {
    const result = assessEnvironment({ temp: 27, hum: null, soil: null }, "수박");
    expect(result.items[0].text).toContain("18~26");
    expect(result.items[0].level).toBe("warn"); // 27 > hi(26), <= hi+5(31)
  });

  it("hasSensors는 센서가 하나라도 있으면 true", () => {
    const result = assessEnvironment({ temp: 20, hum: null, soil: null }, "딸기");
    expect(result.hasSensors).toBe(true);
  });
});
