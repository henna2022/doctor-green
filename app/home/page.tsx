"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { getCurrentUser, signOut } from "@/lib/auth";

const DODAM_MENU = [
  { href: "/dodam/disease", emoji: "🌿", label: "질병 도감", color: "#E8F8F0" },
  { href: "/dodam/pest", emoji: "🐛", label: "해충 도감", color: "#FFF4E5" },
  { href: "/dodam/remedy", emoji: "💊", label: "방제 정보", color: "#E5F0FF" },
  { href: "/realtime", emoji: "📡", label: "실시간 분석", color: "#F0E8F8" },
];

export default function HomePage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const user = await getCurrentUser();
      if (!user) {
        // 로그인 안 했으면 웰컴으로 보냄
        router.push("/");
        return;
      }
      setUserName(user.profile?.name || "농부");
      setRegion(user.profile?.farm_region || "");
      setLoading(false);
    }
    loadUser();
  }, [router]);

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="phone-frame items-center justify-center">
        <p className="text-txt2 text-sm">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="phone-frame">
      <header className="px-5 pt-6 pb-4 bg-bg-card border-b border-brd">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📍</span>
          <div className="flex-1">
            <p className="text-sm font-bold">{region || "지역 미설정"}</p>
          </div>
          <button onClick={handleLogout} className="text-xs text-txt3 underline">
            로그아웃
          </button>
        </div>
        <p className="text-xs text-txt3 mt-2">
          안녕하세요, <span className="font-bold text-g1">{userName}</span>님 🌿
        </p>
      </header>

      <main className="flex-1 px-5 py-5 pb-2">
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold">🔔 오늘의 알림</h2>
            <Link href="/notify" className="text-xs text-g2">전체보기 ›</Link>
          </div>
          <div className="flex flex-col gap-2">
            <AlertCard
              kind="safe"
              badge="안내"
              title="병해충 발생 없음"
              description="현재 지역 내 주요 병해충 발생 보고가 없습니다."
              source="농촌진흥청"
            />
          </div>
        </section>

        <Link
          href="/diagnose"
          className="block w-full mb-6 rounded-3xl p-5 text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #1B5E4B 0%, #4ECAA0 100%)" }}
        >
          <div className="flex items-center gap-3">
            <div className="text-4xl">📷</div>
            <div className="flex-1">
              <h3 className="text-base font-extrabold mb-0.5">AI 작물 진단</h3>
              <p className="text-xs opacity-90">사진 한 장으로 병해충을 확인하세요</p>
            </div>
            <span className="text-2xl">›</span>
          </div>
        </Link>

        <section className="mb-4">
          <h2 className="text-base font-extrabold mb-3">📚 알아보기</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {DODAM_MENU.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center py-5 rounded-2xl hover:scale-105 transition-transform"
                style={{ background: item.color }}
              >
                <span className="text-3xl mb-1.5">{item.emoji}</span>
                <span className="text-sm font-bold text-txt">{item.label}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}

interface AlertCardProps {
  kind: "warn" | "safe";
  badge: string;
  title: string;
  description: string;
  source: string;
}

function AlertCard({ kind, badge, title, description, source }: AlertCardProps) {
  const isWarn = kind === "warn";
  return (
    <div className={`p-3.5 rounded-2xl border-l-4 ${isWarn ? "bg-orange/5 border-orange" : "bg-g5 border-g3"}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isWarn ? "bg-orange text-white" : "bg-g3 text-white"}`}>
          {badge}
        </span>
        <span className="text-xs text-txt3">{source}</span>
      </div>
      <h3 className="text-sm font-bold mb-0.5">{title}</h3>
      <p className="text-xs text-txt2 leading-relaxed">{description}</p>
    </div>
  );
}