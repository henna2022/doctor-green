"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth";
import { LeafIcon, StrawberryIcon, HouseIcon, FieldIcon, MixedIcon } from "@/components/Icons";
import { CROP_CATALOG as CROP_OPTIONS } from "@/lib/cropCatalog";

const FARM_TYPES = [
  { emoji: "🏠", name: "시설하우스" },
  { emoji: "🌾", name: "노지" },
  { emoji: "🔄", name: "혼합" },
];

export default function SignupPage() {
  const router = useRouter();

  // 필수 정보
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 선택 정보
  const [region, setRegion] = useState("");
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [farmType, setFarmType] = useState<string | null>(null);

  // UI 상태
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const getCropIcon = (name: string) => {
    if (name === "딸기") return StrawberryIcon;
    return LeafIcon;
  };

  const getFarmTypeIcon = (name: string) => {
    if (name === "시설하우스") return HouseIcon;
    if (name === "노지") return FieldIcon;
    if (name === "혼합") return MixedIcon;
    return HouseIcon;
  };

  const toggleCrop = (crop: string) => {
    if (selectedCrops.includes(crop)) {
      setSelectedCrops(selectedCrops.filter((c) => c !== crop));
    } else {
      setSelectedCrops([...selectedCrops, crop]);
    }
  };

  const handleSignup = async () => {
    setError("");

    if (!name || !email || !password) {
      setError("이름, 이메일, 비밀번호는 필수입니다");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다");
      return;
    }

    setLoading(true);

    const result = await signUp({
      name,
      email,
      password,
      region,
      crops: selectedCrops,
      farmType,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // 가입 성공 → 홈으로
    router.push("/home");
  };

  return (
    <div className="phone-frame">
      <header className="flex items-center justify-between px-5 py-4 border-b border-brd sticky top-0 bg-bg-main z-10">
        <Link href="/" className="text-2xl">‹</Link>
        <h1 className="text-base font-bold">회원가입</h1>
        <div className="w-6" />
      </header>

      <main className="flex-1 px-5 py-6">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-2xl font-extrabold tracking-tight">
            닥터 그린과 함께
          </h2>
          <LeafIcon className="w-7 h-7" />
        </div>
        <p className="text-sm text-txt2 mb-6">
          몇 가지 정보만 입력하면 바로 시작할 수 있어요
        </p>

        {/* 기본 정보 */}
        <div className="mb-6">
          <h3 className="text-sm font-bold mb-3">
            기본 정보 <span className="text-red">*</span>
          </h3>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-txt2 mb-1.5">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              className="w-full px-3.5 py-3 border-2 border-brd rounded-xl text-sm bg-bg-card focus:border-g3 outline-none transition"
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-txt2 mb-1.5">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              autoComplete="email"
              className="w-full px-3.5 py-3 border-2 border-brd rounded-xl text-sm bg-bg-card focus:border-g3 outline-none transition"
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-txt2 mb-1.5">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상 입력"
              autoComplete="new-password"
              className="w-full px-3.5 py-3 border-2 border-brd rounded-xl text-sm bg-bg-card focus:border-g3 outline-none transition"
            />
            <p className="text-xs text-txt3 mt-1">영문, 숫자 조합 6자 이상</p>
          </div>
        </div>

        {/* 농장 정보 */}
        <div className="mb-6 pt-4 border-t border-brd">
          <h3 className="text-sm font-bold mb-1">
            농장 정보 <span className="text-xs font-normal text-txt3">(선택)</span>
          </h3>
          <p className="text-xs text-txt3 mb-3">맞춤 알림과 추천을 받을 수 있어요</p>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-txt2 mb-1.5">농장 지역</label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="예: 경기도 안성시"
              className="w-full px-3.5 py-3 border-2 border-brd rounded-xl text-sm bg-bg-card focus:border-g3 outline-none transition"
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-txt2 mb-1.5">주요 재배 작물</label>
            <div className="flex flex-wrap gap-1.5">
              {CROP_OPTIONS.map((crop) => {
                const isActive = selectedCrops.includes(crop.name);
                const CropIcon = getCropIcon(crop.name);
                return (
                  <button
                    key={crop.name}
                    type="button"
                    onClick={() => toggleCrop(crop.name)}
                    className={`px-3 py-2 rounded-full border-2 text-xs transition flex items-center gap-1.5 ${
                      isActive
                        ? "bg-g5 border-g3 text-g1 font-bold"
                        : "border-brd text-txt2 bg-bg-card"
                    }`}
                  >
                    <CropIcon className="w-4 h-4" />
                    {crop.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-txt2 mb-1.5">농장 형태</label>
            <div className="grid grid-cols-3 gap-2">
              {FARM_TYPES.map((type) => {
                const isActive = farmType === type.name;
                const FarmIcon = getFarmTypeIcon(type.name);
                return (
                  <button
                    key={type.name}
                    type="button"
                    onClick={() => setFarmType(type.name)}
                    className={`py-3 px-2 rounded-xl border-2 text-xs transition flex flex-col items-center ${
                      isActive
                        ? "bg-g5 border-g3 text-g1 font-bold"
                        : "border-brd text-txt2 bg-bg-card"
                    }`}
                  >
                    <FarmIcon className="w-6 h-6 mb-1" />
                    {type.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2.5 bg-red/10 border border-red rounded-lg text-sm text-red">
            {error}
          </div>
        )}

        <button
          onClick={handleSignup}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-g1 text-white font-bold hover:bg-g2 disabled:opacity-50 transition mb-4"
        >
          {loading ? "가입 중..." : "가입하고 시작하기"}
        </button>

        <p className="text-center text-xs text-txt3 leading-relaxed">
          가입하면 <span className="text-g2">서비스 이용약관</span>과<br />
          <span className="text-g2">개인정보처리방침</span>에 동의하는 것으로 간주됩니다
        </p>
      </main>
    </div>
  );
}