// 홈 "알아보기" 카드용 플랫 일러스트 (원본 디자인 톤에 맞춘 미니멀 SVG)

type IllustProps = { className?: string };

/** 질병 도감 — 화분에 심긴 새싹 */
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

/** 해충 도감 — 애벌레 */
export function CaterpillarIcon({ className }: IllustProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 다리 */}
      {[18, 26, 34, 42].map((x) => (
        <line key={x} x1={x} y1="46" x2={x} y2="50" stroke="#7CB342" strokeWidth="2" strokeLinecap="round" />
      ))}
      {/* 몸통 */}
      <circle cx="16" cy="42" r="7" fill="#A5D26B" />
      <circle cx="25" cy="40" r="7.6" fill="#9CCC65" />
      <circle cx="34" cy="41" r="7.6" fill="#A5D26B" />
      <circle cx="43" cy="38" r="8" fill="#9CCC65" />
      {/* 점무늬 */}
      <circle cx="25" cy="40" r="1.8" fill="#7CB342" />
      <circle cx="34" cy="41" r="1.8" fill="#7CB342" />
      <circle cx="43" cy="38" r="1.8" fill="#7CB342" />
      {/* 머리 */}
      <circle cx="50" cy="33" r="9" fill="#8BC34A" />
      {/* 더듬이 */}
      <path d="M47 25C45 20 44 18 43 16.5" stroke="#7CB342" strokeWidth="2" strokeLinecap="round" />
      <circle cx="43" cy="15.5" r="1.7" fill="#7CB342" />
      <path d="M53 25C53 20 53 18 53.5 16" stroke="#7CB342" strokeWidth="2" strokeLinecap="round" />
      <circle cx="53.5" cy="15" r="1.7" fill="#7CB342" />
      {/* 눈 */}
      <circle cx="49" cy="32" r="2.2" fill="#33691E" />
      <circle cx="54" cy="33.5" r="2.2" fill="#33691E" />
    </svg>
  );
}

/** 방제 정보 — 구급상자 */
export function FirstAidIcon({ className }: IllustProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 손잡이 */}
      <rect x="26" y="16" width="12" height="7" rx="3" fill="#B8B8B8" />
      <rect x="28.5" y="18.5" width="7" height="3" rx="1.5" fill="#DADADA" />
      {/* 상자 */}
      <rect x="12" y="22" width="40" height="30" rx="5" fill="#CFCFCF" />
      <rect x="12" y="22" width="40" height="6.5" rx="5" fill="#C2C2C2" />
      {/* 십자 */}
      <rect x="29" y="29" width="6" height="16" rx="2" fill="#4CAF50" />
      <rect x="24" y="34" width="16" height="6" rx="2" fill="#4CAF50" />
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
