"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { getCurrentUser, signOut } from "@/lib/auth";
import {
  fetchWeather,
  fetchLocationName,
  fetchNearbyPests,
  fetchPestForecast,
  weatherEmoji,
  WeatherData,
} from "@/lib/api";
import { generateAlerts, Alert } from "@/lib/alerts";

const DODAM_MENU = [
  { href: "/dodam/disease", emoji: "🌿", label: "질병 도감", color: "#E8F8F0" },
  { href: "/dodam/pest", emoji: "🐛", label: "해충 도감", color: "#FFF4E5" },
  { href: "/dodam/remedy", emoji: "💊", label: "방제 정보", color: "#E5F0FF" },
  { href: "/realtime", emoji: "📡", label: "실시간 분석", color: "#F0E8F8" },
];

export default function HomePage() {
  const router = useRouter();

  const [userName, setUserName] = useState("");
  const [userCrops, setUserCrops] = useState<string[]>([]);
  const [locationName, setLocationName] = useState("위치 불러오는 중...");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const user = await getCurrentUser();
      if (!user) {
        router.push("/");
        return;
      }
      setUserName(user.profile?.name || "농부");
      setUserCrops(user.profile?.farm_crops || []);
      setLoading(false);
    }
    loadUser();
  }, [router]);

  useEffect(() => {
    if (loading) return;

    if (!navigator.geolocation) {
      setLocationName("위치 정보 사용 불가");
      setLoadingData(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        const [name, weatherData, pests, forecasts] = await Promise.all([
          fetchLocationName(lat, lon),
          fetchWeather(lat, lon),
          fetchNearbyPests(lat, lon),
          userCrops.length > 0 ? fetchPestForecast(userCrops) : Promise.resolve([]),
        ]);

        setLocationName(name);
        setWeather(weatherData);
        setAlerts(
          generateAlerts({ weather: weatherData, ncpms: forecasts, farmmap: pests, cityName: name })
        );
        setLoadingData(false);
      },
      (err) => {
        console.error("Geolocation error:", err.code, err.message);
        
        // 위치 못 받으면 기본 위치 사용 (안성시 - 한경대 위치)
        const fallbackLat = 37.0079;
        const fallbackLon = 127.2797;
        
        Promise.all([
          fetchLocationName(fallbackLat, fallbackLon),
          fetchWeather(fallbackLat, fallbackLon),
          fetchNearbyPests(fallbackLat, fallbackLon),
          userCrops.length > 0 ? fetchPestForecast(userCrops) : Promise.resolve([]),
        ]).then(([name, weatherData, pests, forecasts]) => {
          setLocationName(name + " (기본 위치)");
          setWeather(weatherData);
          setAlerts(
            generateAlerts({ weather: weatherData, ncpms: forecasts, farmmap: pests, cityName: name })
          );
          setLoadingData(false);
        });
      },
      { 
        enableHighAccuracy: false, 
        timeout: 15000,      // 8초 → 15초로 늘림
        maximumAge: 600000 
      }
    );
  }, [loading, userCrops]);

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
            <p className="text-sm font-bold">{locationName}</p>
            {loadingData ? (
              <p className="text-xs text-txt3">날씨 정보 불러오는 중...</p>
            ) : weather ? (
              <p className="text-xs text-txt2">
                {weatherEmoji(weather.sky, weather.pty)} {weather.temp}°C
                {weather.tmax !== null && weather.tmin !== null &&
                  ` (${weather.tmin}° / ${weather.tmax}°)`}
                {weather.hum !== null && ` · 습도 ${weather.hum}%`}
              </p>
            ) : (
              <p className="text-xs text-txt3">날씨 정보 없음</p>
            )}
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
        {/* 오늘의 알림 - 제목만, 클릭 시 상세페이지 */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold">🔔 오늘의 알림</h2>
            {!loadingData && alerts.length > 0 && (
              <Link href="/notify" className="text-xs text-g2">
                전체보기 ›
              </Link>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {loadingData ? (
              <div className="p-4 rounded-2xl bg-bg-card border border-brd text-center">
                <p className="text-sm text-txt3">알림을 불러오는 중...</p>
              </div>
            ) : alerts.length > 0 ? (
              alerts.slice(0, 3).map((a, i) => (
                <Link
                  key={i}
                  href={`/notify?focus=${i}`}
                  className={`p-3.5 rounded-2xl border-l-4 flex items-center justify-between gap-2 ${
                    a.kind === "warn" ? "bg-orange/5 border-orange" : "bg-g5 border-g3"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        a.kind === "warn" ? "bg-orange text-white" : "bg-g3 text-white"
                      }`}
                    >
                      {a.badge}
                    </span>
                    <span className="text-sm font-bold truncate">{a.title}</span>
                  </div>
                  <span className="text-txt3 shrink-0">›</span>
                </Link>
              ))
            ) : (
              <div className="p-4 rounded-2xl bg-g5 text-center">
                <p className="text-sm text-g1 font-medium">현재 특이 알림이 없습니다 ✅</p>
              </div>
            )}
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