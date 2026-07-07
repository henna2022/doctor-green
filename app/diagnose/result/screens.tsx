import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { SearchIcon, CameraIcon, WarningIcon } from "@/components/Icons";
import { AnalyzingPhase } from "./lib";
import { HealthAssessment } from "./HealthAssessment";

// ━━━ 분석 중 화면 ━━━
export function AnalyzingScreen({
  image,
  analyzingPhase,
}: {
  image: string | null;
  analyzingPhase: AnalyzingPhase;
}) {
  return (
    <div className="phone-frame">
      <PageHeader title="AI 진단 중" backHref="/diagnose" sticky={false} />

      <main className="flex-1 flex flex-col items-center justify-center px-5">
        {image && (
          <div className="w-40 h-40 rounded-3xl overflow-hidden border-2 border-g3 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="진단 중" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="w-12 h-12 border-4 border-g5 border-t-g1 rounded-full animate-spin mb-4" />

        {/* 진행 단계 표시: 모델 깨우는 중 → 분석 중 */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            analyzingPhase === "waking" ? "bg-g5 text-g1" : "bg-bg-soft text-txt3"
          }`}>
            1. 모델 깨우는 중
          </span>
          <span className="text-txt3">›</span>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            analyzingPhase === "analyzing" ? "bg-g5 text-g1" : "bg-bg-soft text-txt3"
          }`}>
            2. 분석 중
          </span>
        </div>

        <p className="text-base font-bold text-g1 mb-1">
          {analyzingPhase === "waking" ? "AI 모델을 깨우고 있어요" : "AI가 분석하고 있어요"}
        </p>
        <p className="text-sm text-txt2">잠시만 기다려주세요...</p>
        <p className="text-xs text-txt3 mt-2">최대 1분 정도 소요될 수 있어요</p>
      </main>
    </div>
  );
}

// ━━━ 에러 화면 ━━━
export function ErrorScreen({ errorMsg }: { errorMsg: string }) {
  return (
    <div className="phone-frame">
      <PageHeader title="진단 실패" backHref="/diagnose" sticky={false} />

      <main className="flex-1 flex flex-col items-center justify-center px-5 text-center">
        <WarningIcon className="w-14 h-14 mb-3" />
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

// ━━━ 병해 미감지 / 판독불가 → 종합 건강 평가 화면 ━━━
export function NoDetectionScreen({
  image,
  unclear,
  sensors,
  crop,
}: {
  image: string | null;
  unclear: boolean;
  sensors: { temp: number | null; hum: number | null; soil: number | null } | null;
  crop: string;
}) {
  return (
    <div className="phone-frame overflow-y-auto">
      <PageHeader title="진단 결과" backHref="/diagnose" />

      <main className="flex-1 px-5 py-5">
        {image && (
          <div className="w-full aspect-video rounded-2xl overflow-hidden border border-brd mb-4 bg-bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="진단" className="w-full h-full object-contain" />
          </div>
        )}

        {unclear && (
          <div className="mb-4 p-3 rounded-xl bg-orange/10 text-xs text-orange leading-relaxed flex items-start gap-1.5">
            <SearchIcon className="w-4 h-4 shrink-0 mt-0.5" />
            <span>사진이 흐릿해 병해 판독은 어려웠어요. 잎·과실을 더 가까이 선명하게 찍으면 정확해져요.
            <br />(아래 환경 평가는 센서 기준이라 그대로 유효해요)</span>
          </div>
        )}

        <HealthAssessment detected={false} unclear={unclear} sensors={sensors} cropName={crop} />

        <div className="flex flex-col gap-2.5 mt-2">
          <Link
            href="/diagnose"
            className="w-full py-3.5 rounded-2xl bg-g1 text-white font-bold text-center hover:bg-g2 transition flex items-center justify-center gap-1.5"
          >
            <CameraIcon className="w-4 h-4" /> 다시 진단하기
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
