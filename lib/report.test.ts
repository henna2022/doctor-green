import { describe, it, expect, vi, beforeEach } from "vitest";

// getDailyReport는 supabase.rpc(daily_report)를 우선 쓰고, 실패 시 supabase.from(...) 체이닝으로
// 폴백한다. stats()/extremeWarnings()는 export되지 않은 내부 함수라 getDailyReport를 통해
// 간접적으로(입력 → 출력 경계값) 검증한다. supabase는 모듈 최상단에서 env var가 없으면
// throw하므로 실제 클라이언트를 만들지 않도록 통째로 모킹한다.
const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("./supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { getDailyReport } from "./report";

function rpcRow(overrides: Record<string, unknown> = {}) {
  return {
    count: 10,
    avg_temp: 20, min_temp: 18, max_temp: 22,
    avg_hum: 65, min_hum: 60, max_hum: 70,
    avg_soil: 55, min_soil: 50, max_soil: 60,
    ...overrides,
  };
}

describe("getDailyReport (stats/extremeWarnings 간접 검증)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it("count=0이면 hasData=false, '데이터 없음' 안내", async () => {
    rpcMock.mockResolvedValue({ data: [rpcRow({ count: 0 })], error: null });
    const report = await getDailyReport("device-1", "딸기");
    expect(report.hasData).toBe(false);
    expect(report.verdict).toMatchObject({ tone: "warn", text: expect.stringContaining("데이터가 없어요") });
  });

  it("평균이 모두 적정범위 안이면 verdict ok", async () => {
    // 딸기: temp[18,24] hum[60,75] soil[40,70]
    rpcMock.mockResolvedValue({ data: [rpcRow()], error: null });
    const report = await getDailyReport("device-1", "딸기");
    expect(report.env.status).toBe("ok");
    expect(report.verdict.tone).toBe("ok");
    expect(report.warnings).toEqual([]);
  });

  it("평균이 위험 범위면 verdict bad", async () => {
    rpcMock.mockResolvedValue({
      data: [rpcRow({ avg_temp: 35, min_temp: 35, max_temp: 35 })], // 35 > 24+5
      error: null,
    });
    const report = await getDailyReport("device-1", "딸기");
    expect(report.env.status).toBe("bad");
    expect(report.verdict.tone).toBe("bad");
  });

  it("평균은 양호하지만 순간 극값이 위험 범위를 넘으면 warnings에 기록되고 verdict는 warn", async () => {
    // avg_temp 20(정상)이지만 한때 max_temp 30(> hi+5=29) 이었음
    rpcMock.mockResolvedValue({
      data: [rpcRow({ avg_temp: 20, min_temp: 18, max_temp: 30 })],
      error: null,
    });
    const report = await getDailyReport("device-1", "딸기");
    expect(report.env.status).toBe("ok"); // 평균 기준 ok
    expect(report.warnings).toContain("🌡️ 한때 고온(30°C)이 있었어요");
    expect(report.verdict).toMatchObject({ tone: "warn", text: expect.stringContaining("한때 위험 구간") });
  });

  it("극값 경계: max_temp가 정확히 hi+5면 경고 없음(초과해야 경고)", async () => {
    rpcMock.mockResolvedValue({
      data: [rpcRow({ avg_temp: 20, min_temp: 18, max_temp: 29 })], // hi+5 = 29
      error: null,
    });
    const report = await getDailyReport("device-1", "딸기");
    expect(report.warnings).toEqual([]);
  });

  it("극값: 저온/건조/과습 경고 문구도 각각 생성된다", async () => {
    rpcMock.mockResolvedValue({
      data: [rpcRow({
        avg_temp: 20, min_temp: 12, max_temp: 20,   // min < lo-5=13 → 저온
        avg_hum: 65, min_hum: 45, max_hum: 65,       // min < lo-10=50 → 건조
        avg_soil: 55, min_soil: 50, max_soil: 86,    // max > hi+15=85 → 토양 과습
      })],
      error: null,
    });
    const report = await getDailyReport("device-1", "딸기");
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("저온"),
        expect.stringContaining("건조"),
        expect.stringContaining("토양 과습"),
      ])
    );
  });

  it("RPC 에러 시 from() 폴백 경로로 집계하고, 평균은 소수 첫째자리로 반올림한다", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "no function" } });
    const rows = [{ temp: 10, hum: 60, soil: 40 }, { temp: 20, hum: 61, soil: 41 }, { temp: 21, hum: 62, soil: 42 }];
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: rows }),
    };
    fromMock.mockReturnValue(chain);

    const report = await getDailyReport("device-1", "딸기");
    expect(report.count).toBe(3);
    expect(report.avg.temp).toBeCloseTo(17.0, 5); // (10+20+21)/3 = 17.0
    expect(report.range.temp).toEqual([10, 21]);
  });

  it("폴백 경로에서 결과 행이 없으면 hasData=false", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "no function" } });
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
    };
    fromMock.mockReturnValue(chain);

    const report = await getDailyReport("device-1", "딸기");
    expect(report.hasData).toBe(false);
    expect(report.range.temp).toBeNull();
  });

  it("작물명을 넘기지 않으면 기본 가이드 범위로 평가한다", async () => {
    rpcMock.mockResolvedValue({ data: [rpcRow({ avg_temp: 20 })], error: null }); // 기본 범위 18~26
    const report = await getDailyReport("device-1");
    expect(report.env.items.find((i) => i.kind === "온도")?.level).toBe("ok");
  });
});
