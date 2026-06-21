"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { getMyDiagnoses, deleteDiagnosis, DiagnosisRecord } from "@/lib/diagnoses";
import { getCurrentUser } from "@/lib/auth";

export default function HistoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<DiagnosisRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user) {
        router.push("/");
        return;
      }
      const data = await getMyDiagnoses();
      setRecords(data);
      setLoading(false);
    }
    load();
  }, [router]);

  const handleDelete = async (id: string) => {
    if (!confirm("이 진단 기록을 삭제할까요?")) return;
    await deleteDiagnosis(id);
    setRecords(records.filter((r) => r.id !== id));
  };

  const severityInfo = (sev: string | null) => {
    if (sev === "high") return { label: "심각", color: "#F08080", bg: "#FFEAEA" };
    if (sev === "mid") return { label: "주의", color: "#FFA500", bg: "#FFF4E5" };
    return { label: "경미", color: "#4ECAA0", bg: "#E8F8F0" };
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <div className="phone-frame overflow-y-auto">
      <header className="flex items-center justify-between px-5 py-4 border-b border-brd sticky top-0 bg-bg-main z-10">
        <Link href="/home" className="text-2xl">‹</Link>
        <h1 className="text-base font-bold">진단 기록</h1>
        <div className="w-6" />
      </header>

      <main className="flex-1 px-5 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-g5 border-t-g1 rounded-full animate-spin mb-3" />
            <p className="text-sm text-txt3">불러오는 중...</p>
          </div>
        ) : records.length > 0 ? (
          <div className="flex flex-col gap-3">
            {records.map((r) => {
              const sev = severityInfo(r.severity);
              return (
                <div key={r.id} className="flex gap-3 p-3 rounded-2xl bg-bg-soft">
                  {/* 썸네일 */}
                  {r.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt={r.disease_name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                  )}
                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: sev.bg, color: sev.color }}>
                        {sev.label}
                      </span>
                      <span className="text-xs text-txt3">{formatDate(r.diagnosed_at)}</span>
                    </div>
                    <h3 className="text-base font-bold mb-0.5">{r.disease_name}</h3>
                    <p className="text-xs text-txt2">
                      {r.crop_name || "작물 미지정"}
                      {r.confidence && ` · 신뢰도 ${r.confidence}%`}
                    </p>
                  </div>
                  {/* 삭제 */}
                  <button onClick={() => handleDelete(r.id)} className="text-txt3 text-sm self-start">
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm text-txt2 mb-4">아직 진단 기록이 없어요</p>
            <Link
              href="/diagnose"
              className="inline-block px-6 py-3 rounded-2xl bg-g1 text-white font-bold text-sm"
            >
              진단하러 가기
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}