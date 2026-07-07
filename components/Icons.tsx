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

/** 체크 — OK 상태 */
export function CheckIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M5 12l4 4 10-10" stroke="#4ECAA0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="10" fill="none" stroke="#4ECAA0" strokeWidth="1.5" />
    </svg>
  );
}

/** 시설하우스 — 집 */
export function HouseIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M4 12.8v6.2a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5v-6.2" fill="none" stroke="#F0A86B" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M2.5 10.5l9.5-6.5 9.5 6.5" fill="none" stroke="#F0A86B" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="10" y="15.5" width="4" height="4.5" rx="0.8" fill="#E8D6B8" stroke="#F0A86B" strokeWidth="1.3" />
    </svg>
  );
}

/** 노지 — 들판 */
export function FieldIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M3 16h18" stroke="#9DBD6D" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 16v-4c0-1 1-2 2-2h2V4" stroke="#5DBE8B" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 16v-3c0-1 1-1.5 2-1.5h2v-4" stroke="#5DBE8B" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 12l2 2" stroke="#4ECAA0" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M15 14l2 2" stroke="#4ECAA0" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** 혼합 — 화살표 순환 */
export function MixedIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M7.5 5C5 5 3 7 3 9.5v5C3 17 5 19 7.5 19H17" fill="none" stroke="#9F7C6D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 19c2.5 0 4.5-2 4.5-4.5v-5c0-2.5-2-4.5-4.5-4.5H7" fill="none" stroke="#9F7C6D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 15l2-2-2-2" fill="none" stroke="#9F7C6D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9l-2 2 2 2" fill="none" stroke="#9F7C6D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 농부 — 밀짚모자 얼굴 (마이페이지 프로필 아바타) */
export function FarmerIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <circle cx="12" cy="13.2" r="5.2" fill="#FBE2C0" stroke="#D8945C" strokeWidth="1.4" />
      <path d="M5.2 11.6c0-3 3-5.4 6.8-5.4s6.8 2.4 6.8 5.4c0 .5-.5.8-1 .6-3.7-1.4-7.9-1.4-11.6 0-.5.2-1-.1-1-.6Z" fill="#EBA400" stroke="#B87A2E" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M9 13.4c.2.9.9 1.5 1.8 1.5s1.6-.6 1.8-1.5" stroke="#B87A2E" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** 기록 — 클립보드 (진단 기록 목록) */
export function RecordIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <rect x="4.5" y="4.5" width="15" height="17" rx="2.4" fill="#E4F1E9" stroke="#3FA876" strokeWidth="1.6" />
      <rect x="8.6" y="3" width="6.8" height="3.2" rx="1.2" fill="#5DBE8B" stroke="#3FA876" strokeWidth="1.3" />
      <path d="M7.8 11h8.4M7.8 14.4h8.4M7.8 17.8h5.4" stroke="#3FA876" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** 해충 — 벌레 (해충 도감 자리표시) */
export function BugIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <ellipse cx="12" cy="13.2" rx="4.6" ry="6" fill="#D9C2E8" stroke="#8E6FAE" strokeWidth="1.5" />
      <path d="M12 8.4v9.6" stroke="#8E6FAE" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9.6 5.6L8 3.8M14.4 5.6L16 3.8" stroke="#8E6FAE" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M7.6 10.4l-3-1.2M7.6 13.2h-3.4M7.8 16.4l-3 1.4" stroke="#8E6FAE" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M16.4 10.4l3-1.2M16.4 13.2h3.4M16.2 16.4l3 1.4" stroke="#8E6FAE" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="10.1" cy="11.4" r="0.9" fill="#8E6FAE" />
      <circle cx="13.9" cy="11.4" r="0.9" fill="#8E6FAE" />
    </svg>
  );
}

