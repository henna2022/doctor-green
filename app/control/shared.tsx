"use client";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// /control 가상 실습실 공용 컴포넌트
//   ▸ ControlShell   — 폰 프레임 + 헤더(뒤로/방 번호)
//   ▸ ConceptCard    — "왜?" 미니 개념 설명
//   ▸ StatusPill     — 연결됨/미연결 상태 뱃지
//   ▸ FlowDiagram    — 디바이스 → 인터넷 → Supabase 전송 애니메이션
//   ▸ SupabasePanel  — 가상 Supabase 테이블(행 INSERT 연출) ★핵심
//   ▸ CodeView       — 타이핑 없이 자동으로 값이 채워지는 읽기용 코드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { SimRow } from "@/lib/sim";

// 행에서 임의 컬럼 값을 안전하게 읽기
const cell = (row: SimRow, key: string): unknown =>
  (row as unknown as Record<string, unknown>)[key];

// ━━━ 폰 프레임 + 헤더 ━━━
export function ControlShell({
  title,
  room,
  backHref = "/control",
  children,
}: {
  title: string;
  room: string;
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="phone-frame overflow-y-auto pb-12">
      <PageHeader
        title={title}
        backHref={backHref}
        rightAction={
          <span className="text-[11px] font-bold text-g1 bg-g5 px-2.5 py-1 rounded-full whitespace-nowrap">
            {room}번 방
          </span>
        }
      />
      <main className="px-5 py-5">{children}</main>
    </div>
  );
}

