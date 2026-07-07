"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchDodam } from "@/lib/dodam";
import { getMyDevices, readSensors } from "@/lib/sensors";
import {
  Stage,
  AnalyzingPhase,
  DiagnosisResult,
  CONFIDENCE_THRESHOLD,
  PING_INTERVAL_MS,
  PING_MAX_ATTEMPTS,
  normalizeForSearch,
} from "./lib";

export function useDiagnosis() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("analyzing");
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState("");
  const [cropId, setCropId] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [sensors, setSensors] = useState<{ temp: number | null; hum: number | null; soil: number | null } | null>(null);

  // NCPMS sickKey 매칭 (detail은 호출 X - SVC05 작동 안 함)
  const [ncpmsLoading, setNcpmsLoading] = useState(false);
  const [ncpmsSickKey, setNcpmsSickKey] = useState<string | null>(null);

  // 분석 진행 단계 — "모델 깨우는 중" → "분석 중"
  const [analyzingPhase, setAnalyzingPhase] = useState<AnalyzingPhase>("waking");

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

    // 종합 평가용 센서값 로드 (스냅샷에서 넘어온 값 우선, 없으면 내 디바이스 최신값)
    (async () => {
      const raw = sessionStorage.getItem("diagnose_sensors");
      if (raw) {
        try { setSensors(JSON.parse(raw)); return; } catch {}
      }
      const devices = await getMyDevices();
      if (devices.length > 0) {
        const r = await readSensors(devices[0].id);
        if (r.ok) setSensors({ temp: r.temp, hum: r.hum, soil: r.soil });
      }
    })();

    (async () => {
      try {
        const result = await requestDiagnose(img);

        if (!result.ok) {
          const data = result.data as { error?: string; detail?: string } | undefined;
          setErrorMsg(data?.detail ?? data?.error ?? result.errorMsg ?? "알 수 없는 오류");
          setStage("error");
          return;
        }

        const data = result.data as unknown as {
          detected: boolean;
          confidence?: number;
          [k: string]: unknown;
        };

        if (!data.detected) {
          setStage("not_detected");
          return;
        }

        // ✨ 신뢰도 체크: 임계값 미만이면 판독 불가 처리
        console.log(`[Diagnose] confidence: ${data.confidence}, threshold: ${CONFIDENCE_THRESHOLD}`);
        if (typeof data.confidence !== "number" || data.confidence < CONFIDENCE_THRESHOLD) {
          setStage("low_confidence");
          return;
        }

        setResult(data as unknown as DiagnosisResult);
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
  };
}
