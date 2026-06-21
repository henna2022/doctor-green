"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { getCurrentUser } from "@/lib/auth";
import { addCrop, getMyCrops, deleteCrop, toggleFavorite, MyCrop } from "@/lib/crops";

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

export default function CropsPage() {
  const router = useRouter();
  const [crops, setCrops] = useState<MyCrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const [newCrop, setNewCrop] = useState<{ emoji: string; name: string } | null>(null);
  const [plantedDate, setPlantedDate] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user) {
        router.push("/");
        return;
      }
      setCrops(await getMyCrops());
      setLoading(false);
    }
    load();
  }, [router]);

  const handleAdd = async () => {
    if (!newCrop) {
      alert("작물을 선택해주세요!");
      return;
    }
    setSaving(true);
    const res = await addCrop({
      cropName: newCrop.name,
      emoji: newCrop.emoji,
      plantedDate,
      memo,
    });
    if (res.error) {
      alert("저장 실패: " + res.error);
    } else {
      setCrops(await getMyCrops());
      setNewCrop(null);
      setPlantedDate("");
      setMemo("");
      setShowAdd(false);
    }
    setSaving(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("이 작물을 삭제할까요?")) return;
    await deleteCrop(id);
    setCrops(crops.filter((c) => c.id !== id));
  };

  // 하트 토글
  const handleToggleFavorite = async (e: React.MouseEvent, crop: MyCrop) => {
    e.stopPropagation(); // 카드 클릭 막기
    // 낙관적 업데이트 (UI 먼저 바꾸고 DB 호출)
    setCrops((prev) =>
      prev.map((c) => (c.id === crop.id ? { ...c, is_favorite: !c.is_favorite } : c))
    );
    await toggleFavorite(crop.id, crop.is_favorite);
    // 즐겨찾기 순서 재정렬 위해 다시 불러옴
    setCrops(await getMyCrops());
  };

  // 카드 클릭 → 상세 페이지
  const goDetail = (id: string) => {
    router.push(`/crops/${id}`);
  };

  const daysSince = (date: string | null) => {
    if (!date) return null;
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : null;
  };

  return (
    <div className="phone-frame overflow-y-auto">
      <header className="flex items-center justify-between px-5 py-4 border-b border-brd sticky top-0 bg-bg-main z-10">
        <div className="w-6" />
        <h1 className="text-base font-bold">작물 관리</h1>
        <button onClick={() => setShowAdd(true)} className="text-xl text-g1 font-bold w-6 text-right">
          +
        </button>
      </header>

      <main className="flex-1 px-5 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-g5 border-t-g1 rounded-full animate-spin mb-3" />
            <p className="text-sm text-txt3">불러오는 중...</p>
          </div>
        ) : crops.length > 0 ? (
          <div className="flex flex-col gap-3">
            {crops.map((c) => {
              const days = daysSince(c.planted_date);
              return (
                <div
                  key={c.id}
                  onClick={() => goDetail(c.id)}
                  className="text-left p-4 rounded-2xl bg-bg-soft hover:bg-[#ECECE7] transition relative cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-g5 flex items-center justify-center text-2xl shrink-0">
                      {c.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h3 className="text-base font-bold">{c.crop_name}</h3>
                        {c.is_favorite && <span className="text-xs">⭐</span>}
                      </div>
                      {c.planted_date && (
                        <p className="text-xs text-txt2">
                          심은 날: {c.planted_date}
                          {days !== null && ` · ${days}일째`}
                        </p>
                      )}
                    </div>

                    {/* 하트 즐겨찾기 */}
                    <button
                      onClick={(e) => handleToggleFavorite(e, c)}
                      className="text-2xl shrink-0 hover:scale-110 transition-transform"
                      aria-label={c.is_favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                    >
                      {c.is_favorite ? "❤️" : "🤍"}
                    </button>

                    {/* 삭제 */}
                    <button
                      onClick={(e) => handleDelete(e, c.id)}
                      className="text-txt3 text-sm shrink-0 ml-1"
                      aria-label="삭제"
                    >
                      ✕
                    </button>
                  </div>
                  {c.memo && (
                    <p className="text-sm text-txt2 bg-g5 rounded-xl px-3 py-2 leading-relaxed">
                      📝 {c.memo}
                    </p>
                  )}
                  <p className="text-xs text-txt3 mt-2 text-right">상세보기 ›</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🌱</div>
            <p className="text-sm text-txt2 mb-4">아직 등록한 작물이 없어요</p>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-block px-6 py-3 rounded-2xl bg-g1 text-white font-bold text-sm"
            >
              작물 추가하기
            </button>
          </div>
        )}
      </main>

      <BottomNav />

      {/* 작물 추가 모달 */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-[420px] bg-bg-main rounded-t-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-bg-main px-5 py-4 border-b border-brd flex items-center justify-between">
              <h2 className="text-lg font-extrabold">작물 추가</h2>
              <button onClick={() => setShowAdd(false)} className="text-2xl text-txt3">✕</button>
            </div>

            <div className="px-5 py-5">
              <label className="block text-sm font-bold mb-2">작물 선택</label>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {CROP_OPTIONS.map((crop) => {
                  const isActive = newCrop?.name === crop.name;
                  return (
                    <button
                      key={crop.name}
                      onClick={() => setNewCrop(crop)}
                      className={`px-3 py-2 rounded-full border-2 text-xs transition ${
                        isActive ? "bg-g5 border-g3 text-g1 font-bold" : "border-brd text-txt2 bg-bg-card"
                      }`}
                    >
                      {crop.emoji} {crop.name}
                    </button>
                  );
                })}
              </div>

              <label className="block text-sm font-bold mb-2">심은 날짜 (선택)</label>
              <input
                type="date"
                value={plantedDate}
                onChange={(e) => setPlantedDate(e.target.value)}
                className="w-full px-3.5 py-3 border-2 border-brd rounded-xl text-sm bg-bg-card focus:border-g3 outline-none transition mb-4"
              />

              <label className="block text-sm font-bold mb-2">메모 (선택)</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 비닐하우스 3번 동, 물주기 격일"
                rows={3}
                className="w-full px-3.5 py-3 border-2 border-brd rounded-xl text-sm bg-bg-card focus:border-g3 outline-none transition mb-5 resize-none"
              />

              <button
                onClick={handleAdd}
                disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-g1 text-white font-bold hover:bg-g2 disabled:opacity-50 transition"
              >
                {saving ? "저장 중..." : "작물 추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}