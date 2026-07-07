"use client";

import Link from "next/link";

interface PageHeaderProps {
  title: React.ReactNode;
  backHref?: string;              // 뒤로 가기 링크 (선택)
  onBack?: () => void;            // 뒤로가기 클릭 시 추가 동작 (선택, backHref와 함께 사용)
  rightAction?: React.ReactNode;  // 오른쪽 버튼 (선택)
  leftWidthClass?: string;        // 좌우 대칭 폭 조정 (기본 w-6)
  sticky?: boolean;               // sticky top-0 여부 (기본 true)
}

export default function PageHeader({
  title,
  backHref,
  onBack,
  rightAction,
  leftWidthClass = "w-6",
  sticky = true,
}: PageHeaderProps) {
  return (
    <header
      className={`flex items-center justify-between px-5 py-4 border-b border-brd bg-bg-main z-10 ${
        sticky ? "sticky top-0" : ""
      }`}
    >
      {/* 왼쪽: 뒤로가기 또는 빈 공간 */}
      {backHref ? (
        <Link href={backHref} className="text-2xl" onClick={onBack}>‹</Link>
      ) : (
        <div className={leftWidthClass} />
      )}

      {/* 중앙: 제목 */}
      <h1 className="text-base font-bold">{title}</h1>

      {/* 오른쪽: 액션 버튼 또는 빈 공간 */}
      {rightAction || <div className={leftWidthClass} />}
    </header>
  );
}