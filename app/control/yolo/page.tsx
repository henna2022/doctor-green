"use client";

// ━━━ STEP 2 — AI 비전(YOLO) 학습 (완전 가상) ━━━
//   ① 샘플 잎 사진 불러오기 → ② 학습(데이터준비·반복·가중치·추론 시각화)
//   → 모델 등록 → ③ 새 사진 진단 → diagnoses 테이블에 INSERT → 진단 기능 ON
import { useEffect, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  useRoom,
  useRoomState,
  insertDiagnosis,
  activateStation,
  deactivateStation,
} from "@/lib/sim";
import {
  ControlShell,
  ConceptCard,
  StatusPill,
  StepTitle,
  SupabasePanel,
  DoneBanner,
  fmtTime,
} from "../shared";

const CLASSES = [
  { name: "건강한 잎", color: "#4ECAA0", weight: 0.5 },
  { name: "병해 의심", color: "#F08080", weight: 0.3 },
  { name: "해충 흔적", color: "#FFA500", weight: 0.2 },
];
const CROPS = ["토마토", "고추", "상추", "딸기", "오이"];
const W_COLS = 8;
const W_CELLS = W_COLS * 5;

type Phase = "idle" | "prep" | "train" | "infer" | "done";
type Curve = { epoch: number; loss: number; acc: number };
type Thumb = { tone: number; sick: boolean; cls: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const genWeights = () => Array.from({ length: W_CELLS }, () => Math.random());

// 합성 잎 썸네일 (실제 사진 없이도 학습 과정을 보여주기 위함)
function genThumbs(): Thumb[] {
  return Array.from({ length: 12 }, () => {
    const cls = Math.random() < 0.5 ? 0 : Math.random() < 0.6 ? 1 : 2;
    return { tone: 0.55 + Math.random() * 0.4, sick: cls !== 0, cls };
  });
}
function pickClass(): number {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < CLASSES.length; i++) {
    acc += CLASSES[i].weight;
    if (r <= acc) return i;
  }
  return 0;
}

