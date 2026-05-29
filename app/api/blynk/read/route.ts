import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const BLYNK_BASE = "https://blynk.cloud/external/api";

// 디바이스의 Blynk Token 조회
async function getToken(deviceId: string): Promise<string | null> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase
    .from("devices")
    .select("blynk_token")
    .eq("id", deviceId)
    .single();
  
  if (error) {
    console.error("getToken error:", error.message, error.code);
    return null;
  }
  console.log("getToken data:", data);
  return data?.blynk_token || null;
}

// Blynk에서 가상핀 값 읽기
async function readPin(token: string, pin: string): Promise<string | null> {
  try {
    const res = await fetch(`${BLYNK_BASE}/get?token=${token}&${pin}`);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// 시뮬레이션용 랜덤값 (DEMO 모드)
function simulate() {
  const baseTemp = 22 + Math.sin(Date.now() / 60000) * 3;
  const baseHum = 60 + Math.cos(Date.now() / 50000) * 10;
  const baseSoil = 50 + Math.sin(Date.now() / 70000) * 15;
  return {
    temp: parseFloat((baseTemp + Math.random() * 2).toFixed(1)),
    hum: parseFloat((baseHum + Math.random() * 5).toFixed(1)),
    soil: parseFloat((baseSoil + Math.random() * 5).toFixed(1)),
    ledOn: false,
    fanOn: false,
    ok: true,
  };
}

export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("deviceId");
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  }

  const token = await getToken(deviceId);
  if (!token) {
    return NextResponse.json({ error: "device not found" }, { status: 404 });
  }

  // DEMO 모드 → 시뮬레이션 데이터
  if (token === "DEMO") {
    return NextResponse.json(simulate());
  }

  // 실제 Blynk API 호출 (V0~V4 동시에)
  const [led, temp, hum, soil, fan] = await Promise.all([
    readPin(token, "V0"),
    readPin(token, "V1"),
    readPin(token, "V2"),
    readPin(token, "V3"),
    readPin(token, "V4"),
  ]);

  return NextResponse.json({
    temp: temp ? parseFloat(temp) : null,
    hum: hum ? parseFloat(hum) : null,
    soil: soil ? parseFloat(soil) : null,
    ledOn: led === "1",
    fanOn: fan === "1",
    ok: temp !== null || hum !== null || soil !== null,
  });
}