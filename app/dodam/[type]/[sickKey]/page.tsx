"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function DodamDetailRedirect() {
  const params = useParams();
  const sickKey = params.sickKey as string;

  useEffect(() => {
    if (!sickKey) return;
    window.location.replace(
      `https://ncpms.rda.go.kr/mobile/MobileSicknsDtlR.ms?dtlKey=${sickKey}&totalSearchYn=Y`
    );
  }, [sickKey]);

  return (
    <div className="phone-frame items-center justify-center">
      <div className="text-center px-5">
        <div className="w-10 h-10 border-4 border-g5 border-t-g1 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-txt2">NCPMS 도감으로 이동 중...</p>
      </div>
    </div>
  );
}
