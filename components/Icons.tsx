// 앱 공용 일러스트 아이콘 (홈 HomeIllustrations 톤 — 플랫·파스텔 SVG, 이모지 대체)
// 모두 24x24 viewBox, className으로 크기 지정 (예: "w-6 h-6")

type P = { className?: string };
const svg = (className?: string) => ({
  viewBox: "0 0 24 24",
  className,
  fill: "none" as const,
  xmlns: "http://www.w3.org/2000/svg",
});

/** 온도 — 온도계 */
export function TempIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M10 13.4V6.4a2 2 0 1 1 4 0v7a4 4 0 1 1-4 0Z" fill="#FBE2E2" stroke="#F08080" strokeWidth="1.6" />
      <circle cx="12" cy="17.1" r="2.4" fill="#F08080" />
      <rect x="11" y="9.6" width="2" height="7" rx="1" fill="#F08080" />
    </svg>
  );
}

/** 습도 — 물방울 */
export function HumidityIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M12 4c2.8 3.8 5 6.2 5 8.8a5 5 0 1 1-10 0C7 10.2 9.2 7.8 12 4Z" fill="#DBEAFB" stroke="#4A90E2" strokeWidth="1.6" />
      <path d="M9.4 13.2a2.7 2.7 0 0 0 2 2.6" stroke="#4A90E2" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** 토양수분 — 흙에서 자라는 새싹 */
export function SoilIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M12 18.5v-6" stroke="#3FA876" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 13c-.6-2.4-2.7-3.2-4.5-3 .1 2.5 2.1 3.7 4.5 3Z" fill="#5DBE8B" />
      <path d="M12 13c.6-2.7 2.8-3.6 4.7-3.4-.1 2.7-2.2 4-4.7 3.4Z" fill="#4CAF82" />
      <path d="M6.4 18.5h11.2" stroke="#D8945C" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** 카메라 */
export function CameraIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <rect x="3" y="7.5" width="18" height="12.5" rx="3.2" fill="#E4F1E9" stroke="#3FA876" strokeWidth="1.6" />
      <path d="M8.6 7.5l1-2a1 1 0 0 1 .9-.6h3a1 1 0 0 1 .9.6l1 2" fill="#E4F1E9" stroke="#3FA876" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="13.8" r="3.1" fill="#FFFFFF" stroke="#3FA876" strokeWidth="1.6" />
      <circle cx="12" cy="13.8" r="1.1" fill="#3FA876" />
    </svg>
  );
}

/** 업로드 — 사진 */
export function UploadIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <rect x="3.5" y="5" width="17" height="14" rx="3" fill="#E4F1E9" stroke="#3FA876" strokeWidth="1.6" />
      <circle cx="8.6" cy="9.8" r="1.6" fill="#FFC93C" />
      <path d="M5.3 16.6l3.6-3.6 2.7 2.4 3.3-3.4 3.6 3.6v.4a1 1 0 0 1-1 1H6.3a1 1 0 0 1-1-1Z" fill="#5DBE8B" />
    </svg>
  );
}

/** 진단 — 돋보기 + 잎 */
export function SearchIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <circle cx="10.5" cy="10.5" r="6.3" fill="#E4F1E9" stroke="#3FA876" strokeWidth="1.7" />
      <path d="M15.4 15.4L20 20" stroke="#3FA876" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.6 7.8c-1.5.1-2.6 1.3-2.6 2.8 1.5 0 2.7-1.2 2.6-2.8Z" fill="#5DBE8B" />
      <path d="M10.6 7.8c1.5.1 2.6 1.3 2.6 2.8-1.5 0-2.7-1.2-2.6-2.8Z" fill="#4CAF82" />
    </svg>
  );
}

/** 식물생장 LED — 전구 */
export function BulbIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M12 3.2a5.6 5.6 0 0 0-3.3 10.1c.5.4.8 1 .8 1.6v.3h5v-.3c0-.6.3-1.2.8-1.6A5.6 5.6 0 0 0 12 3.2Z" fill="#FFF1C9" stroke="#EBA400" strokeWidth="1.5" />
      <rect x="9.5" y="16.4" width="5" height="2" rx="1" fill="#A6B0BC" />
      <rect x="10.2" y="18.8" width="3.6" height="1.6" rx="0.8" fill="#A6B0BC" />
    </svg>
  );
}

/** 환풍기 — 팬 */
export function FanIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      {[0, 90, 180, 270].map((a) => (
        <path key={a} transform={`rotate(${a} 12 12)`} d="M12 12c0-2.4.5-4.6 1.9-4.6 1.3 0 1.7 2 1 4.6Z" fill="#9FD9C0" />
      ))}
      <circle cx="12" cy="12" r="2" fill="#3FA876" />
    </svg>
  );
}

/** 잎 — 일반 식물 */
export function LeafIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M5.5 18.5C5.5 11 11 5.5 18.5 5.5c0 7.5-5.5 13-13 13Z" fill="#5DBE8B" />
      <path d="M6 18C9.5 14.5 13 11 16.5 8.5" stroke="#2E9E76" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** 딸기 */
export function StrawberryIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M12 21c-3.6 0-6.6-2.9-6.6-6.4 0-2.6 2.7-4.6 6.6-4.6s6.6 2 6.6 4.6C18.6 18.1 15.6 21 12 21Z" fill="#F0607A" />
      <path d="M12 10.2c-1.6-1.4-1.1-3.6 0-4.7 1.1 1.1 1.6 3.3 0 4.7Z" fill="#5DBE8B" />
      <g fill="#FFE08A">
        <circle cx="9.6" cy="14" r="0.7" /><circle cx="12" cy="13.4" r="0.7" /><circle cx="14.4" cy="14" r="0.7" />
        <circle cx="10.6" cy="16.4" r="0.7" /><circle cx="13.4" cy="16.4" r="0.7" /><circle cx="12" cy="18.2" r="0.7" />
      </g>
    </svg>
  );
}
