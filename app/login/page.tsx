"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  
  // 폼 상태 관리
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    
    // 간단한 검증
    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해주세요");
      return;
    }
    
    setLoading(true);
    
    // TODO: Supabase 연결은 다음 단계에서
    // 일단 임시로 1초 후 홈으로 이동
    setTimeout(() => {
      alert("로그인 기능은 Supabase 연결 후 작동해요!\n이메일: " + email);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="phone-frame">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-brd">
        <Link href="/" className="text-2xl">‹</Link>
        <h1 className="text-base font-bold">로그인</h1>
        <div className="w-6" /> {/* 균형용 빈 공간 */}
      </header>

      {/* 본문 */}
      <main className="flex-1 px-5 py-6">
        <h2 className="text-2xl font-extrabold mb-2 tracking-tight">
          다시 오신 걸 환영해요 👋
        </h2>
        <p className="text-sm text-txt2 mb-8">
          계정에 로그인하고 농장을 관리하세요
        </p>

        {/* 이메일 입력 */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-txt2 mb-1.5">
            이메일
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            autoComplete="email"
            className="w-full px-3.5 py-3 border-2 border-brd rounded-xl
                       text-sm bg-bg-card focus:border-g3 outline-none transition"
          />
        </div>

        {/* 비밀번호 입력 */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-txt2 mb-1.5">
            비밀번호
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            autoComplete="current-password"
            className="w-full px-3.5 py-3 border-2 border-brd rounded-xl
                       text-sm bg-bg-card focus:border-g3 outline-none transition"
          />
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-3 px-3 py-2.5 bg-red/10 border border-red 
                          rounded-lg text-sm text-red">
            {error}
          </div>
        )}

        {/* 로그인 버튼 */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-g1 text-white font-bold
                     hover:bg-g2 disabled:opacity-50 transition mb-6"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>

        {/* 구분선 */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-brd" />
          <span className="text-xs text-txt2">아직 계정이 없으신가요?</span>
          <div className="flex-1 h-px bg-brd" />
        </div>

        {/* 회원가입 링크 */}
        <Link
          href="/signup"
          className="block w-full py-3.5 rounded-2xl border-2 border-g1 
                     text-g1 font-bold text-center hover:bg-g5 transition"
        >
          회원가입
        </Link>
      </main>
    </div>
  );
}