export default function YoloStationPage() {
  const [room] = useRoom();
  const state = useRoomState(room);
  const active = state.stations.yolo.active;

  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [epochs, setEpochs] = useState(20);
  const [labeled, setLabeled] = useState(0);
  const [curve, setCurve] = useState<Curve[]>([]);
  const [feedIdx, setFeedIdx] = useState(-1);
  const [weights, setWeights] = useState<number[]>(genWeights);
  const runId = useRef(0);

  useEffect(() => () => { runId.current++; }, []); // 언마운트 시 진행 취소

  const accuracy = curve.length ? curve[curve.length - 1].acc : 0;
  const lastLoss = curve.length ? curve[curve.length - 1].loss : 0;
  const running = phase === "prep" || phase === "train" || phase === "infer";

  const loadSamples = () => {
    runId.current++;
    setThumbs(genThumbs());
    setPhase("idle");
    setLabeled(0);
    setCurve([]);
    setFeedIdx(-1);
    setWeights(genWeights());
  };

  const train = async () => {
    if (thumbs.length === 0) return;
    const my = ++runId.current;
    const alive = () => my === runId.current;
    setCurve([]); setFeedIdx(-1);

    // ① 데이터 준비 — 라벨 하나씩
    setPhase("prep"); setLabeled(0);
    for (let i = 0; i < thumbs.length; i++) {
      if (!alive()) return;
      setLabeled(i + 1);
      await sleep(120);
    }
    await sleep(400);

    // ② 반복 학습 + ③ 가중치 조정
    if (!alive()) return;
    setPhase("train");
    let finalAcc = 92;
    for (let e = 1; e <= epochs; e++) {
      if (!alive()) return;
      const loss = 2.4 * Math.exp(-0.18 * e) + Math.random() * 0.06;
      const acc = Math.min(0.985, 0.32 + 0.66 * (1 - Math.exp(-0.24 * e)) + Math.random() * 0.02);
      finalAcc = +(acc * 100).toFixed(1);
      setCurve((c) => [...c, { epoch: e, loss: +loss.toFixed(3), acc: finalAcc }]);
      setFeedIdx(e % thumbs.length);
      setWeights(genWeights());
      await sleep(240);
    }
    await sleep(350);

    // ④ 추론
    if (!alive()) return;
    setFeedIdx(-1);
    setPhase("infer");
    await sleep(700);
    if (!alive()) return;
    setPhase("done");
    activateStation(room, "yolo", { accuracy: Math.round(finalAcc), images: thumbs.length });
  };

  const diagnose = () => {
    const cls = pickClass();
    const crop = CROPS[Math.floor(Math.random() * CROPS.length)];
    const confidence = +(80 + Math.random() * 17).toFixed(1);
    insertDiagnosis(room, { crop, label: CLASSES[cls].name, confidence });
  };

  return (
    <ControlShell title="STEP 2 · AI 비전(YOLO)" room={room}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-txt2">병해충 찾는 AI 학습시키기</p>
        <StatusPill active={active} />
      </div>

      <ConceptCard emoji="🧠" title="AI는 어떻게 병든 잎을 알까요?">
        정답을 <b>네모(라벨)</b>로 표시한 사진을 잔뜩 보여주면, AI가 수없이 반복(epoch)하며
        틀린 만큼(loss) 내부 숫자(가중치)를 조금씩 고쳐요. 그래서 <b>loss는 내려가고
        정확도는 올라가요.</b>
      </ConceptCard>

      {/* ① 샘플 불러오기 */}
      <StepTitle n={1}>학습용 사진 준비</StepTitle>
      <button
        onClick={loadSamples}
        disabled={running}
        className="w-full bg-bg-card border-2 border-brd text-txt2 font-bold text-sm py-3 rounded-2xl mb-2 disabled:opacity-50"
      >
        📷 샘플 잎 사진 12장 불러오기
      </button>

      {thumbs.length > 0 && (
        <>
          {/* 데이터셋 썸네일 */}
          <div className="grid grid-cols-4 gap-1.5 mb-4">
            {thumbs.map((t, i) => {
              const show = i < labeled || phase === "train" || phase === "infer" || phase === "done";
              const feeding = phase === "train" && i === feedIdx;
              return (
                <div
                  key={i}
                  className={`relative rounded-md overflow-hidden border h-14 flex items-center justify-center ${
                    feeding ? "ring-2 ring-g1 border-g1" : "border-brd"
                  }`}
                  style={{
                    background: `linear-gradient(135deg, hsl(${95 + t.tone * 35} 45% ${
                      40 + t.tone * 18
                    }%), hsl(${110} 35% 30%))`,
                  }}
                >
                  <span className="text-lg opacity-90">🌿</span>
                  {t.sick && <span className="absolute bottom-1 right-1 text-[9px]">🟤</span>}
                  {show && (
                    <span
                      className="absolute inset-1.5 border-2 rounded-sm"
                      style={{ borderColor: CLASSES[t.cls].color }}
                    >
                      <span
                        className="absolute -top-2.5 left-0 text-[7px] font-bold px-0.5 rounded-sm text-white whitespace-nowrap"
                        style={{ background: CLASSES[t.cls].color }}
                      >
                        {CLASSES[t.cls].name}
                      </span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* ② 학습 설정 + 시작 */}
          <StepTitle n={2}>학습 시작</StepTitle>
          <div className="bg-bg-card border border-brd rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] font-bold">반복 횟수 (epoch)</span>
              <span className="text-sm font-extrabold text-g1">{epochs}</span>
            </div>
            <input
              type="range"
              min={10}
              max={30}
              value={epochs}
              disabled={running}
              onChange={(e) => setEpochs(+e.target.value)}
              className="w-full accent-g1"
            />
            <p className="text-[11px] text-txt3 mt-1">
              많이 반복할수록 정확도가 올라가지만, 어느 순간부터는 거의 그대로예요.
            </p>
          </div>

          {/* 가중치 격자 */}
          <div className="bg-bg-card border border-brd rounded-2xl p-3 mb-3">
            <p className="text-[11px] font-bold text-txt2 mb-2">
              ② 모델 가중치 {phase === "train" ? `· epoch ${curve.length}/${epochs} 조정 중…` : ""}
            </p>
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${W_COLS}, 1fr)` }}>
              {weights.map((w, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-[2px] transition-colors duration-200"
                  style={{ background: `rgba(78,202,160,${phase === "idle" ? 0.15 : 0.2 + w * 0.8})` }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={train}
            disabled={running}
            className="w-full bg-g1 text-white font-extrabold text-sm py-3 rounded-2xl active:scale-[0.99] transition mb-4 disabled:opacity-50"
          >
            {running
              ? phase === "prep"
                ? `라벨링 중… ${labeled}/${thumbs.length}`
                : phase === "train"
                ? "학습 진행 중…"
                : "인식(추론) 중…"
              : phase === "done"
              ? "다시 학습"
              : "🚀 학습 시작"}
          </button>

          {/* loss/정확도 그래프 */}
          {curve.length > 0 && (
            <div className="bg-bg-card border border-brd rounded-2xl p-3 mb-4">
              <div className="flex gap-4 text-[13px] mb-1.5 px-1">
                <span>loss <b className="text-red">{lastLoss}</b></span>
                <span>정확도 <b className="text-g1">{accuracy}%</b></span>
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={curve}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="epoch" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="loss" stroke="#F08080" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="acc" stroke="#4ECAA0" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* ③ 진단 (모델이 학습된 뒤) */}
      {(phase === "done" || active) && (
        <>
          <StepTitle n={3}>새 사진으로 진단하기</StepTitle>
          <p className="text-[13px] text-txt2 mb-2">
            학습된 모델에 새 잎을 넣으면 <b>종류와 확률</b>로 답해요. 결과는 DB에 저장돼요.
          </p>
          <button
            onClick={diagnose}
            className="w-full bg-g3 text-g1 font-extrabold text-sm py-3 rounded-2xl active:scale-[0.99] transition mb-4"
          >
            🌿 새 잎 사진 진단하기
          </button>
        </>
      )}

      {/* 가상 Supabase */}
      <p className="text-xs font-bold text-txt2 mb-2">진단 결과가 이렇게 저장돼요 👇</p>
      <SupabasePanel
        table="diagnoses"
        columns={[
          { key: "id", label: "id" },
          { key: "crop", label: "crop" },
          { key: "label", label: "label" },
          { key: "confidence", label: "conf" },
          { key: "created_at", label: "created_at" },
        ]}
        rows={state.diagnoses}
        emptyHint="모델을 학습시키고 '진단하기'를 누르면 결과가 쌓여요."
        format={(k, v) =>
          k === "created_at" ? fmtTime(v) : k === "confidence" ? `${v}%` : String(v ?? "—")
        }
      />

      {active && (
        <>
          <DoneBanner href="/control/app" cta="📱 내 앱에서 확인하기">
            AI 진단 기능이 켜졌어요! (정확도 {String(state.stations.yolo.payload.accuracy ?? "")}%)
          </DoneBanner>
          <button
            onClick={() => deactivateStation(room, "yolo")}
            className="mt-3 w-full text-[12px] font-bold text-txt3 border border-brd rounded-xl py-2.5"
          >
            연결 해제
          </button>
        </>
      )}
    </ControlShell>
  );
}
