"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { getCurrentUser, signOut, updateProfile } from "@/lib/auth";
import Link from "next/dist/client/link";

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

const FARM_TYPES = [
  { emoji: "🏠", name: "시설하우스" },
  { emoji: "🌾", name: "노지" },
  { emoji: "🔄", name: "혼합" },
];

export default function MyPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [crops, setCrops] = useState<string[]>([]);
  const [farmType, setFarmType] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user) {
        router.push("/");
        return;
      }
      setEmail(user.email || "");
      setName(user.profile?.name || "");
      setRegion(user.profile?.farm_region || "");
      setCrops(user.profile?.farm_crops || []);
      setFarmType(user.profile?.farm_type || null);
      setLoading(false);
    }
    load();
  }, [router]);

  const toggleCrop = (crop: string) => {
    if (crops.includes(crop)) {
      setCrops(crops.filter((c) => c !== crop));
    } else {
      setCrops([...crops, crop]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg("");
    const result = await updateProfile({ name, region, crops, farmType });
    if (result.error) {
      setSaveMsg("저장 실패: " + result.error);
    } else {
      setSaveMsg("저장되었습니다 ✓");
      setEditing(false);
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(""), 2000);
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="phone-frame items-center justify-center">
        <p className="text-txt2 text-sm">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="phone-frame">
      <header className="flex items-center justify-between px-5 py-4 border-b border-brd sticky top-0 bg-bg-main z-10">
        <div className="w-12" />
        <h1 className="text-base font-bold">마이 페이지</h1>
        {editing ? (
          <button onClick={handleSave} disabled={saving} className="text-sm text-g1 font-bold w-12 text-right">
            {saving ? "..." : "저장"}
          </button>
        ) : (
          <button onClick={() => setEditing(true)} className="text-sm text-g2 w-12 text-right">
            수정
          </button>
        )}
      </header>

      <main className="flex-1 px-5 py-5 pb-2">
        {/* 프로필 카드 */}
        <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl bg-g5">
          <div className="w-16 h-16 rounded-full bg-g1 flex items-center justify-center text-3xl">
            🧑‍🌾
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-g1">{name || "농부"}님</h2>
            <p className="text-xs text-txt2">{email}</p>
          </div>
        </div>

        {saveMsg && (
          <div className="mb-3 px-3 py-2 rounded-lg text-sm text-center bg-g5 text-g1 font-medium">
            {saveMsg}
          </div>
        )}

        {/* 이름 */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-txt2 mb-1.5">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!editing}
            className={`w-full px-3.5 py-3 border-2 rounded-xl text-sm transition outline-none
              ${editing ? "border-brd bg-bg-card focus:border-g3" : "border-transparent bg-bg-card text-txt2"}`}
          />
        </div>

        {/* 농장 지역 */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-txt2 mb-1.5">농장 지역</label>
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            disabled={!editing}
            placeholder={editing ? "예: 경기도 안성시" : "미설정"}
            className={`w-full px-3.5 py-3 border-2 rounded-xl text-sm transition outline-none
              ${editing ? "border-brd bg-bg-card focus:border-g3" : "border-transparent bg-bg-card text-txt2"}`}
          />
        </div>

        {/* 재배 작물 */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-txt2 mb-1.5">주요 재배 작물</label>
          {editing ? (
            <div className="flex flex-wrap gap-1.5">
              {CROP_OPTIONS.map((crop) => {
                const isActive = crops.includes(crop.name);
                return (
                  <button
                    key={crop.name}
                    type="button"
                    onClick={() => toggleCrop(crop.name)}
                    className={`px-3 py-2 rounded-full border-2 text-xs transition ${
                      isActive ? "bg-g5 border-g3 text-g1 font-bold" : "border-brd text-txt2 bg-bg-card"
                    }`}
                  >
                    {crop.emoji} {crop.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {crops.length > 0 ? (
                crops.map((c) => (
                  <span key={c} className="px-3 py-2 rounded-full bg-g5 text-g1 text-xs font-bold">
                    {c}
                  </span>
                ))
              ) : (
                <span className="text-sm text-txt3 py-2">미설정</span>
              )}
            </div>
          )}
        </div>

        {/* 농장 형태 */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-txt2 mb-1.5">농장 형태</label>
          {editing ? (
            <div className="grid grid-cols-3 gap-2">
              {FARM_TYPES.map((type) => {
                const isActive = farmType === type.name;
                return (
                  <button
                    key={type.name}
                    type="button"
                    onClick={() => setFarmType(type.name)}
                    className={`py-3 px-2 rounded-xl border-2 text-xs transition ${
                      isActive ? "bg-g5 border-g3 text-g1 font-bold" : "border-brd text-txt2 bg-bg-card"
                    }`}
                  >
                    <div className="text-lg mb-1">{type.emoji}</div>
                    {type.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-3.5 py-3 rounded-xl bg-bg-card text-sm text-txt2">
              {farmType || "미설정"}
            </div>
          )}
        </div>

        {/* 진단 기록 링크 */}
        <Link
          href="/history"
          className="flex items-center justify-between w-full py-3.5 px-4 rounded-2xl bg-bg-card border border-brd mb-3 hover:border-g3 transition"
        >
          <span className="text-sm font-bold">📋 내 진단 기록</span>
          <span className="text-txt3">›</span>
        </Link>

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          className="w-full py-3.5 rounded-2xl border-2 border-brd text-txt2 font-bold hover:bg-bg-card transition"
        >
          로그아웃
        </button>
      </main>

      <BottomNav />
    </div>
  );
}