"use client";

import { useState, useEffect } from "react";
import { getDayHistory, SensorLog } from "@/lib/sensors";
import { ChartIcon } from "@/components/Icons";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export function HistoryTab({ deviceId }: { deviceId: string }) {
  // 이력 탭에서 보는 날짜 (기본: 오늘 0시)
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [logs, setLogs] = useState<SensorLog[]>([]);

  // 이력 탭이 열려있을 때, 선택한 날짜의 0~24시 추이 로드
  useEffect(() => {
    let stale = false;
    Promise.resolve().then(() => {
      if (!stale) setLogs([]);
    });
    getDayHistory(deviceId, selectedDay).then((data) => {
      if (!stale) setLogs(data);
    });
    return () => {
      stale = true;
    };
  }, [deviceId, selectedDay]);

  const chartData = logs.map((l) => ({
    time: new Date(l.measured_at).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    temp: l.temp,
    hum: l.hum,
    soil: l.soil,
  }));

  // ━━━ 이력 날짜 네비게이션 ━━━
  const ymd = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  };
  const todayYmd = ymd(new Date());
  const isToday = ymd(selectedDay) === todayYmd;
  const dayLabel = isToday
    ? "오늘"
    : selectedDay.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  const shiftDay = (delta: number) =>
    setSelectedDay((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      d.setHours(0, 0, 0, 0);
      return d;
    });

  return (
    <>
      {/* 날짜 선택 */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          onClick={() => shiftDay(-1)}
          className="w-9 h-9 rounded-xl border border-brd text-lg text-txt2 shrink-0"
          aria-label="이전 날짜"
        >
          ‹
        </button>
        <input
          type="date"
          value={ymd(selectedDay)}
          max={todayYmd}
          onChange={(e) => {
            if (!e.target.value) return;
            const d = new Date(e.target.value + "T00:00:00");
            d.setHours(0, 0, 0, 0);
            setSelectedDay(d);
          }}
          className="flex-1 text-center text-sm font-bold border border-brd rounded-xl py-1.5 bg-bg-card outline-none"
        />
        <button
          onClick={() => shiftDay(1)}
          disabled={isToday}
          className="w-9 h-9 rounded-xl border border-brd text-lg text-txt2 shrink-0 disabled:opacity-30"
          aria-label="다음 날짜"
        >
          ›
        </button>
      </div>

      <h3 className="text-sm font-bold mb-3">
        {dayLabel} 추이
        {isToday && <span className="text-xs text-txt3 font-normal"> (0시~현재)</span>}
      </h3>
      {chartData.length > 1 ? (
        <>
          <MiniChart data={chartData} dataKey="temp" name="온도(°C)" color="#F08080" />
          <MiniChart data={chartData} dataKey="hum" name="습도(%)" color="#4A90E2" />
          <MiniChart data={chartData} dataKey="soil" name="토양수분(%)" color="#4ECAA0" />

          <h3 className="text-sm font-bold mb-2 mt-4">측정 이력</h3>
          <div className="text-xs">
            <div className="grid grid-cols-4 gap-2 px-2 py-2 font-bold text-txt2 border-b border-brd">
              <div>시각</div>
              <div className="text-center">온도</div>
              <div className="text-center">습도</div>
              <div className="text-center">토양</div>
            </div>
            {[...logs].reverse().map((l, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 px-2 py-1.5 border-b border-brd/50">
                <div className="text-txt2">
                  {new Date(l.measured_at).toLocaleString("ko-KR", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="text-center">{l.temp ?? "-"}</div>
                <div className="text-center">{l.hum ?? "-"}</div>
                <div className="text-center">{l.soil ?? "-"}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-10 rounded-2xl bg-bg-soft">
          <ChartIcon className="w-9 h-9 mx-auto mb-2 opacity-70" />
          <p className="text-sm text-txt2">
            {logs.length === 0
              ? "아직 수집된 데이터가 없어요"
              : isToday
              ? "아직 오늘 데이터가 부족해요"
              : "이 날짜엔 측정 데이터가 없어요"}
          </p>
        </div>
      )}
    </>
  );
}

function MiniChart({
  data, dataKey, name, color,
}: { data: { time: string; [k: string]: string | number | null }[]; dataKey: string; name: string; color: string }) {
  return (
    <div className="mb-4 p-3 rounded-2xl bg-bg-soft">
      <h4 className="text-xs font-bold mb-2">{name}</h4>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={40} />
          <YAxis tick={{ fontSize: 10 }} width={30} />
          <Tooltip />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
