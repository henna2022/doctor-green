"use client";

import Link from "next/link";
import { CROP_GUIDE, OptimalRange } from "@/lib/cropGuide";

export default function GuidePage() {
  const crops = Object.values(CROP_GUIDE);

  return (
    <div className="phone-frame overflow-y-auto">
      <header className="flex items-center justify-between px-5 py-4 border-b border-brd sticky top-0 bg-bg-main z-10">
        <Link href="/home" className="text-2xl">‹</Link>
        <h1 className="text-base font-bold">작물 키우기 가이드</h1>
        <div className="w-6" />
      </header>

      <main className="flex-1 px-5 py-5">
        <p className="text-xs text-txt2 mb-4 leading-relaxed">
          작물별 <b className="text-g1">적정 온도·습도·토양수분</b> 범위와 재배 팁이에요.
          실시간 화면에서 이 범위와 비교해 자동으로 평가도 해드려요. 🌱
        </p>

        <div className="flex flex-col gap-3.5">
          {crops.map((c) => (
            <CropCard key={c.label} c={c} />
          ))}
        </div>

        <p className="text-[10px] text-txt3 text-center mt-5 leading-relaxed">
          ※ 일반적인 권장 범위예요. 품종·계절·재배 환경에 따라 달라질 수 있어요.
        </p>
      </main>
    </div>
  );
}

function CropCard({ c }: { c: OptimalRange }) {
  return (
    <div className="rounded-2xl bg-bg-card border border-brd p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{c.emoji}</span>
        <h2 className="text-base font-extrabold">{c.label}</h2>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <RangeBox icon="🌡️" label="온도" range={c.temp} unit="°C" color="#F08080" />
        <RangeBox icon="💧" label="습도" range={c.hum} unit="%" color="#4A90E2" />
        <RangeBox icon="🌱" label="토양수분" range={c.soil} unit="%" color="#4ECAA0" />
      </div>

      <p className="text-xs text-txt2 leading-relaxed bg-g5 rounded-xl p-3">
        💡 {c.tip}
      </p>
    </div>
  );
}

function RangeBox({
  icon, label, range, unit, color,
}: { icon: string; label: string; range: [number, number]; unit: string; color: string }) {
  return (
    <div className="rounded-xl border border-brd p-2.5 text-center">
      <div className="text-lg leading-none mb-1">{icon}</div>
      <div className="text-[10px] text-txt3 mb-0.5">{label}</div>
      <div className="text-sm font-extrabold" style={{ color }}>
        {range[0]}~{range[1]}
      </div>
      <div className="text-[9px] text-txt3">{unit}</div>
    </div>
  );
}