// ━━━ 상태 뱃지 ━━━
export function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
        active ? "bg-g3 text-g1" : "bg-[#F2F2EE] text-txt3"
      }`}
    >
      {active ? "● 연결됨" : "○ 미연결"}
    </span>
  );
}

// ━━━ "왜?" 개념 카드 ━━━
export function ConceptCard({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-g5 border border-g4 rounded-2xl p-4 mb-5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-lg">{emoji}</span>
        <h3 className="text-sm font-extrabold text-g1">{title}</h3>
      </div>
      <p className="text-[13px] text-txt2 leading-relaxed">{children}</p>
    </div>
  );
}

// ━━━ 섹션 소제목 ━━━
export function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-1">
      <span className="w-6 h-6 rounded-full bg-g1 text-white text-xs font-extrabold flex items-center justify-center shrink-0">
        {n}
      </span>
      <h2 className="text-[15px] font-extrabold">{children}</h2>
    </div>
  );
}

// ━━━ 전송 흐름 애니메이션: [출발] → 인터넷 → [Supabase] ━━━
// pingKey 가 바뀔 때마다 패킷(점)이 왼→오로 한 번 흐른다.
export function FlowDiagram({
  from,
  pingKey,
}: {
  from: string; // 예: "🌡 센서 (ESP32)"
  pingKey: number;
}) {
  return (
    <div className="relative bg-bg-card border border-brd rounded-2xl px-4 py-3 mb-4 overflow-hidden">
      <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
        <span className="text-txt2 whitespace-nowrap">{from}</span>
        <span className="text-txt3">·· 인터넷 ··</span>
        <span className="text-g1 whitespace-nowrap">🗄 Supabase</span>
      </div>
      {/* 흐르는 패킷 */}
      {pingKey > 0 && (
        <span
          key={pingKey}
          className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-g3"
          style={{ marginTop: -5, animation: "simFlow 0.9s ease-in-out" }}
        />
      )}
      <p className="mt-2 text-[10px] text-txt3 font-mono">
        POST /rest/v1 · 측정값을 데이터베이스로 전송
      </p>
    </div>
  );
}

// ━━━ 읽기용 코드 뷰 (타이핑 없음 — 슬롯 값이 자동으로 채워짐) ━━━
// parts 안의 { slot: "라벨" } 자리에 filled 값이 들어가면 노랗게 강조된다.
type CodePart = string | { slot: string; value: string | null };

export function CodeView({ parts }: { parts: CodePart[] }) {
  return (
    <pre className="rounded-2xl bg-[#0f172a] text-[#e2e8f0] font-mono text-[12px] leading-relaxed p-4 overflow-x-auto whitespace-pre-wrap mb-4">
      {parts.map((p, i) => {
        if (typeof p === "string") return <span key={i}>{p}</span>;
        if (p.value) {
          return (
            <span
              key={i}
              className="inline-block bg-[#fde68a] text-[#1e293b] font-bold rounded px-1.5 py-0.5 mx-0.5"
              style={{ animation: "simPop 0.4s ease-out" }}
            >
              {p.value}
            </span>
          );
        }
        return (
          <span
            key={i}
            className="inline-block border border-dashed border-[#64748b] text-[#64748b] rounded px-2 py-0.5 mx-0.5"
          >
            {p.slot}
          </span>
        );
      })}
    </pre>
  );
}

// ━━━ 가상 Supabase 테이블 패널 ★수업의 핵심 시각화 ★ ━━━
// 행이 INSERT 되면 맨 위에 새 행이 강조되며 나타난다.
export type Column = { key: string; label: string };

export function SupabasePanel({
  table,
  columns,
  rows,
  emptyHint = "아직 데이터가 없어요. 위에서 버튼을 눌러 전송해 보세요.",
  format,
}: {
  table: string;
  columns: Column[];
  rows: readonly SimRow[];
  emptyHint?: string;
  format?: (key: string, value: unknown) => string;
}) {
  // 최신 행이 위로 오도록 역순, 최근 6개만
  const view = [...rows].reverse().slice(0, 6);
  const fmt = (k: string, v: unknown) =>
    format ? format(k, v) : v == null ? "—" : String(v);

  // 최신 INSERT 문 (읽기용 연출)
  const latest = rows[rows.length - 1];
  const insertCols = columns.filter((c) => c.key !== "id" && c.key !== "created_at");
  const insertSql = latest
    ? `INSERT INTO ${table} (${insertCols.map((c) => c.key).join(", ")})\n  VALUES (${insertCols
        .map((c) => {
          const v = cell(latest, c.key);
          return typeof v === "number" ? String(v) : `'${fmt(c.key, v)}'`;
        })
        .join(", ")});`
    : null;

  return (
    <div className="rounded-2xl border border-brd overflow-hidden bg-bg-card">
      {/* 헤더 (Supabase 느낌) */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1f2933]">
        <span className="text-sm">🗄</span>
        <span className="text-[12px] font-bold text-white">가상 Supabase</span>
        <span className="text-[11px] font-mono text-[#9aa5b1] truncate">public.{table}</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-g3">
          <span className="w-1.5 h-1.5 rounded-full bg-g3 inline-block" /> live
        </span>
      </div>

      {/* 최신 INSERT 문 */}
      {insertSql && (
        <pre
          key={String(latest?.id)}
          className="px-4 py-2.5 bg-[#0f172a] text-[#7ee2b8] font-mono text-[10.5px] leading-snug overflow-x-auto whitespace-pre"
          style={{ animation: "fadeIn 0.3s ease-out" }}
        >
          {insertSql}
        </pre>
      )}

      {/* 테이블 */}
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-[12px] text-txt3 text-center">{emptyHint}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-txt3 bg-[#F7F7F4]">
                {columns.map((c) => (
                  <th key={c.key} className="text-left font-semibold px-3 py-1.5 whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.map((r, idx) => (
                <tr
                  key={String(r.id)}
                  className="border-t border-brd"
                  style={idx === 0 ? { animation: "simPop 0.5s ease-out" } : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-1.5 font-mono text-txt2 whitespace-nowrap">
                      {c.key === "id" && idx === 0 ? (
                        <span className="text-g1 font-bold">{fmt(c.key, cell(r, c.key))}</span>
                      ) : (
                        fmt(c.key, cell(r, c.key))
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-4 py-2 text-[10px] text-txt3 border-t border-brd bg-[#FAFAF7]">
        rows: {rows.length} · 실시간 반영됨{rows.length > 6 ? " · 최근 6행만 표시" : ""}
      </div>
    </div>
  );
}

// ━━━ 다음 단계로 이동하는 성공 배너 ━━━
export function DoneBanner({
  children,
  href,
  cta,
}: {
  children: React.ReactNode;
  href: string;
  cta: string;
}) {
  return (
    <div className="mt-5 rounded-2xl bg-g1 text-white p-4" style={{ animation: "fadeIn 0.4s" }}>
      <p className="text-sm font-bold mb-3 leading-relaxed">✓ {children}</p>
      <Link
        href={href}
        className="inline-block bg-white text-g1 font-extrabold text-sm px-4 py-2 rounded-xl active:scale-[0.98] transition"
      >
        {cta}
      </Link>
    </div>
  );
}

// 시간 표시 (created_at → HH:MM:SS)
export function fmtTime(v: unknown): string {
  if (typeof v !== "string") return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("ko-KR", { hour12: false });
}
