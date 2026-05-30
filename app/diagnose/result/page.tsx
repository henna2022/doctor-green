"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveDiagnosis } from "@/lib/diagnoses";
import { searchDodam } from "@/lib/dodam";
import Link from "next/link";

// 진단 단계 상태
type Stage = "analyzing" | "done" | "not_detected" | "error";

interface Detection {
  name: string;
  name_en: string;
  confidence: number;
  box: { x1: number; y1: number; x2: number; y2: number };
}

interface DiagnosisResult {
  detected: true;
  disease_name: string;
  disease_name_en: string;
  confidence: number;
  severity: "경미" | "보통" | "심각";
  count: number;
  image_width: number;
  image_height: number;
  detections: Detection[];
  all: Array<{ name: string; confidence: number }>;
}

// NCPMS 외부 모바일 도감 URL
function ncpmsExternalUrl(sickKey: string): string {
  return `https://ncpms.rda.go.kr/mobile/MobileSicknsDtlR.ms?dtlKey=${sickKey}&totalSearchYn=Y`;
}

// "딸기 흰가루병(잎)" → keyword="흰가루병", cropName="딸기"
function normalizeForSearch(diseaseName: string): { keyword: string; cropName: string } {
  let keyword = diseaseName;
  keyword = keyword.replace(/^(딸기|토마토|고추|오이|복숭아|사과|배추|벼|마늘|양파)\s*/, "");
  keyword = keyword.replace(/\([^)]+\)/g, "").trim();
  return { keyword, cropName: "딸기" };
}

