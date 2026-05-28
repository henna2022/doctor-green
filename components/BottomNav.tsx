"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 탭 정의
const TABS = [
  { href: "/home", icon: "🏠", label: "홈" },
  { href: "/diagnose", icon: "📷", label: "진단" },
  { href: "/crops", icon: "🌱", label: "작물 관리" },
  { href: "/mypage", icon: "👤", label: "마이 페이지" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 left-0 right-0 bg-bg-card border-t border-brd
                    flex justify-around items-center py-2 px-2 z-20">
      {TABS.map((tab) => {
        // 현재 경로와 일치하면 활성화 스타일
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
        
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg
                        transition ${isActive ? "text-g1" : "text-txt3"}`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className={`text-[10px] ${isActive ? "font-bold" : ""}`}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}