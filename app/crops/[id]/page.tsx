"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCropById, toggleFavorite, updateCrop, MyCrop } from "@/lib/crops";
import { getDiagnosesByCrop, DiagnosisRecord } from "@/lib/diagnoses";
import { fetchPestForecast, PestForecast } from "@/lib/api";

// 작물 이모지 옵션
const CROP_EMOJIS = ["🍅", "🌶️", "🍓", "🥒", "🍑", "🍎", "🥬", "🌾", "🧄", "🧅", "🥕", "🥔", "🌽", "🌱"];

export default function CropDetailPage() {
  const router = useRouter();
  const params = useParams();
  const cropId = params.id as string;

  const [crop, setCrop] = useState<MyCrop | null>(null);
  const [diagnoses, setDiagnoses] = useState<DiagnosisRecord[]>([]);
  const [forecasts, setForecasts] = useState<PestForecast[]>([]);
  const [loading, setLoading] = useState(true);

  // 수정 모달 상태
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user) {
        router.push("/");
        return;
      }

      const c = await getCropById(cropId);
      if (!c) {
        router.push("/crops");
        return;
      }
      setCrop(c);

      const [diags, fc] = await Promise.all([
        getDiagnosesByCrop(c.crop_name),
        fetchPestForecast([c.crop_name]),
      ]);
      setDiagnoses(diags);
      setForecasts(fc);
      setLoading(false);
    }
    load();
  }, [cropId, router]);

  const handleToggleFavorite = async () => {
    if (!crop) return;
    const newVal = !crop.is_favorite;
    setCrop({ ...crop, is_favorite: newVal });
    await toggleFavorite(crop.id, crop.is_favorite);
  };

  // 수정 모달 열기 — 현재 값으로 초기화
  const openEdit = () => {
    if (!crop) return;
    setEditName(crop.crop_name);
    setEditEmoji(crop.emoji);
    setEditDate(crop.planted_date || "");
    setEditMemo(crop.memo || "");
    setShowEdit(true);
  };

  // 수정 저장
  const handleSaveEdit = async () => {
    if (!crop || !editName.trim()) {
      alert("작물 이름을 입력해주세요!");
      return;
    }
    setSaving(true);
    const res = await updateCrop(crop.id, {
      cropName: editName.trim(),
      emoji: editEmoji,
      plantedDate: editDate || null,
      memo: editMemo || null,
    });
    if (res.error) {
      alert("수정 실패: " + res.error);
    } else {
      // 화면 즉시 반영
      setCrop({
        ...crop,
        crop_name: editName.trim(),
        emoji: editEmoji,
        planted_date: editDate || null,
        memo: editMemo || null,
      });
      // 작물 이름이 바뀌었으면 진단기록/예찰도 다시 불러옴
      if (editName.trim() !== crop.crop_name) {
        const [diags, fc] = await Promise.all([
          getDiagnosesByCrop(editName.trim()),
          fetchPestForecast([editName.trim()]),
        ]);
        setDiagnoses(diags);
        setForecasts(fc);
      }
      setShowEdit(false);
    }
    setSaving(false);
  };

  const daysSince = (date: string | null) => {
    if (!date) return null;
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : null;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}.${d.getDate()}`;
  };

  if (loading || !crop) {
    return (
      <div className="phone-frame items-center justify-center">
        <div className="w-10 h-10 border-4 border-g5 border-t-g1 rounded-full animate-spin" />
      </div>
    );
  }

  const days = daysSince(crop.planted_date);

  return (
    <div className="phone-frame overflow-y-auto">
      <header className="flex items-center justify-between px-5 py-4 border-b border-brd sticky top-0 bg-bg-main z-10">
        <Link href="/crops" className="text-2xl">‹</Link>
        <h1 className="text-base font-bold">작물 상세</h1>
        <div className="flex items-center gap-3">
          {/* 수정 버튼 */}
          <button onClick={openEdit} className="text-xs text-g2 font-bold">
            수정
          </button>
          {/* 하트 */}
          <button onClick={handleToggleFavorite} className="text-xl">
            {crop.is_favorite ? "❤️" : "🤍"}
          </button>
        </div>
      </header>

      <main className="flex-1 pb-6">
        {/* 작물 헤더 카드 */}
        <div className="px-5 py-6 bg-g5">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center text-5xl shadow-sm">
              {crop.emoji}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-extrabold text-g1 mb-1">{crop.crop_name}</h2>
              {crop.planted_date && (
                <p className="text-sm text-txt2">
                  📅 {crop.planted_date}
                  {days !== null && ` (${days}일째)`}
                </p>
              )}
              {!crop.planted_date && (
                <p className="text-sm text-txt3">심은 날짜 미설정</p>
              )}
            </div>
          </div>
          {crop.memo && (
            <p className="mt-3 text-sm text-txt bg-white rounded-xl px-3 py-2 leading-relaxed">
              📝 {crop.memo}
            </p>
          )}
        </div>

        <div className="px-5 py-5">
          {/* 병해충 예찰 */}
          <section className="mb-6">
            <h3 className="text-base font-extrabold mb-3">
              🔔 {crop.crop_name} 병해충 예찰
            </h3>
            {forecasts.length > 0 ? (
              <div className="flex flex-col gap-2">
                {forecasts.map((f, i) => {
                  const isWarn = f.level === "경보" || f.level === "주의보";
                  return (
                    <div
                      key={i}
                      className={`p-3.5 rounded-2xl border-l-4 ${
                        isWarn ? "bg-orange/5 border-orange" : "bg-g5 border-g3"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isWarn ? "bg-orange text-white" : "bg-g3 text-white"
                          }`}
                        >
                          {f.level}
                        </span>
                        <span className="text-xs text-txt3">농촌진흥청 NCPMS</span>
                      </div>
                      <h4 className="text-sm font-bold mb-0.5">{f.name}</h4>
                      {f.period && (
                        <p className="text-xs text-txt2">시기: {f.period}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-g5 text-center">
                <p className="text-sm text-g1 font-medium">현재 예찰 정보가 없습니다 ✅</p>
              </div>
            )}
          </section>

          {/* 도감 링크 */}
          <section className="mb-6">
            <h3 className="text-base font-extrabold mb-3">📚 {crop.crop_name} 도감</h3>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/dodam/disease?crop=${encodeURIComponent(crop.crop_name)}`}
                className="p-4 rounded-2xl bg-g5 hover:bg-g4 transition flex flex-col items-center gap-1.5"
              >
                <span className="text-2xl">🌿</span>
                <span className="text-sm font-bold text-g1">질병 도감</span>
              </Link>
              <Link
                href={`/dodam/pest?crop=${encodeURIComponent(crop.crop_name)}`}
                className="p-4 rounded-2xl bg-orange/10 hover:bg-orange/20 transition flex flex-col items-center gap-1.5"
              >
                <span className="text-2xl">🐛</span>
                <span className="text-sm font-bold text-orange">해충 도감</span>
              </Link>
            </div>
          </section>

          {/* 진단 기록 */}
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-extrabold">
                📋 진단 기록 <span className="text-sm text-txt3 font-normal">({diagnoses.length})</span>
              </h3>
              <Link href="/diagnose" className="text-xs text-g2">새 진단 ›</Link>
            </div>

            {diagnoses.length > 0 ? (
              <div className="flex flex-col gap-2">
                {diagnoses.map((d) => (
                  <div key={d.id} className="flex gap-3 p-3 rounded-2xl bg-bg-soft">
                    {d.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.image_url} alt={d.disease_name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] text-txt3">{formatDate(d.diagnosed_at)}</span>
                        {d.confidence && (
                          <span className="text-[10px] font-bold text-g1">신뢰도 {d.confidence}%</span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold mb-0.5 truncate">{d.disease_name}</h4>
                      {d.symptoms && d.symptoms.length > 0 && (
                        <p className="text-xs text-txt2 truncate">
                          {d.symptoms.slice(0, 3).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-bg-soft text-center">
                <p className="text-sm text-txt3 mb-3">{crop.crop_name} 진단 기록이 없어요</p>
                <Link
                  href="/diagnose"
                  className="inline-block px-5 py-2.5 rounded-xl bg-g1 text-white font-bold text-sm"
                >
                  진단하러 가기
                </Link>
              </div>
            )}
          </section>

          {/* 작물 정보 */}
          <section>
            <h3 className="text-base font-extrabold mb-3">📊 정보</h3>
            <div className="bg-bg-soft rounded-2xl divide-y divide-brd">
              <InfoRow label="작물" value={`${crop.emoji} ${crop.crop_name}`} />
              <InfoRow label="심은 날" value={crop.planted_date || "미설정"} />
              <InfoRow label="경과일" value={days !== null ? `${days}일` : "—"} />
              <InfoRow label="즐겨찾기" value={crop.is_favorite ? "❤️ 등록됨" : "🤍 미등록"} />
            </div>
          </section>
        </div>
      </main>

      {/* ━━━ 수정 모달 ━━━ */}
      {showEdit && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
          onClick={() => !saving && setShowEdit(false)}
        >
          <div
            className="w-full max-w-[420px] bg-bg-main rounded-t-3xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-bg-main px-5 py-4 border-b border-brd flex items-center justify-between">
              <h2 className="text-lg font-extrabold">작물 정보 수정</h2>
              <button
                onClick={() => !saving && setShowEdit(false)}
                disabled={saving}
                className="text-2xl text-txt3"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-5">
              {/* 이모지 선택 */}
              <label className="block text-sm font-bold mb-2">이모지</label>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {CROP_EMOJIS.map((em) => (
                  <button
                    key={em}
                    onClick={() => setEditEmoji(em)}
                    className={`w-10 h-10 rounded-xl border-2 text-xl flex items-center justify-center transition ${
                      editEmoji === em ? "bg-g5 border-g3" : "border-brd bg-bg-card"
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>

              {/* 작물 이름 */}
              <label className="block text-sm font-bold mb-2">작물 이름</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="예: 토마토"
                className="w-full px-3.5 py-3 border-2 border-brd rounded-xl text-sm bg-bg-card focus:border-g3 outline-none transition mb-4"
              />

              {/* 심은 날짜 */}
              <label className="block text-sm font-bold mb-2">심은 날짜</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-3.5 py-3 border-2 border-brd rounded-xl text-sm bg-bg-card focus:border-g3 outline-none transition mb-4"
              />

              {/* 메모 */}
              <label className="block text-sm font-bold mb-2">메모</label>
              <textarea
                value={editMemo}
                onChange={(e) => setEditMemo(e.target.value)}
                placeholder="예: 비닐하우스 3번 동"
                rows={3}
                className="w-full px-3.5 py-3 border-2 border-brd rounded-xl text-sm bg-bg-card focus:border-g3 outline-none transition mb-5 resize-none"
              />

              {/* 저장 */}
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-g1 text-white font-bold hover:bg-g2 disabled:opacity-50 transition"
              >
                {saving ? "저장 중..." : "변경사항 저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-txt3">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}