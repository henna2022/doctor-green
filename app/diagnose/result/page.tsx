"use client";

import { useState } from "react";
import { saveDiagnosis } from "@/lib/diagnoses";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import {
  SearchIcon,
  WarningIcon,
  BookIcon,
  CheckIcon,
  RecordIcon,
} from "@/components/Icons";
import { useDiagnosis } from "./useDiagnosis";
import { ncpmsExternalUrl, normalizeForSearch } from "./lib";
import { AnalyzingScreen, ErrorScreen, NoDetectionScreen } from "./screens";
import { HealthAssessment } from "./HealthAssessment";
import { DetectionOverlay } from "./DetectionOverlay";

export default function DiagnoseResultPage() {
  const {
    stage,
    analyzingPhase,
    image,
    crop,
    cropId,
    result,
    errorMsg,
    sensors,
    ncpmsLoading,
    ncpmsSickKey,
    aiVerdict,
    aiVerdictStatus,
  } = useDiagnosis();

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // ━━━ 분석 중 화면 ━━━
  if (stage === "analyzing") {
    return <AnalyzingScreen image={image} analyzingPhase={analyzingPhase} />;
  }

  // ━━━ 병해 미감지 / 판독불가 → 종합 건강 평가 화면 ━━━
  if (stage === "not_detected" || stage === "low_confidence") {
    const unclear = stage === "low_confidence";
    return (
      <NoDetectionScreen
        image={image}
        unclear={unclear}
        sensors={sensors}
        crop={crop}
        aiVerdict={aiVerdict}
        aiVerdictStatus={aiVerdictStatus}
      />
    );
  }

  // ━━━ 에러 화면 ━━━
  if (stage === "error") {
    return <ErrorScreen errorMsg={errorMsg} />;
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

  // 도감 검색용 키워드/작물명 — 선택된 작물 기준 (하드코딩 제거)
  const { keyword: mainKeyword, cropName: mainCropName } = normalizeForSearch(result.disease_name, crop);

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
      symptoms: aiVerdict?.reasons ?? [],
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
      <PageHeader title="진단 결과" backHref="/diagnose" />

      <main className="flex-1 pb-6">
        {/* 진단 이미지 + bbox 오버레이 */}
        {image && <DetectionOverlay image={image} result={result} />}

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

          {/* 종합 건강 평가 (병해 + 센서) */}
          <HealthAssessment
            detected={true}
            diseaseName={result.disease_name}
            confidence={result.confidence}
            severity={result.severity}
            sensors={sensors}
            cropName={crop}
            aiVerdict={aiVerdict}
            aiVerdictStatus={aiVerdictStatus}
          />

          {/* NCPMS 매칭 로딩 */}
          {ncpmsLoading && (
            <div className="mb-5 p-4 rounded-2xl bg-bg-soft flex items-center gap-3">
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
                  <h3 className="text-sm font-bold text-g1 mb-1 flex items-center gap-1.5">
                    <BookIcon className="w-4 h-4" /> NCPMS 공식 도감에서 자세히 보기 ↗
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
              href={`/dodam/disease?keyword=${encodeURIComponent(mainKeyword)}&crop=${encodeURIComponent(mainCropName)}`}
              className="block mb-5 p-4 rounded-2xl bg-g5 border-2 border-g3 hover:bg-g4 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-g1 mb-1 flex items-center gap-1.5">
                    <BookIcon className="w-4 h-4" /> 도감에서 찾아보기
                  </h3>
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
              <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
                <SearchIcon className="w-4 h-4" /> 다른 가능성
              </h3>
              <div className="flex flex-col gap-1.5">
                {otherSuspects.map((s, i) => {
                  const { keyword: kw, cropName: kwCropName } = normalizeForSearch(s.name, crop);
                  return (
                    <Link
                      key={i}
                      href={`/dodam/disease?keyword=${encodeURIComponent(kw)}&crop=${encodeURIComponent(kwCropName)}`}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-bg-soft hover:bg-g5 transition"
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
          <p className="text-xs text-txt3 text-center mb-5 leading-relaxed flex flex-col items-center gap-1">
            <WarningIcon className="w-4 h-4" />
            <span>AI 진단은 참고용이며, 정확한 진단은<br />
            농업기술센터 또는 전문가 상담을 권장합니다</span>
          </p>

          {/* 버튼들 */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleSave}
              disabled={saved || saving}
              className={`w-full py-3.5 rounded-2xl font-bold text-center transition flex items-center justify-center gap-1.5 ${
                saved
                  ? "bg-g5 text-g1"
                  : "bg-g1 text-white hover:bg-g2 disabled:opacity-50"
              }`}
            >
              {saved ? (
                <>
                  <CheckIcon className="w-4 h-4" /> 기록에 저장됨
                </>
              ) : saving ? (
                "저장 중..."
              ) : (
                <>
                  <RecordIcon className="w-4 h-4" /> 진단 기록 저장
                </>
              )}
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
