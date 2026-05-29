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

export interface DodamDetail {
  sickKey: string;
  name: string;
  nameEn?: string;
  nameSci?: string;
  cropName?: string;
  
  // 상세 정보
  symptoms?: string;        // 증상
  cause?: string;           // 발생 원인/환경
  prevention?: string;      // 예방 방법
  
  // 방제 방법
  chemicalControl?: string; // 화학적 방제
  biologicalControl?: string; // 생물학적 방제
  culturalControl?: string;  // 경종적 방제
  
  // 이미지
  imageUrls?: string[];
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

// 병해충 상세 조회
export async function getDodamDetail(sickKey: string): Promise<DodamDetail | null> {
  try {
    const res = await fetch(`/api/ncpms/detail?sickKey=${encodeURIComponent(sickKey)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("getDodamDetail error:", e);
    return null;
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