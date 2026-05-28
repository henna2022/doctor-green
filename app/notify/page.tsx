"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  fetchWeather, fetchLocationName, fetchNearbyPests, fetchPestForecast,
} from "@/lib/api";
import { generateAlerts, Alert } from "@/lib/alerts";

export default function NotifyPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [cityName, setCityName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user) {
        router.push("/");
        return;
      }
      const crops = user.profile?.farm_crops || [];

      if (!navigator.geolocation) {
        setLoading(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const [name, weather, pests, fc] = await Promise.all([
            fetchLocationName(lat, lon),
            fetchWeather(lat, lon),
            fetchNearbyPests(lat, lon),
            crops.length > 0 ? fetchPestForecast(crops) : Promise.resolve([]),
          ]);
          setCityName(name);
          setAlerts(generateAlerts({ weather, ncpms: fc, farmmap: pests, cityName: name }));
          setLoading(false);
        },
        () => setLoading(false),
        { timeout: 8000, maximumAge: 600000 }
      );
    }
    load();
  }, [router]);

  return (
    <div className="phone-frame overflow-y-auto">
      <header className="flex items-center justify-between px-5 py-4 border-b border-brd sticky top-0 bg-bg-main z-10">
        <Link href="/home" className="text-2xl">‹</Link>
        <h1 className="text-base font-bold">전체 알림</h1>
        <div className="w-6" />
      </header>

      <main className="flex-1 px-5 py-5">
        {cityName && (
          <p className="text-sm text-txt2 mb-4">
            📍 <span className="font-bold text-g1">{cityName}</span> 기준 ·{" "}
            {loading ? "확인 중..." : `${alerts.length}건`}
          </p>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-g5 border-t-g1 rounded-full animate-spin mb-3" />
            <p className="text-sm text-txt3">알림을 불러오는 중...</p>
          </div>
        ) : alerts.length > 0 ? (
          <div className="flex flex-col gap-3">
            {alerts.map((a, i) => (
              <div
                key={i}
                className={`p-4 rounded-2xl border-l-4 ${
                  a.kind === "warn" ? "bg-orange/5 border-orange" : "bg-g5 border-g3"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    a.kind === "warn" ? "bg-orange text-white" : "bg-g3 text-white"
                  }`}>
                    {a.badge}
                  </span>
                  <span className="text-xs text-txt3">{a.sub}</span>
                </div>
                <h3 className="text-base font-bold mb-1">{a.title}</h3>
                <p className="text-sm text-txt2 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-sm text-txt2">현재 특이 알림이 없습니다</p>
          </div>
        )}
      </main>
    </div>
  );
}