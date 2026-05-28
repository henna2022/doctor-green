"use client";

import Link from "next/link";

interface PageHeaderProps {
  title: string;
  backHref?: string;      // 뒤로 가기 링크 (선택)
  rightAction?: React.ReactNode;  // 오른쪽 버튼 (선택)
}

export default function PageHeader({ title, backHref, rightAction }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between px-5 py-4 
                       border-b border-brd sticky top-0 bg-bg-main z-10">
      {/* 왼쪽: 뒤로가기 또는 빈 공간 */}
      {backHref ? (
        <Link href={backHref} className="text-2xl">‹</Link>
      ) : (
        <div className="w-6" />
      )}

      {/* 중앙: 제목 */}
      <h1 className="text-base font-bold">{title}</h1>

      {/* 오른쪽: 액션 버튼 또는 빈 공간 */}
      {rightAction || <div className="w-6" />}
    </header>
  );
}