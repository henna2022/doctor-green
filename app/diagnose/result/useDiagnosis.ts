"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchDodam } from "@/lib/dodam";
import { getMyDevices, readSensors } from "@/lib/sensors";
import { getDailyReport, DailyReport } from "@/lib/report";
import { assessEnvironment } from "@/lib/cropGuide";
import {
  Stage,
  AnalyzingPhase,
  DiagnosisResult,
  Verdict,
  CONFIDENCE_THRESHOLD,
  PING_INTERVAL_MS,
  PING_MAX_ATTEMPTS,
  normalizeForSearch,
} from "./lib";

export type AiVerdictStatus = "idle" | "loading" | "ready" | "off" | "error";

// 진단 화면/verdict 공용 센서 스냅샷 (stale = 마지막 측정이 오래됨)
type SensorSnapshot = { temp: number | null; hum: number | null; soil: number | null; stale?: boolean };

export function useDiagnosis() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("analyzing");
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState("");
  const [cropId, setCropId] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [sensors, setSensors] = useState<SensorSnapshot | null>(null);

  // NCPMS sickKey 매칭 (detail은 호출 X - SVC05 작동 안 함)
  const [ncpmsLoading, setNcpmsLoading] = useState(false);
  const [ncpmsSickKey, setNcpmsSickKey] = useState<string | null>(null);

  // 분석 진행 단계 — "모델 깨우는 중" → "분석 중"
  const [analyzingPhase, setAnalyzingPhase] = useState<AnalyzingPhase>("waking");

  // AI 종합 소견 (LLM verdict)
  const [aiVerdict, setAiVerdict] = useState<Verdict | null>(null);
  const [aiVerdictStatus, setAiVerdictStatus] = useState<AiVerdictStatus>("idle");

  // HF Space warm 여부를 3초 간격 최대 10회 폴링으로 추적 → warm 확인되면 "분석 중"으로 전환
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const res = await fetch("/api/diagnose/ping");
        const data = await res.json();
        if (data.ok) {
          if (!cancelled) setAnalyzingPhase("analyzing");
          return;
        }
      } catch {
        // 무시하고 재시도
      }
      if (!cancelled && attempts < PING_MAX_ATTEMPTS) {
        setTimeout(poll, PING_INTERVAL_MS);
      } else if (!cancelled) {
        // 폴링 소진 — 그래도 진단 요청 자체는 진행 중이므로 분석 중 표기로 전환
        setAnalyzingPhase("analyzing");
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  // 진단 API 호출 (502/타임아웃/네트워크 오류 시 1회 자동 재시도)
  async function requestDiagnose(img: string) {
    const call = async () => {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: img }),
      });
      const data = await res.json();
      return { res, data };
    };

    let attempt: { res: Response; data: { error?: string; detail?: string; [k: string]: unknown } } | null = null;
    let lastError: unknown = null;

    for (let i = 0; i < 2; i++) {
      try {
        attempt = await call();
        // 502/504(서버 오류)면 재시도, 그 외에는 성공/실패 여부와 무관하게 결과 확정
        if (attempt.res.ok || (attempt.res.status !== 502 && attempt.res.status !== 504)) {
          break;
        }
      } catch (e: unknown) {
        lastError = e;
        attempt = null;
      }
    }

    if (!attempt) {
      const msg = lastError instanceof Error ? lastError.message : String(lastError ?? "알 수 없는 오류");
      return { ok: false as const, errorMsg: msg };
    }

    return { ok: attempt.res.ok && !attempt.data.error, data: attempt.data };
  }

  // AI 종합 소견(LLM verdict) 요청 — stage가 확정된 후 호출
  async function requestVerdict(
    signal: AbortSignal,
    body: {
      crop: string | null;
      stage: "done" | "not_detected" | "low_confidence";
      result: DiagnosisResult | null;
      sensors: SensorSnapshot | null;
      daily: DailyReport | null;
    }
  ) {
    setAiVerdictStatus("loading");
    try {
      const trimmedResult = body.result
        ? { ...body.result, detections: body.result.detections.map((d) => ({ name: d.name, confidence: d.confidence })) }
        : null;

      const daily = body.daily
        ? {
            hasData: body.daily.hasData,
            count: body.daily.count,
            avg: body.daily.avg,
            range: body.daily.range,
            warnings: body.daily.warnings,
          }
        : null;

      // 규칙 기반 1차 평가도 함께 전달 — LLM이 결론이 다르면 이유를 설명하도록
      const ruleAssessment = body.sensors
        ? (() => {
            const env = assessEnvironment(body.sensors, body.crop);
            return {
              status: env.status,
              items: env.items.map((it) => ({ kind: it.kind, level: it.level, text: it.text })),
            };
          })()
        : null;

      const res = await fetch("/api/diagnose/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          crop: body.crop,
          stage: body.stage,
          result: trimmedResult,
          sensors: body.sensors,
          daily,
          ruleAssessment,
        }),
      });

      if (res.status === 503) {
        const data = await res.json().catch(() => null);
        if (data?.disabled) {
          setAiVerdictStatus("off");
          return;
        }
        setAiVerdictStatus("error");
        return;
      }

      if (!res.ok) {
        setAiVerdictStatus("error");
        return;
      }

      const data = await res.json();
      setAiVerdict(data as Verdict);
      setAiVerdictStatus("ready");
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setAiVerdictStatus("error");
    }
  }

  // 진단 API 호출
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const img = sessionStorage.getItem("diagnose_image");
    const cropName = sessionStorage.getItem("diagnose_crop") ?? "";
    const savedCropId = sessionStorage.getItem("diagnose_crop_id");
    const deviceId = sessionStorage.getItem("diagnose_device_id");

    if (!img) {
      router.replace("/diagnose");
      return;
    }
    setImage(img);
    setCrop(cropName);
    setCropId(savedCropId || null);

    // 종합 평가용 센서값 로드 (스냅샷에서 넘어온 값 우선, 없으면 내 디바이스 최신값)
    // 실패해도 진단 흐름은 막지 않음 — 전체를 try/catch로 감싸 null 반환
    const sensorsPromise = (async (): Promise<SensorSnapshot | null> => {
      try {
        const raw = sessionStorage.getItem("diagnose_sensors");
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (!cancelled) setSensors(parsed);
            return parsed;
          } catch {
            return null;
          }
        }
        const devices = await getMyDevices();
        if (devices.length > 0) {
          // 선택한 작물과 연결된 디바이스 우선, 없으면 기존처럼 첫 번째 디바이스
          const device =
            (savedCropId ? devices.find((d) => d.crop_id === savedCropId) : undefined) ?? devices[0];
          const r = await readSensors(device.id);
          if (r.ok) {
            const s: SensorSnapshot = { temp: r.temp, hum: r.hum, soil: r.soil, stale: r.stale };
            if (!cancelled) setSensors(s);
            return s;
          }
        }
        return null;
      } catch {
        return null;
      }
    })();

    // 실시간 화면에서 넘어온 deviceId가 있으면 24시간 센서 요약도 함께 로드 (실패해도 진단 흐름은 막지 않음)
    const dailyPromise = (async (): Promise<DailyReport | null> => {
      if (!deviceId) return null;
      try {
        return await getDailyReport(deviceId, cropName);
      } catch {
        return null;
      }
    })();

    (async () => {
      let settledStage: "done" | "not_detected" | "low_confidence" | null = null;
      let settledResult: DiagnosisResult | null = null;
      // 화면용 settledResult와 별개로, low_confidence여도 탐지 원본은 verdict에 전달
      let verdictResult: DiagnosisResult | null = null;

      try {
        const diagnoseResult = await requestDiagnose(img);

        if (!diagnoseResult.ok) {
          const data = diagnoseResult.data as { error?: string; detail?: string } | undefined;
          setErrorMsg(data?.detail ?? data?.error ?? diagnoseResult.errorMsg ?? "알 수 없는 오류");
          setStage("error");
        } else {
          const data = diagnoseResult.data as unknown as {
            detected: boolean;
            confidence?: number;
            [k: string]: unknown;
          };

          if (!data.detected) {
            settledStage = "not_detected";
            setStage("not_detected");
          } else if (typeof data.confidence !== "number" || data.confidence < CONFIDENCE_THRESHOLD) {
            // ✨ 신뢰도 체크: 임계값 미만이면 판독 불가 처리 (탐지 원본은 verdict에는 전달)
            settledStage = "low_confidence";
            verdictResult = data as unknown as DiagnosisResult;
            setStage("low_confidence");
          } else {
            settledResult = data as unknown as DiagnosisResult;
            verdictResult = settledResult;
            settledStage = "done";
            setResult(settledResult);
            setStage("done");
            // 실시간 화면의 수분 판정이 이 병징을 결합할 수 있도록 기기·시각과 함께 저장
            if (deviceId) {
              try {
                sessionStorage.setItem(
                  "diagnose_last",
                  JSON.stringify({
                    deviceId,
                    diseaseName: settledResult.disease_name,
                    confidence: settledResult.confidence,
                    at: Date.now(),
                  })
                );
              } catch {
                /* sessionStorage 실패 무시 */
              }
            }
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(msg);
        setStage("error");
      }

      // 보조 데이터(센서/일일요약/AI소견)는 어떤 실패도 이미 확정된 stage를 바꾸지 않는다
      if (settledStage && !cancelled) {
        try {
          const [sensorsSettled, dailySettled] = await Promise.allSettled([sensorsPromise, dailyPromise]);
          const sensorsValue = sensorsSettled.status === "fulfilled" ? sensorsSettled.value : null;
          const dailyValue = dailySettled.status === "fulfilled" ? dailySettled.value : null;
          if (cancelled) return;
          await requestVerdict(controller.signal, {
            crop: cropName || null,
            stage: settledStage,
            result: verdictResult,
            sensors: sensorsValue,
            daily: dailyValue,
          });
        } catch {
          if (!cancelled) setAiVerdictStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 진단 완료 후 NCPMS search로 sickKey 찾기 (외부 링크용)
  useEffect(() => {
    if (stage !== "done" || !result) return;

    (async () => {
      setNcpmsLoading(true);
      try {
        const { keyword, cropName } = normalizeForSearch(result.disease_name, crop);

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
  }, [stage, result, crop]);

  return {
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
  };
}
