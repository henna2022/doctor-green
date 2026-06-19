// 홈 "알아보기" 카드용 플랫 일러스트 (원본 디자인 톤에 맞춘 미니멀 SVG)

type IllustProps = { className?: string };

/** 작물 가이드 — 화분에 심긴 새싹 */
export function PlantIcon({ className }: IllustProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 화분 */}
      <path d="M21 46H43L39.5 60H24.5L21 46Z" fill="#E0A06A" />
      <rect x="18.5" y="42" width="27" height="6" rx="2" fill="#D8945C" />
      {/* 줄기 */}
      <path d="M32 45C32 38 32 28 32 19" stroke="#3FA876" strokeWidth="2.6" strokeLinecap="round" />
      {/* 잎 */}
      <ellipse cx="23.5" cy="36" rx="9" ry="4.4" fill="#5DBE8B" transform="rotate(-22 23.5 36)" />
      <ellipse cx="40.5" cy="33" rx="9" ry="4.4" fill="#4CAF82" transform="rotate(22 40.5 33)" />
      <ellipse cx="23" cy="27" rx="7.6" ry="3.9" fill="#4CAF82" transform="rotate(-33 23 27)" />
      <ellipse cx="41" cy="24" rx="7.6" ry="3.9" fill="#5DBE8B" transform="rotate(33 41 24)" />
      <ellipse cx="32" cy="16.5" rx="5" ry="9" fill="#5DBE8B" />
    </svg>
  );
}

/** 가상 실습실 — 새싹이 든 플라스크 */
export function LabIcon({ className }: IllustProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 플라스크 외형 */}
      <path
        d="M27 14V28L17 47C15.7 49.4 17.4 52.5 20.2 52.5H43.8C46.6 52.5 48.3 49.4 47 47L37 28V14"
        fill="#FFFFFF"
        stroke="#A6D8BD"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* 입구 */}
      <rect x="24.5" y="11" width="15" height="4.5" rx="2.2" fill="#7CC9A0" />
      {/* 용액 */}
      <path d="M22.5 44L41.5 44L47 47C48.3 49.4 46.6 52.5 43.8 52.5H20.2C17.4 52.5 15.7 49.4 17 47L22.5 44Z" fill="#CFEFDD" />
      {/* 새싹 */}
      <path d="M32 44C32 40 32 36 32 33" stroke="#3FA876" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="28" cy="33" rx="4.6" ry="2.4" fill="#5DBE8B" transform="rotate(-28 28 33)" />
      <ellipse cx="36" cy="31.5" rx="4.6" ry="2.4" fill="#4CAF82" transform="rotate(28 36 31.5)" />
      {/* 기포 */}
      <circle cx="27" cy="48" r="1.4" fill="#7CC9A0" />
      <circle cx="35" cy="49" r="1.1" fill="#7CC9A0" />
    </svg>
  );
}

/** 실시간 분석 — 카메라/스캐너 */
export function RealtimeIcon({ className }: IllustProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 그린 탭 */}
      <rect x="12" y="20" width="16" height="9" rx="3" fill="#7CC9A0" transform="rotate(-15 20 24.5)" />
      {/* 본체 */}
      <rect x="18" y="26" width="32" height="22" rx="6" fill="#FFFFFF" stroke="#A6D8BD" strokeWidth="2.5" />
      {/* 렌즈/화면 */}
      <rect x="27.5" y="32.5" width="13" height="9" rx="2.5" fill="#3E4A45" />
      {/* 표시등 */}
      <circle cx="45" cy="44" r="1.7" fill="#E05B4F" />
    </svg>
  );
}
