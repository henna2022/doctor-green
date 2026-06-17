// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 도감 데이터 (NCPMS API)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface DodamItem {
  sickKey: string;       // 병해충 코드 (상세 조회용)
  name: string;          // 한글명
  nameEn?: string;       // 영문명
  nameSci?: string;      // 학명
  crop: string;          // 대상 작물
  imageUrl?: string;     // 대표 이미지
}

// 도감 종류
export type DodamType = "disease" | "pest";

// ━━━ API 호출 함수 ━━━

// 작물별 병해충 목록 검색
export async function searchDodam(
  type: DodamType,
  cropName?: string,
  keyword?: string
): Promise<DodamItem[]> {
  try {
    const params = new URLSearchParams();
    params.set("type", type);
    if (cropName) params.set("cropName", cropName);
    if (keyword) params.set("keyword", keyword);

    const res = await fetch(`/api/ncpms/search?${params.toString()}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error("searchDodam error:", e);
    return [];
  }
}

// 작물 옵션 (필터용)
export const DODAM_CROPS = [
  { emoji: "🍅", name: "토마토" },
  { emoji: "🌶️", name: "고추" },
  { emoji: "🍓", name: "딸기" },
  { emoji: "🥒", name: "오이" },
  { emoji: "🍑", name: "복숭아" },
  { emoji: "🍎", name: "사과" },
  { emoji: "🥬", name: "배추" },
  { emoji: "🌾", name: "벼" },
  { emoji: "🧄", name: "마늘" },
  { emoji: "🧅", name: "양파" },
];