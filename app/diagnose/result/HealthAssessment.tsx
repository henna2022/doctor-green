import { assessEnvironment, getGuide, EnvAssessment } from "@/lib/cropGuide";
import { inferWatering } from "@/lib/watering";
import { Verdict } from "./lib";
import type { AiVerdictStatus } from "./useDiagnosis";
import {
  SearchIcon,
  CameraIcon,
  SproutIcon,
  LeafIcon,
  AlertIcon,
  WarningIcon,
  PartyIcon,
  TempIcon,
  HumidityIcon,
  SoilIcon,
} from "@/components/Icons";

// ━━━ 종합 건강 평가 (병해 결과 + 센서 환경) ━━━
export function HealthAssessment({
  detected,
  unclear,
  diseaseName,
  confidence,
  severity,
  sensors,
  cropName,
  aiVerdict,
  aiVerdictStatus,
}: {
  detected: boolean;
  unclear?: boolean;
  diseaseName?: string;
  confidence?: number;
  severity?: string;
  sensors: { temp: number | null; hum: number | null; soil: number | null; stale?: boolean } | null;
  cropName: string;
  aiVerdict?: Verdict | null;
  aiVerdictStatus?: AiVerdictStatus;
}) {
  const guide = getGuide(cropName);
  const env: EnvAssessment | null = sensors ? assessEnvironment(sensors, cropName) : null;

  // 💧 수분 상태 판정 — 비전 병징 + 토양수분 결합 추론.
  // 미탐지(신뢰도 낮음)면 leafSymptom=null(센서 조기경보), 병해 없음이면 "정상", 병해면 원문 전달.
  const leafSymptom = detected ? diseaseName ?? "기타" : unclear ? null : "정상";
  // 센서가 있거나(둘 다 결합) 병해가 탐지됐으면(비전만으로 보수적) 판정 표시
  const watering =
    sensors || detected
      ? inferWatering({
          leafSymptom,
          confidence: detected ? confidence ?? 0 : 0,
          soil: sensors?.soil ?? null,
          temp: sensors?.temp ?? null,
          hum: sensors?.hum ?? null,
          stale: sensors?.stale ?? false,
          crop: cropName,
        })
      : null;

  const palette = (l: string) =>
    l === "bad"
      ? { bg: "#FFEAEA", color: "#E05757" }
      : l === "warn"
      ? { bg: "#FFF4E5", color: "#D98A00" }
      : { bg: "#E8F8F0", color: "#2E9E76" };

  const envStatus = env?.status ?? "ok";
  let EmojiIcon = SproutIcon;
  let title = `${guide.label}에서 병해는 안 보여요`;
  let sub = "더 가까이 선명하게 찍으면 정확도가 올라가요.";
  let tone = "ok";

  if (unclear) {
    // 신뢰도 낮음 — 병해 없음 단정 대신 판독 불가 톤으로 안내
    EmojiIcon = SearchIcon;
    title = "확실하지 않아요";
    sub = "다른 각도로 더 가까이, 선명하게 다시 찍어보세요.";
    tone = "warn";
  } else if (detected) {
    EmojiIcon = WarningIcon;
    title = `${diseaseName ?? "병해"}가 의심돼요${severity ? ` (${severity})` : ""}`;
    sub = "아래 도감에서 방제법을 확인하고, 환경도 함께 관리하세요.";
    tone = "warn";
  } else if (env) {
    if (envStatus === "ok") {
      EmojiIcon = PartyIcon;
      title = `${guide.label}가 잘 자라고 있어요!`;
      sub = "병해도 없고 온·습·토양도 적정 범위예요. 지금처럼 관리해주세요.";
      tone = "ok";
    } else if (envStatus === "warn") {
      EmojiIcon = LeafIcon;
      title = "병해는 없지만 환경에 약간 주의가 필요해요";
      sub = "아래 항목을 살짝 조정해주세요.";
      tone = "warn";
    } else {
      EmojiIcon = AlertIcon;
      title = "병해는 없지만 환경이 좋지 않아요";
      sub = "아래 빨간 항목을 먼저 해결해주세요.";
      tone = "bad";
    }
  }

  const c = palette(tone);

  return (
    <section className="mb-5">
      <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
        <SproutIcon className="w-4 h-4" /> 종합 건강 평가
      </h3>

      <div className="p-4 rounded-2xl border-2" style={{ background: c.bg, borderColor: c.color + "55" }}>
        <div className="flex items-start gap-2">
          <EmojiIcon className="w-7 h-7 shrink-0" />
          <div>
            <p className="text-sm font-extrabold" style={{ color: c.color }}>{title}</p>
            <p className="text-xs text-txt2 mt-0.5 leading-relaxed">{sub}</p>
          </div>
        </div>
      </div>

      {env ? (
        <div className="mt-2 flex flex-col gap-1.5">
          {env.items.map((it, i) => {
            const lc = palette(it.level);
            const ItemIcon = { "온도": TempIcon, "습도": HumidityIcon, "토양수분": SoilIcon }[it.kind];
            return (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-bg-soft">
                <ItemIcon className="w-5 h-5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold">{it.kind}</span>
                    <span className="text-xs font-extrabold" style={{ color: lc.color }}>
                      {it.value}{it.kind === "온도" ? "°C" : "%"}
                    </span>
                  </div>
                  <p className="text-[11px] text-txt2 leading-snug mt-0.5">{it.text}</p>
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-txt3 text-center mt-0.5 flex items-center justify-center gap-1">
            <LeafIcon className="w-3.5 h-3.5" /> {guide.tip}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-txt3 text-center leading-relaxed">
          연결된 센서가 없어 환경 평가는 생략했어요.<br />실시간 화면에서 <CameraIcon className="w-3.5 h-3.5 inline-block align-text-bottom" /> 스냅샷으로 진단하면 센서값이 함께 반영돼요.
        </p>
      )}

      {/* 💧 수분 상태 판정 (비전 병징 + 토양수분 결합) */}
      {watering && (() => {
        const wc = palette(watering.status);
        return (
          <div className="mt-2 p-4 rounded-2xl border-2" style={{ background: wc.bg, borderColor: wc.color + "55" }}>
            <h4 className="text-xs font-bold mb-2 flex items-center gap-1.5">
              💧 수분 상태 판정
              <span className="ml-auto flex items-center gap-1">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: wc.color, color: "#fff" }}>
                  {watering.cause}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-bg-soft text-txt2">
                  확신 {watering.certainty}
                </span>
              </span>
            </h4>

            {(watering.visionPart || watering.sensorPart) && (
              <div className="flex flex-col gap-1 mb-2">
                {watering.visionPart && (
                  <p className="text-[11px] text-txt2 flex items-start gap-1.5">
                    <LeafIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {watering.visionPart}
                  </p>
                )}
                {watering.sensorPart && (
                  <p className="text-[11px] text-txt2 flex items-start gap-1.5">
                    <SoilIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {watering.sensorPart}
                  </p>
                )}
              </div>
            )}

            <p className="text-sm font-bold leading-snug" style={{ color: wc.color }}>{watering.reason}</p>
            <p className="text-[11px] text-txt2 leading-relaxed mt-1">👉 {watering.advice}</p>
          </div>
        );
      })()}

      {/* AI 종합 소견 (LLM verdict) — 기존 규칙기반 평가에 더해지는 보조 정보 */}
      {aiVerdictStatus === "loading" ? (
        <div className="mt-2 p-3 rounded-xl bg-bg-soft flex items-center gap-2.5">
          <div className="w-4 h-4 border-2 border-g5 border-t-g1 rounded-full animate-spin shrink-0" />
          <p className="text-xs text-txt2">AI가 종합 소견을 작성 중...</p>
        </div>
      ) : aiVerdictStatus === "ready" && aiVerdict ? (
        <div className="mt-2 p-4 rounded-2xl bg-g5 border border-g3">
          <h4 className="text-xs font-bold text-g1 mb-2 flex items-center gap-1.5">
            🌿 AI 종합 소견
            {aiVerdict.confidence === "low" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange/20 text-orange">
                확실하지 않아요
              </span>
            )}
          </h4>
          <p className="text-sm font-extrabold text-g1 leading-snug">{aiVerdict.headline}</p>

          {aiVerdict.reasons.length > 0 && (
            <ul className="mt-2.5 flex flex-col gap-1">
              {aiVerdict.reasons.map((reason, i) => (
                <li key={i} className="text-[11px] text-txt2 leading-relaxed flex items-start gap-1.5">
                  <span className="text-g2 shrink-0">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          )}

          {aiVerdict.actions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-g3/60">
              <p className="text-[11px] font-bold text-g1 mb-1">권장 조치</p>
              <ul className="flex flex-col gap-1">
                {aiVerdict.actions.map((action, i) => (
                  <li key={i} className="text-[11px] text-txt2 leading-relaxed flex items-start gap-1.5">
                    <span className="text-g2 shrink-0">✓</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
