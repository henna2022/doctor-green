"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveDiagnosis } from "@/lib/diagnoses";
import Link from "next/link";

// 진단 단계 상태
type Stage = "analyzing" | "done" | "not_detected" | "error";

// API 응답 타입 (HF Space에서 받는 형태)
interface DiagnosisResult {
  detected: true;
  disease_name: string;
  disease_name_en: string;
  confidence: number; // 0 ~ 1
  severity: "경미" | "보통" | "심각";
  count: number;
  all: Array<{ name: string; confidence: number }>;
}

export default function DiagnoseResultPage() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("analyzing");
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState("");
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // 진단 페이지에서 넘어온 이미지 가져오기
    const savedImage = sessionStorage.getItem("diagnose_image");
    const savedCrop = sessionStorage.getItem("diagnose_crop");

    if (!savedImage) {
      router.push("/diagnose");
      return;
    }

    setImage(savedImage);
    setCrop(savedCrop || "미지정");

    // ━━━ 실제 AI 진단 API 호출 ━━━
    (async () => {
      try {
        const res = await fetch("/api/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: savedImage }),
        });
        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || "진단 실패");
        }

        if (!data.detected) {
          setStage("not_detected");
          return;
        }

        setResult(data as DiagnosisResult);
        setStage("done");
      } catch (e: any) {
        setErrorMsg(e.message ?? "진단 중 오류가 발생했어요");
        setStage("error");
      }
    })();
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
          {image && (
            <div className="w-40 h-40 rounded-3xl overflow-hidden border-2 border-g3 mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="진단 중" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="w-12 h-12 border-4 border-g5 border-t-g1 rounded-full animate-spin mb-4" />
          <p className="text-base font-bold text-g1 mb-1">AI가 분석하고 있어요</p>
          <p className="text-sm text-txt2">잠시만 기다려주세요...</p>
          <p className="text-xs text-txt3 mt-2">최대 1분 정도 소요될 수 있어요</p>
        </main>
      </div>
    );
  }

  // ━━━ 병해 미감지 화면 ━━━
  if (stage === "not_detected") {
    return (
      <div className="phone-frame">
        <header className="flex items-center justify-between px-5 py-4 border-b border-brd">
          <Link href="/diagnose" className="text-2xl">‹</Link>
          <h1 className="text-base font-bold">진단 결과</h1>
          <div className="w-6" />
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-5 text-center">
          {image && (
            <div className="w-40 h-40 rounded-3xl overflow-hidden border-2 border-g3 mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="진단" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="text-5xl mb-3">🌱</div>
          <h2 className="text-xl font-bold mb-2">건강한 상태로 보여요</h2>
          <p className="text-sm text-txt2 mb-6 leading-relaxed">
            병해를 감지하지 못했어요.<br />
            잎이나 과실을 더 가까이 찍으면<br />
            정확도가 올라갈 수 있어요.
          </p>
          <div className="flex flex-col gap-2.5 w-full">
            <Link
              href="/diagnose"
              className="w-full py-3.5 rounded-2xl bg-g1 text-white font-bold text-center hover:bg-g2 transition"
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
        </main>
      </div>
    );
  }

  // ━━━ 에러 화면 ━━━
  if (stage === "error") {
    return (
      <div className="phone-frame">
        <header className="flex items-center justify-between px-5 py-4 border-b border-brd">
          <Link href="/diagnose" className="text-2xl">‹</Link>
          <h1 className="text-base font-bold">진단 실패</h1>
          <div className="w-6" />
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-5 text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold mb-2">진단을 완료하지 못했어요</h2>
          <p className="text-sm text-txt2 mb-2 leading-relaxed">{errorMsg}</p>
          <p className="text-xs text-txt3 mb-6 leading-relaxed">
            네트워크를 확인하고 다시 시도해주세요.<br />
            (AI 서버가 절전 상태에서 깨어나는 중일 수 있어요)
          </p>
          <div className="flex flex-col gap-2.5 w-full">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3.5 rounded-2xl bg-g1 text-white font-bold text-center hover:bg-g2 transition"
            >
              다시 시도
            </button>
            <Link
              href="/diagnose"
              className="w-full py-3.5 rounded-2xl border-2 border-brd text-txt2 font-bold text-center hover:bg-bg-card transition"
            >
              진단 페이지로
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // ━━━ 결과 화면 (실제 데이터) ━━━
  if (!result) return null;

  // confidence 0.9239 → 92
  const confidencePercent = Math.round(result.confidence * 100);

  // severity 한글 → UI 색상
  const severityMap = {
    "경미": { label: "경미", color: "#4ECAA0", bg: "#E8F8F0" },
    "보통": { label: "주의", color: "#FFA500", bg: "#FFF4E5" },
    "심각": { label: "심각", color: "#F08080", bg: "#FFEAEA" },
  };
  const severityInfo = severityMap[result.severity] ?? severityMap["보통"];

  // severity 한글 → DB 저장용 키
  const severityKey: "low" | "mid" | "high" =
    result.severity === "경미" ? "low" :
    result.severity === "심각" ? "high" : "mid";

  // all 배열에서 대표 진단 외에 다른 종류만 추출 (중복 제거)
  const otherSuspects = result.all
    .filter((x) => x.name !== result.disease_name)
    .filter((x, i, arr) => arr.findIndex((y) => y.name === x.name) === i);

  const handleSave = async () => {
    if (saved || !image) return;
    setSaving(true);
    const res = await saveDiagnosis({
      cropName: crop,
      diseaseName: result.disease_name,
      confidence: confidencePercent,
      severity: severityKey,
      imageUrl: image,
      symptoms: [], // 모델이 증상 정보는 제공하지 않음 - 도감에서 확인
    });
    if (res.error) {
      alert("저장 실패: " + res.error);
    } else {
      setSaved(true);
    }
    setSaving(false);
  };

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
            <div className="flex-1">
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: severityInfo.bg, color: severityInfo.color }}
              >
                {severityInfo.label}
              </span>
              <h2 className="text-2xl font-extrabold mt-2">{result.disease_name}</h2>
              <p className="text-sm text-txt2">{crop}</p>
            </div>
            <div className="text-right ml-2">
              <div className="text-3xl font-extrabold text-g1">{confidencePercent}%</div>
              <p className="text-xs text-txt3">신뢰도</p>
            </div>
          </div>

          {/* 감지 위치 개수 */}
          {result.count > 1 && (
            <p className="text-xs text-txt2 mb-4">
              이미지에서 <span className="font-bold text-g1">{result.count}곳</span>의 병반이 감지되었어요
            </p>
          )}

          {/* 도감 안내 (메인 CTA - description/remedies 대체) */}
          <Link
            href={`/dodam/disease?keyword=${encodeURIComponent(result.disease_name)}`}
            className="block mb-5 p-4 rounded-2xl bg-g5 border-2 border-g3 hover:bg-g4 transition"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-g1 mb-1">📖 도감에서 자세히 보기</h3>
                <p className="text-xs text-txt2 leading-relaxed">
                  증상, 발생 조건, 방제 방법을<br />NCPMS 도감에서 확인하세요
                </p>
              </div>
              <span className="text-3xl text-g1 ml-2">›</span>
            </div>
          </Link>

          {/* 다른 의심 진단 (있을 때만) */}
          {otherSuspects.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-bold mb-2">🔍 다른 가능성</h3>
              <div className="flex flex-col gap-1.5">
                {otherSuspects.map((s, i) => (
                  <Link
                    key={i}
                    href={`/dodam/disease?keyword=${encodeURIComponent(s.name)}`}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-bg-card border border-brd hover:bg-g5 transition"
                  >
                    <span className="text-sm">{s.name}</span>
                    <span className="text-xs text-txt2">{Math.round(s.confidence * 100)}%</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 주의 안내 */}
          <p className="text-xs text-txt3 text-center mb-5 leading-relaxed">
            ⚠️ AI 진단은 참고용이며, 정확한 진단은<br />
            농업기술센터 또는 전문가 상담을 권장합니다
          </p>

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