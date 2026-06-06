"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  ChevronDown,
  ChevronRight,
  Droplets,
  Sun,
  Cloud,
  CloudRain,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import {
  PlantIcon,
  CaterpillarIcon,
  FirstAidIcon,
  RealtimeIcon,
} from "@/components/HomeIllustrations";
import { getCurrentUser } from "@/lib/auth";
import {
  fetchWeather,
  fetchLocationName,
  fetchNearbyPests,
  fetchPestForecast,
  WeatherData,
} from "@/lib/api";
import { generateAlerts, Alert } from "@/lib/alerts";

const MENU = [
  { href: "/dodam/disease", label: "질병도감", bg: "#E4F1E9", Illust: PlantIcon },
  { href: "/dodam/pest", label: "해충 도감", bg: "#FBF5EB", Illust: CaterpillarIcon },
  { href: "/dodam/remedy", label: "방제 정보", bg: "#FBF5EB", Illust: FirstAidIcon },
  { href: "/realtime", label: "실시간 분석", bg: "#FBF5EB", Illust: RealtimeIcon },
];

function WeatherIcon({ weather }: { weather: WeatherData | null }) {
  const cls = "text-txt2";
  if (weather?.pty != null && weather.pty > 0) return <CloudRain size={18} className={cls} />;
  if (weather?.sky === 3 || weather?.sky === 4) return <Cloud size={18} className={cls} />;
  return <Sun size={18} className={cls} />;
}

export default function HomePage() {
  const router = useRouter();

  const [userCrops, setUserCrops] = useState<string[]>([]);
  const [locationName, setLocationName] = useState("불러오는 중");
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
          setLocationName(name);
          setWeather(weatherData);
          setAlerts(
            generateAlerts({ weather: weatherData, ncpms: forecasts, farmmap: pests, cityName: name })
          );
          setLoadingData(false);
        });
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
    );
  }, [loading, userCrops]);

  if (loading) {
    return (
      <div className="phone-frame items-center justify-center">
        <p className="text-txt2 text-sm">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="phone-frame">
      {/* 헤더 — 위치 + 날씨 */}
      <header className="px-5 pt-5 pb-3.5 bg-bg-card border-b border-brd">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-1.5" type="button">
            <MapPin size={20} className="text-g3" fill="#4ECAA0" strokeWidth={1.5} />
            <span className="text-lg font-extrabold text-txt">{locationName}</span>
            <ChevronDown size={18} className="text-txt2" />
          </button>

          <div className="flex items-center gap-3.5 text-txt2">
            <span className="flex items-center gap-1 text-sm font-medium">
              <WeatherIcon weather={weather} />
              {weather ? `${weather.temp}°C` : "--"}
            </span>
            <span className="flex items-center gap-1 text-sm font-medium">
              <Droplets size={18} className="text-txt2" />
              {weather?.hum != null ? `${weather.hum}%` : "--"}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 pt-6 pb-3">
        {/* 오늘의 알림 */}
        <section className="mb-7">
          <h2 className="text-lg font-extrabold mb-3.5">오늘의 알림</h2>

          <div className="flex flex-col gap-2.5">
            {loadingData ? (
              <div className="p-4 rounded-2xl bg-[#F3F3EF] text-center">
                <p className="text-sm text-txt3">알림을 불러오는 중...</p>
              </div>
            ) : alerts.length > 0 ? (
              alerts.slice(0, 3).map((a, i) => (
                <Link
                  key={i}
                  href={`/notify?focus=${i}`}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-[#F3F3EF] active:bg-[#ECECE7] transition-colors"
                >
                  <span
                    className="text-[11px] font-bold text-white px-2.5 py-1 rounded-full shrink-0"
                    style={{ background: a.kind === "warn" ? "#E07856" : "#4ECAA0" }}
                  >
                    {a.badge}
                  </span>
                  <span className="flex-1 text-[15px] font-bold text-txt truncate">{a.title}</span>
                  <ChevronRight size={20} className="text-txt3 shrink-0" />
                </Link>
              ))
            ) : (
              <div className="p-4 rounded-2xl bg-g5 text-center">
                <p className="text-sm text-g1 font-medium">현재 특이 알림이 없습니다 ✅</p>
              </div>
            )}
          </div>
        </section>

        {/* 알아보기 */}
        <section className="mb-2">
          <h2 className="text-lg font-extrabold mb-3.5">알아보기</h2>
          <div className="grid grid-cols-2 gap-3.5">
            {MENU.map(({ href, label, bg, Illust }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-between rounded-[20px] pt-7 pb-5 px-4 active:scale-[0.98] transition-transform"
                style={{ background: bg }}
              >
                <div className="flex-1 flex items-center justify-center">
                  <Illust className="w-[72px] h-[72px]" />
                </div>
                <span className="mt-4 text-[15px] font-bold text-txt">{label}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
