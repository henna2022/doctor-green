// ━━━ 작물 카탈로그 (이름 + 이모지) 단일 소스 ━━━
// signup/crops/mypage 드롭다운, cropGuide 라벨, diagnose 병명 접두어 제거 등에서 공용으로 사용.
// 기존에 각 파일이 따로 들고 있던 목록의 합집합 — 항목 출처는 아래 표 참고.
//
// | 이름   | 이모지 | 원래 있던 곳                                  |
// |--------|--------|-----------------------------------------------|
// | 토마토 | 🍅     | signup/crops/mypage, cropGuide, diagnose 등    |
// | 고추   | 🌶️     | signup/crops/mypage, cropGuide, diagnose 등    |
// | 딸기   | 🍓     | signup/crops/mypage, cropGuide, diagnose 등    |
// | 오이   | 🥒     | signup/crops/mypage, cropGuide, diagnose 등    |
// | 복숭아 | 🍑     | signup/crops/mypage, diagnose 등 (cropGuide 없음) |
// | 사과   | 🍎     | signup/crops/mypage, diagnose 등 (cropGuide 없음) |
// | 배추   | 🥬     | signup/crops/mypage, diagnose 등 (cropGuide 없음) |
// | 상추   | 🥬     | cropGuide만 (다른 곳엔 없었음, 배추와 이모지 중복) |
// | 바질   | 🌿     | cropGuide만 (다른 곳엔 없었음)                 |
// | 벼     | 🌾     | diagnose 등만 (signup/crops/mypage엔 없었음)   |
// | 마늘   | 🧄     | diagnose 등만 (signup/crops/mypage엔 없었음)   |
// | 양파   | 🧅     | diagnose 등만 (signup/crops/mypage엔 없었음)   |
// | 기타   | 🌾     | signup/crops/mypage만 (실제 작물명 아님, 벼와 이모지 중복) |

export interface CropCatalogEntry {
  name: string;
  emoji: string;
}

export const CROP_CATALOG: CropCatalogEntry[] = [
  { name: "토마토", emoji: "🍅" },
  { name: "고추", emoji: "🌶️" },
  { name: "딸기", emoji: "🍓" },
  { name: "오이", emoji: "🥒" },
  { name: "복숭아", emoji: "🍑" },
  { name: "사과", emoji: "🍎" },
  { name: "배추", emoji: "🥬" },
  { name: "상추", emoji: "🥬" },
  { name: "바질", emoji: "🌿" },
  { name: "벼", emoji: "🌾" },
  { name: "마늘", emoji: "🧄" },
  { name: "양파", emoji: "🧅" },
  { name: "기타", emoji: "🌾" },
];

export const CROP_NAMES = CROP_CATALOG.map((c) => c.name);

export function getCropEmoji(name: string): string {
  return CROP_CATALOG.find((c) => c.name === name)?.emoji ?? "🌱";
}
