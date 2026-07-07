"use client";

import { Suspense } from "react";
import DodamList from "@/components/DodamList";
import { LeafIcon } from "@/components/Icons";

export default function DiseasePage() {
  return (
    <Suspense fallback={<DodamLoading />}>
      <DodamList title="질병 도감" type="disease" emptyIcon={<LeafIcon className="w-full h-full" />} />
    </Suspense>
  );
}

function DodamLoading() {
  return (
    <div className="phone-frame items-center justify-center">
      <div className="w-10 h-10 border-4 border-g5 border-t-g1 rounded-full animate-spin" />
    </div>
  );
}