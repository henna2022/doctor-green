"use client";

import Link from "next/link";
import { useState } from "react";

// 작물 옵션 (이모지 + 이름)
const CROP_OPTIONS = [
  { emoji: "🍅", name: "토마토" },
  { emoji: "🌶️", name: "고추" },
  { emoji: "🍓", name: "딸기" },
  { emoji: "🥒", name: "오이" },
  { emoji: "🍑", name: "복숭아" },
  { emoji: "🍎", name: "사과" },
  { emoji: "🥬", name: "배추" },
  { emoji: "🌾", name: "기타" },
];

// 농장 형태 옵션
const FARM_TYPES = [
  { emoji: "🏠", name: "시설하우스" },
  { emoji: "🌾", name: "노지" },
  { emoji: "🔄", name: "혼합" },
];

export default function SignupPage() {
  // 필수 정보
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // 선택 정보 (농장 정보)
  const [region, setRegion] = useState("");
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [farmType, setFarmType] = useState<string | null>(null);
  
  // UI 상태
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 작물 칩 토글
  const toggleCrop = (crop: string) => {
    if (selectedCrops.includes(crop)) {
      // 이미 선택돼있으면 제거
      setSelectedCrops(selectedCrops.filter((c) => c !== crop));
    } else {
      // 없으면 추가
      setSelectedCrops([...selectedCrops, crop]);
    }
  };

  // 회원가입 처리
  const handleSignup = async () => {
    setError("");

    // 필수 입력 검증
    if (!name || !email || !password) {
      setError("이름, 이메일, 비밀번호는 필수입니다");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다");
      return;
    }

    setLoading(true);

    // TODO: Supabase 연결은 다음 단계에서
    setTimeout(() => {
      alert(
        `회원가입 정보 (Supabase 연결 후 실제 가입됩니다):\n\n` +
        `이름: ${name}\n` +
        `이메일: ${email}\n` +
        `지역: ${region || "미입력"}\n` +
        `작물: ${selectedCrops.join(", ") || "미선택"}\n` +
        `형태: ${farmType || "미선택"}`
      );
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="phone-frame">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-brd sticky top-0 bg-bg-main z-10">
        <Link href="/" className="text-2xl">‹</Link>
        <h1 className="text-base font-bold">회원가입</h1>
        <div className="w-6" />
      </header>

      {/* 본문 */}
      <main className="flex-1 px-5 py-6">
        <h2 className="text-2xl font-extrabold mb-2 tracking-tight">
          닥터 그린과 함께 🌱
        </h2>
        <p className="text-sm text-txt2 mb-6">
          몇 가지 정보만 입력하면 바로 시작할 수 있어요
        </p>

        {/* ━━━ 기본 정보 (필수) ━━━ */}
        <div className="mb-6">
          <h3 className="text-sm font-bold mb-3">
            기본 정보 <span className="text-red">*</span>
          </h3>

          {/* 이름 */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-txt2 mb-1.5">
              이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              className="w-full px-3.5 py-3 border-2 border-brd rounded-xl
                         text-sm bg-bg-card focus:border-g3 outline-none transition"
            />
          </div>

          {/* 이메일 */}
          <div className="mb-3">
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

          {/* 비밀번호 */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-txt2 mb-1.5">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상 입력"
              autoComplete="new-password"
              className="w-full px-3.5 py-3 border-2 border-brd rounded-xl
                         text-sm bg-bg-card focus:border-g3 outline-none transition"
            />
            <p className="text-xs text-txt3 mt-1">영문, 숫자 조합 6자 이상</p>
          </div>
        </div>

        {/* ━━━ 농장 정보 (선택) ━━━ */}
        <div className="mb-6 pt-4 border-t border-brd">
          <h3 className="text-sm font-bold mb-1">
            농장 정보 <span className="text-xs font-normal text-txt3">(선택)</span>
          </h3>
          <p className="text-xs text-txt3 mb-3">
            맞춤 알림과 추천을 받을 수 있어요
          </p>

          {/* 농장 지역 */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-txt2 mb-1.5">
              농장 지역
            </label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="예: 경기도 안성시"
              className="w-full px-3.5 py-3 border-2 border-brd rounded-xl
                         text-sm bg-bg-card focus:border-g3 outline-none transition"
            />
          </div>

          {/* 작물 칩 (다중 선택) */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-txt2 mb-1.5">
              주요 재배 작물
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CROP_OPTIONS.map((crop) => {
                const isActive = selectedCrops.includes(crop.name);
                return (
                  <button
                    key={crop.name}
                    type="button"
                    onClick={() => toggleCrop(crop.name)}
                    className={`px-3 py-2 rounded-full border-2 text-xs transition
                                ${isActive
                                  ? "bg-g5 border-g3 text-g1 font-bold"
                                  : "border-brd text-txt2 bg-bg-card"
                                }`}
                  >
                    {crop.emoji} {crop.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 농장 형태 (단일 선택) */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-txt2 mb-1.5">
              농장 형태
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FARM_TYPES.map((type) => {
                const isActive = farmType === type.name;
                return (
                  <button
                    key={type.name}
                    type="button"
                    onClick={() => setFarmType(type.name)}
                    className={`py-3 px-2 rounded-xl border-2 text-xs transition
                                ${isActive
                                  ? "bg-g5 border-g3 text-g1 font-bold"
                                  : "border-brd text-txt2 bg-bg-card"
                                }`}
                  >
                    <div className="text-lg mb-1">{type.emoji}</div>
                    {type.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-3 px-3 py-2.5 bg-red/10 border border-red 
                          rounded-lg text-sm text-red">
            {error}
          </div>
        )}

        {/* 가입 버튼 */}
        <button
          onClick={handleSignup}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-g1 text-white font-bold
                     hover:bg-g2 disabled:opacity-50 transition mb-4"
        >
          {loading ? "가입 중..." : "가입하고 시작하기"}
        </button>

        {/* 약관 안내 */}
        <p className="text-center text-xs text-txt3 leading-relaxed">
          가입하면 <span className="text-g2">서비스 이용약관</span>과<br />
          <span className="text-g2">개인정보처리방침</span>에 동의하는 것으로 간주됩니다
        </p>
      </main>
    </div>
  );
}