"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveDiagnosis } from "@/lib/diagnoses";
import Link from "next/link";

// 진단 단계 상태
type Stage = "analyzing" | "done";

export default function DiagnoseResultPage() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("analyzing");
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // 진단 페이지에서 넘어온 이미지 가져오기
    const savedImage = sessionStorage.getItem("diagnose_image");
    const savedCrop = sessionStorage.getItem("diagnose_crop");

    if (!savedImage) {
      // 이미지 없이 직접 들어온 경우 → 진단 페이지로
      router.push("/diagnose");
      return;
    }

    setImage(savedImage);
    setCrop(savedCrop || "미지정");

    // AI 분석 시뮬레이션 (2.5초 후 결과)
    // TODO: 실제 AI 모델 연결
    const timer = setTimeout(() => {
      setStage("done");
    }, 2500);

    return () => clearTimeout(timer);
  }, [router]);

  // ━━━ 분석 중 화면 ━━━
  if (stage === "analyzing") {
    return (
      <div className="phone-frame">
        <header className="flex items-center justify-between px-5 py-4 border-b border-brd">
          <Link href="/diagnose" className="text-2xl">‹</Link>
          <h1 className="text-base font-bold">AI 진단 중</h1>
          <div className="w-6" />
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-5">
          {/* 이미지 미리보기 */}
          {image && (
            <div className="w-40 h-40 rounded-3xl overflow-hidden border-2 border-g3 mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="진단 중" className="w-full h-full object-cover" />
            </div>
          )}

          {/* 로딩 스피너 */}
          <div className="w-12 h-12 border-4 border-g5 border-t-g1 rounded-full animate-spin mb-4" />
          <p className="text-base font-bold text-g1 mb-1">AI가 분석하고 있어요</p>
          <p className="text-sm text-txt2">잠시만 기다려주세요...</p>
        </main>
      </div>
    );
  }

  // ━━━ 결과 화면 (임시 데이터) ━━━
  // TODO: 실제 AI 진단 결과로 교체
  const result = {
    diseaseName: "잎곰팡이병",
    confidence: 87,
    severity: "mid" as "low" | "mid" | "high",
    cropName: crop !== "미지정" ? crop : "토마토",
    symptoms: ["잎 뒷면 회색 곰팡이", "황색 반점", "잎 마름"],
    description:
      "잎곰팡이병은 고온다습한 환경에서 주로 발생합니다. 잎 뒷면에 회색~갈색 곰팡이가 피며, 진행되면 잎이 마르고 광합성이 저하됩니다.",
    remedies: [
      "감염된 잎은 즉시 제거하여 소각",
      "시설 내 환기를 강화하여 습도를 낮추기",
      "적용 약제로 방제 (농약안전정보시스템 확인)",
    ],
  };

  const handleSave = async () => {
    if (saved || !image) return;
    setSaving(true);
    const res = await saveDiagnosis({
      cropName: crop,
      diseaseName: result.diseaseName,
      confidence: result.confidence,
      severity: result.severity,
      imageUrl: image,
      symptoms: result.symptoms,
    });
    if (res.error) {
      alert("저장 실패: " + res.error);
    } else {
      setSaved(true);
    }
    setSaving(false);
  };

  const severityInfo = {
    low: { label: "경미", color: "#4ECAA0", bg: "#E8F8F0" },
    mid: { label: "주의", color: "#FFA500", bg: "#FFF4E5" },
    high: { label: "심각", color: "#F08080", bg: "#FFEAEA" },
  }[result.severity];

  return (
    <div className="phone-frame overflow-y-auto">
      <header className="flex items-center justify-between px-5 py-4 border-b border-brd sticky top-0 bg-bg-main z-10">
        <Link href="/diagnose" className="text-2xl">‹</Link>
        <h1 className="text-base font-bold">진단 결과</h1>
        <div className="w-6" />
      </header>

      <main className="flex-1 pb-6">
        {/* 진단 이미지 */}
        {image && (
          <div className="w-full h-56 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="진단 결과" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="px-5 py-5">
          {/* 진단명 + 신뢰도 */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: severityInfo.bg, color: severityInfo.color }}
              >
                {severityInfo.label}
              </span>
              <h2 className="text-2xl font-extrabold mt-2">{result.diseaseName}</h2>
              <Link
                href={`/dodam/disease?keyword=${encodeURIComponent(result.diseaseName)}`}
                className="inline-block mt-1 text-xs text-g2 underline"
              >
                도감에서 자세히 보기 ›
              </Link>
              <p className="text-sm text-txt2">{result.cropName}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-g1">{result.confidence}%</div>
              <p className="text-xs text-txt3">신뢰도</p>
            </div>
          </div>

          {/* 증상 태그 */}
          <div className="mb-5">
            <h3 className="text-sm font-bold mb-2">🔍 주요 증상</h3>
            <div className="flex flex-wrap gap-1.5">
              {result.symptoms.map((s) => (
                <span key={s} className="px-3 py-1.5 rounded-full bg-g5 text-g1 text-xs font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* 설명 */}
          <div className="mb-5 p-4 rounded-2xl bg-bg-card border border-brd">
            <h3 className="text-sm font-bold mb-2">📖 질병 설명</h3>
            <p className="text-sm text-txt2 leading-relaxed">{result.description}</p>
          </div>

          {/* 방제 방법 */}
          <div className="mb-6 p-4 rounded-2xl bg-g5">
            <h3 className="text-sm font-bold mb-3 text-g1">💊 방제 방법</h3>
            <ul className="flex flex-col gap-2">
              {result.remedies.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-txt">
                  <span className="text-g1 font-bold">{i + 1}.</span>
                  <span className="leading-relaxed">{r}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 주의 안내 */}
          <p className="text-xs text-txt3 text-center mb-5 leading-relaxed">
            ⚠️ AI 진단은 참고용이며, 정확한 진단은<br />
            농업기술센터 또는 전문가 상담을 권장합니다
          </p>

          {/* 버튼들 */}
          {/* 버튼들 */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleSave}
              disabled={saved || saving}
              className={`w-full py-3.5 rounded-2xl font-bold text-center transition ${
                saved
                  ? "bg-g5 text-g1"
                  : "bg-g1 text-white hover:bg-g2 disabled:opacity-50"
              }`}
            >
              {saved ? "✓ 기록에 저장됨" : saving ? "저장 중..." : "📌 진단 기록 저장"}
            </button>
            <Link
              href="/diagnose"
              className="w-full py-3.5 rounded-2xl border-2 border-g1 text-g1 font-bold text-center hover:bg-g5 transition"
            >
              다시 진단하기
            </Link>
            <Link
              href="/home"
              className="w-full py-3.5 rounded-2xl border-2 border-brd text-txt2 font-bold text-center hover:bg-bg-card transition"
            >
              홈으로
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}