import { describe, it, expect } from "vitest";
import { normalizeForSearch } from "./lib";

describe("normalizeForSearch", () => {
  it("작물명 접두어와 부위 괄호를 제거한다", () => {
    expect(normalizeForSearch("딸기 흰가루병(잎)", "딸기")).toEqual({
      keyword: "흰가루병",
      cropName: "딸기",
    });
  });

  it("접두어가 없으면 그대로 유지한다", () => {
    expect(normalizeForSearch("탄저병", "고추")).toEqual({
      keyword: "탄저병",
      cropName: "고추",
    });
  });

  it("괄호가 여러 개면 모두 제거한다", () => {
    expect(normalizeForSearch("고추 탄저병(줄기)(추정)", "고추").keyword).toBe("탄저병");
  });

  it("fallbackCropName이 빈 문자열이면 '기타'로 대체한다", () => {
    expect(normalizeForSearch("병명", "").cropName).toBe("기타");
  });

  it("fallbackCropName이 '미지정'이면 '기타'로 대체한다", () => {
    expect(normalizeForSearch("병명", "미지정").cropName).toBe("기타");
  });

  it("fallbackCropName이 유효한 값이면 그대로 사용한다", () => {
    expect(normalizeForSearch("병명", "오이").cropName).toBe("오이");
  });

  it("괄호 뒤 공백은 trim으로 제거된다", () => {
    expect(normalizeForSearch("상추 균핵병 (잎/줄기)", "상추").keyword).toBe("균핵병");
  });

  it("괄호가 닫히지 않으면 제거되지 않는다 (정규식이 짝이 맞는 괄호만 매칭)", () => {
    expect(normalizeForSearch("딸기 병명(잎", "딸기").keyword).toBe("병명(잎");
  });

  it("[발견된 버그 후보] 공백 없이 작물명과 같은 접두 글자로 시작하는 병명은 잘못 잘릴 수 있다", () => {
    // "벼"가 CROP_NAMES에 포함되어 있어, 공백 구분자가 없어도 접두 일치로 제거된다.
    // "벼줄무늬잎마름병"은 '벼'+'줄무늬잎마름병'이 아니라 하나의 고유 병명인데
    // CROP_PREFIX_PATTERN이 \s*(공백 0회 포함)로 매칭되어 "벼"가 잘려나간다.
    const result = normalizeForSearch("벼줄무늬잎마름병", "벼");
    expect(result.keyword).toBe("줄무늬잎마름병"); // 실제 동작 — 의도한 결과인지는 불확실 (PR 본문 참고)
  });
});