/** 하트 — 즐겨찾기 (채움/빈 상태) */
export function HeartIcon({ className, filled = true }: P & { filled?: boolean }) {
  return (
    <svg {...svg(className)}>
      <path
        d="M12 20.2c-4.6-3-8-6.2-8-9.9a4.7 4.7 0 0 1 8-3.3 4.7 4.7 0 0 1 8 3.3c0 3.7-3.4 6.9-8 9.9Z"
        fill={filled ? "#F0607A" : "none"}
        stroke={filled ? "#E0506A" : "#B9B9B4"}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 별 — 즐겨찾기 표시 */
export function StarIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path
        d="M12 3.6l2.5 5.2 5.6.8-4.1 4 1 5.7-5-2.7-5 2.7 1-5.7-4.1-4 5.6-.8Z"
        fill="#FFC93C"
        stroke="#EBA400"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 달력 — 심은 날짜 */
export function CalendarIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.4" fill="#E4F1E9" stroke="#3FA876" strokeWidth="1.6" />
      <path d="M3.5 9.4h17" stroke="#3FA876" strokeWidth="1.6" />
      <path d="M8 3.4v3.2M16 3.4v3.2" stroke="#3FA876" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8.2" cy="13.2" r="1.1" fill="#5DBE8B" />
      <circle cx="12" cy="13.2" r="1.1" fill="#5DBE8B" />
      <circle cx="8.2" cy="16.6" r="1.1" fill="#5DBE8B" />
    </svg>
  );
}

/** 메모 — 노트 */
export function NoteIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M5.5 3.6h9.4L18.5 7.6v12.8a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1V4.6a1 1 0 0 1 1-1Z" fill="#FFF7E0" stroke="#D8945C" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14.9 3.6v3.6a.4.4 0 0 0 .4.4h3.2" fill="none" stroke="#D8945C" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7.6 12h8.2M7.6 15.2h8.2M7.6 18h5.2" stroke="#D8945C" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** 알림 — 종 */
export function BellIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path
        d="M12 3.6a5.4 5.4 0 0 0-5.4 5.4v2.6c0 1-.4 1.9-1.1 2.6l-.6.6c-.6.6-.2 1.7.7 1.7h13.8c.9 0 1.3-1.1.7-1.7l-.6-.6a3.7 3.7 0 0 1-1.1-2.6V9a5.4 5.4 0 0 0-5.4-5.4Z"
        fill="#FFF1C9" stroke="#EBA400" strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M9.8 19.4a2.3 2.3 0 0 0 4.4 0" stroke="#EBA400" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** 도감 — 책 */
export function BookIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M4 4.8a1.4 1.4 0 0 1 1.4-1.2H11v16.8H5.4A1.4 1.4 0 0 1 4 19Z" fill="#E4F1E9" stroke="#3FA876" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M20 4.8a1.4 1.4 0 0 0-1.4-1.2H13v16.8h5.6A1.4 1.4 0 0 0 20 19Z" fill="#D6ECE0" stroke="#3FA876" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 3.6v16.8" stroke="#3FA876" strokeWidth="1.3" />
    </svg>
  );
}

/** 정보 — 막대그래프 */
export function ChartIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <rect x="4" y="13.5" width="4" height="6.5" rx="1" fill="#9FD9C0" />
      <rect x="10" y="9" width="4" height="11" rx="1" fill="#5DBE8B" />
      <rect x="16" y="4.5" width="4" height="15.5" rx="1" fill="#3FA876" />
    </svg>
  );
}

/** 새싹 — 병해 없음/양호 상태 표시 */
export function SproutIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M12 20v-8.4" stroke="#3FA876" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 11.6c-.7-3-3.2-4-5.4-3.7.1 3 2.5 4.4 5.4 3.7Z" fill="#5DBE8B" />
      <path d="M12 11.6c.7-3.4 3.4-4.5 5.6-4.1-.1 3.3-2.6 4.8-5.6 4.1Z" fill="#4CAF82" />
    </svg>
  );
}

/** 인사 — 손 흔들기 */
export function WaveIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path
        d="M8.4 12.4V6.2a1.5 1.5 0 0 1 3 0v4.6M11.4 10.4V4.6a1.5 1.5 0 0 1 3 0v6.2M14.4 10.6V6.4a1.5 1.5 0 0 1 3 0v7.4c0 3.6-2.3 6.6-6 6.6-2.3 0-3.7-.9-4.9-2.6l-2.6-3.7c-.5-.8.3-1.8 1.2-1.4l2.3 1.1"
        fill="#FBE2C0" stroke="#D8945C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** 위치 — 핀 */
