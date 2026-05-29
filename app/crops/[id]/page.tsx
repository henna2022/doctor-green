"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCropById, toggleFavorite, MyCrop } from "@/lib/crops";
import { getDiagnosesByCrop, DiagnosisRecord } from "@/lib/diagnoses";
import { fetchPestForecast, PestForecast } from "@/lib/api";

export default function CropDetailPage() {
  const router = useRouter();
  const params = useParams();
  const cropId = params.id as string;

  const [crop, setCrop] = useState<MyCrop | null>(null);
  const [diagnoses, setDiagnoses] = useState<DiagnosisRecord[]>([]);
  const [forecasts, setForecasts] = useState<PestForecast[]>([]);
  const [loading, setLoading] = useState(true);

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

      // 병렬 로드: 진단 기록 + 병해충 예찰
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
        <button onClick={handleToggleFavorite} className="text-xl w-6 text-right">
          {crop.is_favorite ? "❤️" : "🤍"}
        </button>
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
          {/* ━━━ 병해충 예찰 알림 (NCPMS API) ━━━ */}
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

          {/* ━━━ 진단 기록 ━━━ */}
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
                  <div key={d.id} className="flex gap-3 p-3 rounded-2xl bg-bg-card border border-brd">
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
              <div className="p-6 rounded-2xl bg-bg-card border border-brd text-center">
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
            <div className="bg-bg-card border border-brd rounded-2xl divide-y divide-brd">
              <InfoRow label="작물" value={`${crop.emoji} ${crop.crop_name}`} />
              <InfoRow label="심은 날" value={crop.planted_date || "미설정"} />
              <InfoRow label="경과일" value={days !== null ? `${days}일` : "—"} />
              <InfoRow label="즐겨찾기" value={crop.is_favorite ? "❤️ 등록됨" : "🤍 미등록"} />
            </div>
          </section>
        </div>
      </main>
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