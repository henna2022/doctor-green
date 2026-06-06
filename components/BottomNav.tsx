"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ScanLine, Leaf, LayoutGrid } from "lucide-react";

const TABS = [
  { href: "/home", Icon: Home, label: "홈" },
  { href: "/diagnose", Icon: ScanLine, label: "진단" },
  { href: "/crops", Icon: Leaf, label: "작물 관리" },
  { href: "/mypage", Icon: LayoutGrid, label: "마이 페이지" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-shrink-0 pt-2.5 pb-4 px-0"
      style={{ background: "#7C9A82" }}
    >
      {TABS.map(({ href, Icon, label }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center gap-[3px] py-0.5 transition-colors"
            style={{ color: isActive ? "#fff" : "rgba(255,255,255,.5)" }}
          >
            <Icon size={22} strokeWidth={2} />
            <span className={`text-[10px] ${isActive ? "font-bold" : ""}`}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}