export function PinIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M12 21c-3.6-4-6-7.2-6-10.4a6 6 0 1 1 12 0c0 3.2-2.4 6.4-6 10.4Z" fill="#DBEAFB" stroke="#4A90E2" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="10.4" r="2.2" fill="#4A90E2" />
    </svg>
  );
}

/** 경고 — 삼각형 느낌표 */
export function WarningIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M12 3.8 21.2 19.4H2.8Z" fill="#FFEAC2" stroke="#EBA400" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="11.1" y="9.6" width="1.8" height="5.2" rx="0.9" fill="#D98A00" />
      <circle cx="12" cy="16.6" r="1.1" fill="#D98A00" />
    </svg>
  );
}

/** 축하 — 색종이 */
export function PartyIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M5 19 8.2 8.6a1 1 0 0 1 1.7-.4l6 6a1 1 0 0 1-.4 1.7Z" fill="#E4F1E9" stroke="#3FA876" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="17.5" cy="4.8" r="1.1" fill="#FFC93C" />
      <circle cx="20.2" cy="9.4" r="1" fill="#F0607A" />
      <circle cx="15.3" cy="8.2" r="0.9" fill="#4A90E2" />
      <path d="M9.4 15.6l1.8-1.8" stroke="#3FA876" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** 긴급 경보 — 사이렌 */
export function AlertIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M6.4 13.2a5.6 5.6 0 0 1 11.2 0v3.4H6.4Z" fill="#FBE2E2" stroke="#E05757" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="4.6" y="16.6" width="14.8" height="2.2" rx="1.1" fill="#E05757" />
      <path d="M12 4v2.4M6 6.4l1.3 1.3M18 6.4l-1.3 1.3" stroke="#E05757" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** AI 로봇 */
export function RobotIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <rect x="5" y="9.4" width="14" height="10" rx="3" fill="#E4F1E9" stroke="#3FA876" strokeWidth="1.6" />
      <path d="M12 9.4V6.2" stroke="#3FA876" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="4.8" r="1.4" fill="#5DBE8B" stroke="#3FA876" strokeWidth="1.2" />
      <circle cx="9.4" cy="14" r="1.3" fill="#3FA876" />
      <circle cx="14.6" cy="14" r="1.3" fill="#3FA876" />
      <path d="M9 17.2h6" stroke="#3FA876" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3.4 12.4v3M20.6 12.4v3" stroke="#3FA876" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** 플러그 — 연결/디바이스 ID */
export function PlugIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M9 3.6v5M15 3.6v5" stroke="#4A90E2" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6.6 8.6h10.8v3.2a5.4 5.4 0 0 1-5.4 5.4 5.4 5.4 0 0 1-5.4-5.4Z" fill="#DBEAFB" stroke="#4A90E2" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 17.2v3.2" stroke="#4A90E2" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** 안테나 — 무선/네트워크 센서 */
export function AntennaIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M12 21v-9.4" stroke="#4A90E2" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 11.6 5.4 5" stroke="#4A90E2" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="11.6" r="1.7" fill="#4A90E2" />
      <path d="M8.6 8.4a5 5 0 0 1 0-7M15.4 8.4a5 5 0 0 0 0-7" stroke="#9FC7EF" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M6.4 10.6a8 8 0 0 1 0-11.2M17.6 10.6a8 8 0 0 0 0-11.2" stroke="#C7E0F7" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** 플라스크 — 데모/시뮬레이션 */
export function FlaskIcon({ className }: P) {
  return (
    <svg {...svg(className)}>
      <path d="M10 3.6h4M10.6 3.6v5.6l-4.4 8a1.6 1.6 0 0 0 1.4 2.4h8.8a1.6 1.6 0 0 0 1.4-2.4l-4.4-8V3.6" fill="#E4F1E9" stroke="#3FA876" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7.8 14.6h8.4" stroke="#3FA876" strokeWidth="1.4" />
      <circle cx="10.4" cy="17" r="0.8" fill="#5DBE8B" />
      <circle cx="13.2" cy="17.8" r="0.7" fill="#4CAF82" />
    </svg>
  );
}
