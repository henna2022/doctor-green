"use client";

import { Suspense } from "react";
import DodamList from "@/components/DodamList";

export default function DiseasePage() {
  return (
    <Suspense fallback={<DodamLoading />}>
      <DodamList title="질병 도감" type="disease" emptyEmoji="🌿" />
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