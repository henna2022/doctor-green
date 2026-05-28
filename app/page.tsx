"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="phone-frame">
      <div 
        className="flex-1 flex flex-col items-center justify-center 
                   px-8 py-12 text-white text-center min-h-screen"
        style={{ 
          background: "linear-gradient(180deg, #1B5E4B 0%, #2D7A5F 100%)" 
        }}
      >
        {/* 로고 */}
        <div className="w-24 h-24 rounded-3xl bg-white/15 backdrop-blur-md
                        flex items-center justify-center text-6xl mb-6
                        border border-white/20">
          🌿
        </div>

        {/* 제목 */}
        <h1 className="text-4xl font-black tracking-tight mb-3">
          닥터 그린
        </h1>
        
        <p className="text-base opacity-85 leading-relaxed mb-12">
          AI 작물 주치의<br />
          스마트한 농장 관리의 시작
        </p>

        {/* 버튼들 */}
        <div className="w-full flex flex-col gap-3 max-w-sm">
          <Link 
            href="/signup"
            className="w-full py-4 rounded-2xl bg-white font-bold
                       hover:bg-gray-100 transition-colors text-center"
            style={{ color: "#1B5E4B" }}
          >
            시작하기
          </Link>
          
          <Link
            href="/login"
            className="w-full py-4 rounded-2xl border-2 border-white/40 
                       text-white font-bold hover:bg-white/10 
                       transition-colors text-center"
          >
            이미 계정이 있어요
          </Link>
        </div>
      </div>
    </div>
  );
}