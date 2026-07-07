"use client";

import { CROP_GUIDE, OptimalRange } from "@/lib/cropGuide";
import { TempIcon, HumidityIcon, SoilIcon, BulbIcon, LeafIcon, StrawberryIcon } from "@/components/Icons";
import PageHeader from "@/components/PageHeader";

export default function GuidePage() {
  const crops = Object.values(CROP_GUIDE);

  return (
    <div className="phone-frame overflow-y-auto">
      <PageHeader title="작물 키우기 가이드" backHref="/home" />

      <main className="flex-1 px-5 py-5">
        <div className="flex items-start gap-2 mb-4">
          <p className="text-xs text-txt2 leading-relaxed flex-1">
            작물별 <b className="text-g1">적정 온도·습도·토양수분</b> 범위와 재배 팁이에요.
            실시간 화면에서 이 범위와 비교해 자동으로 평가도 해드려요.
          </p>
          <LeafIcon className="w-5 h-5 shrink-0 mt-0.5" />
        </div>

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
  const CropIcon = c.label === "딸기" ? StrawberryIcon : LeafIcon;
  return (
    <div className="rounded-2xl bg-bg-soft p-4">
      <div className="flex items-center gap-2 mb-3">
        <CropIcon className="w-7 h-7" />
        <h2 className="text-base font-extrabold">{c.label}</h2>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <RangeBox icon={<TempIcon className="w-6 h-6" />} label="온도" range={c.temp} unit="°C" color="#F08080" />
        <RangeBox icon={<HumidityIcon className="w-6 h-6" />} label="습도" range={c.hum} unit="%" color="#4A90E2" />
        <RangeBox icon={<SoilIcon className="w-6 h-6" />} label="토양수분" range={c.soil} unit="%" color="#4ECAA0" />
      </div>

      <div className="flex items-start gap-2 text-xs text-txt2 leading-relaxed bg-g5 rounded-xl p-3">
        <BulbIcon className="w-5 h-5 shrink-0 mt-0.5" />
        <p>{c.tip}</p>
      </div>
    </div>
  );
}

function RangeBox({
  icon, label, range, unit, color,
}: { icon: React.ReactNode; label: string; range: [number, number]; unit: string; color: string }) {
  return (
    <div className="rounded-xl border border-brd p-2.5 text-center">
      <div className="mb-1 flex justify-center">{icon}</div>
      <div className="text-[10px] text-txt3 mb-0.5">{label}</div>
      <div className="text-sm font-extrabold" style={{ color }}>
        {range[0]}~{range[1]}
      </div>
      <div className="text-[9px] text-txt3">{unit}</div>
    </div>
  );
}
