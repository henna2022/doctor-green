"use client";

import { Suspense } from "react";
import DodamList from "@/components/DodamList";
import { BugIcon } from "@/components/Icons";

export default function PestPage() {
  return (
    <Suspense fallback={<DodamLoading />}>
      <DodamList title="해충 도감" type="pest" emptyIcon={<BugIcon className="w-full h-full" />} />
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