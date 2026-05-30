'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DEVICE_ID = '32fc18b2-06e5-492f-94d3-da6c9dd2497b'

type Reading = {
  temp: number
  hum: number
  recorded_at: string
}

export default function SmartFarmPage() {
  const [data, setData] = useState<Reading[]>([])

  // 초기 데이터 로드
  useEffect(() => {
    const fetchInitial = async () => {
      const { data: rows } = await supabase
        .from('sensor_readings')
        .select('temp, hum, recorded_at')
        .eq('device_id', DEVICE_ID)
        .order('recorded_at', { ascending: true })
        .limit(50)

      if (rows) setData(rows)
    }
    fetchInitial()
  }, [])

  // 실시간 구독
  useEffect(() => {
    const channel = supabase
      .channel('sensor_readings')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_readings',
          filter: `device_id=eq.${DEVICE_ID}`,
        },
        (payload) => {
          const row = payload.new as Reading
          setData((prev) => [...prev.slice(-49), row])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const formatted = data.map((d) => ({
    time: new Date(d.recorded_at).toLocaleTimeString('ko-KR'),
    온도: d.temp,
    습도: d.hum,
  }))

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">🌱 스마트팜 실시간 모니터링</h1>

      {/* 최신값 카드 */}
      {data.length > 0 && (
        <div className="flex gap-4 mb-8">
          <div className="bg-orange-100 rounded-xl p-4 w-36 text-center">
            <p className="text-sm text-gray-500">온도</p>
            <p className="text-3xl font-bold text-orange-500">
              {data[data.length - 1].temp}°C
            </p>
          </div>
          <div className="bg-blue-100 rounded-xl p-4 w-36 text-center">
            <p className="text-sm text-gray-500">습도</p>
            <p className="text-3xl font-bold text-blue-500">
              {data[data.length - 1].hum}%
            </p>
          </div>
        </div>
      )}

      {/* 온도 그래프 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">온도 (°C)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis domain={['auto', 'auto']} />
            <Tooltip />
            <Line type="monotone" dataKey="온도" stroke="#f97316" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 습도 그래프 */}
      <div>
        <h2 className="text-lg font-semibold mb-2">습도 (%)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis domain={['auto', 'auto']} />
            <Tooltip />
            <Line type="monotone" dataKey="습도" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}