export default function DiagnoseResultPage() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("analyzing");
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState("");
  const [cropId, setCropId] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // NCPMS sickKey 매칭 (detail은 호출 X - SVC05 작동 안 함)
  const [ncpmsLoading, setNcpmsLoading] = useState(false);
  const [ncpmsSickKey, setNcpmsSickKey] = useState<string | null>(null);

  // 진단 API 호출
  useEffect(() => {
    const img = sessionStorage.getItem("diagnose_image");
    const cropName = sessionStorage.getItem("diagnose_crop") ?? "";
    const savedCropId = sessionStorage.getItem("diagnose_crop_id");

    if (!img) {
      router.replace("/diagnose");
      return;
    }
    setImage(img);
    setCrop(cropName);
    setCropId(savedCropId || null);

    (async () => {
      try {
        const res = await fetch("/api/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: img }),
        });
        const data = await res.json();

        if (!res.ok || data.error) {
          setErrorMsg(data.detail ?? data.error ?? "알 수 없는 오류");
          setStage("error");
          return;
        }

        if (!data.detected) {
          setStage("not_detected");
          return;
        }

        setResult(data as DiagnosisResult);
        setStage("done");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(msg);
        setStage("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 진단 완료 후 NCPMS search로 sickKey 찾기 (외부 링크용)
  useEffect(() => {
    if (stage !== "done" || !result) return;

    (async () => {
      setNcpmsLoading(true);
      try {
        const { keyword, cropName } = normalizeForSearch(result.disease_name);

        let items = await searchDodam("disease", cropName, keyword);
        if (items.length === 0) {
          items = await searchDodam("disease", undefined, keyword);
        }

        if (items[0]) setNcpmsSickKey(items[0].sickKey);
      } catch (e) {
        console.error("NCPMS search error:", e);
      } finally {
        setNcpmsLoading(false);
      }
    })();
  }, [stage, result]);

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

  const confidencePercent = Math.round(result.confidence * 100);

  const severityMap = {
    "경미": { label: "경미", color: "#4ECAA0", bg: "#E8F8F0" },
    "보통": { label: "주의", color: "#FFA500", bg: "#FFF4E5" },
    "심각": { label: "심각", color: "#F08080", bg: "#FFEAEA" },
  };
  const severityInfo = severityMap[result.severity] ?? severityMap["보통"];

  const severityKey: "low" | "mid" | "high" =
    result.severity === "경미" ? "low" :
    result.severity === "심각" ? "high" : "mid";

  const otherSuspects = result.all
    .filter((x) => x.name !== result.disease_name)
    .filter((x, i, arr) => arr.findIndex((y) => y.name === x.name) === i);

  const handleSave = async () => {
    if (saved || !image) return;
    setSaving(true);
    const res = await saveDiagnosis({
      cropId: cropId,
      cropName: crop,
      diseaseName: result.disease_name,
      confidence: confidencePercent,
      severity: severityKey,
      imageUrl: image,
      symptoms: [],
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
        {/* 진단 이미지 + bbox 오버레이 */}
        {image && (
          <div
            className="w-full overflow-hidden relative bg-bg-card"
            style={
              result.image_width && result.image_height
                ? { aspectRatio: `${result.image_width} / ${result.image_height}` }
                : { height: "224px" }
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="진단 결과" className="w-full h-full object-contain" />

            {result.image_width > 0 &&
              result.image_height > 0 &&
              result.detections?.length > 0 && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 ${result.image_width} ${result.image_height}`}
                  preserveAspectRatio="none"
                >
                  {result.detections.map((d, i) => {
                    const bw = d.box.x2 - d.box.x1;
                    const bh = d.box.y2 - d.box.y1;
                    const fontSize = Math.max(result.image_width / 28, 24);
                    const strokeW = Math.max(result.image_width / 180, 3);
                    const labelOutside = d.box.y1 > fontSize * 1.3;
                    const labelY = labelOutside
                      ? d.box.y1 - fontSize * 0.4
                      : d.box.y1 + fontSize;
                    const labelBgY = labelOutside ? d.box.y1 - fontSize * 1.3 : d.box.y1;
                    return (
                      <g key={i}>
                        <rect
                          x={d.box.x1}
                          y={d.box.y1}
                          width={bw}
                          height={bh}
                          fill="none"
                          stroke="#FF4444"
                          strokeWidth={strokeW}
                          rx="4"
                        />
                        <rect
                          x={d.box.x1}
                          y={labelBgY}
                          width={fontSize * 3.2}
                          height={fontSize * 1.3}
                          fill="#FF4444"
                          rx="2"
                        />
                        <text
                          x={d.box.x1 + fontSize * 0.3}
                          y={labelY}
                          fill="white"
                          fontSize={fontSize}
                          fontWeight="bold"
                        >
                          {Math.round(d.confidence * 100)}%
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
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

          {/* NCPMS 매칭 로딩 */}
          {ncpmsLoading && (
            <div className="mb-5 p-4 rounded-2xl bg-bg-card border border-brd flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-g5 border-t-g1 rounded-full animate-spin" />
              <p className="text-xs text-txt2">NCPMS 도감 매칭 중...</p>
            </div>
          )}

          {/* NCPMS 외부 도감 링크 - 메인 CTA */}
          {ncpmsSickKey ? (
            <a
              href={ncpmsExternalUrl(ncpmsSickKey)}
              target="_blank"
              rel="noopener noreferrer"
              className="block mb-5 p-4 rounded-2xl bg-g5 border-2 border-g3 hover:bg-g4 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-g1 mb-1">
                    📖 NCPMS 공식 도감에서 자세히 보기 ↗
                  </h3>
                  <p className="text-xs text-txt2 leading-relaxed">
                    증상·발생환경·방제 방법을<br />
                    농촌진흥청 공식 페이지에서 확인
                  </p>
                </div>
                <span className="text-3xl text-g1 ml-2">›</span>
              </div>
            </a>
          ) : !ncpmsLoading && (
            <Link
              href={`/dodam/disease?keyword=${encodeURIComponent(
                normalizeForSearch(result.disease_name).keyword
              )}&crop=딸기`}
              className="block mb-5 p-4 rounded-2xl bg-g5 border-2 border-g3 hover:bg-g4 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-g1 mb-1">📖 도감에서 찾아보기</h3>
                  <p className="text-xs text-txt2 leading-relaxed">
                    관련 병해를 도감에서 검색해보세요
                  </p>
                </div>
                <span className="text-3xl text-g1 ml-2">›</span>
              </div>
            </Link>
          )}

          {/* 다른 의심 진단 */}
          {otherSuspects.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-bold mb-2">🔍 다른 가능성</h3>
              <div className="flex flex-col gap-1.5">
                {otherSuspects.map((s, i) => {
                  const { keyword: kw } = normalizeForSearch(s.name);
                  return (
                    <Link
                      key={i}
                      href={`/dodam/disease?keyword=${encodeURIComponent(kw)}&crop=딸기`}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-bg-card border border-brd hover:bg-g5 transition"
                    >
                      <span className="text-sm">{s.name}</span>
                      <span className="text-xs text-txt2">{Math.round(s.confidence * 100)}%</span>
                    </Link>
                  );
                })}
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