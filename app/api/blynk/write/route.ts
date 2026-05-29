import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const BLYNK_BASE = "https://blynk.cloud/external/api";

// pin 이름 → Blynk 가상핀 매핑
const PIN_MAP: Record<string, string> = {
  led: "V0",
  fan: "V4",
};

export async function POST(req: NextRequest) {
  const { deviceId, pin, value } = await req.json();
  if (!deviceId || !pin) {
    return NextResponse.json({ error: "deviceId, pin required" }, { status: 400 });
  }

  const blynkPin = PIN_MAP[pin];
  if (!blynkPin) {
    return NextResponse.json({ error: "unknown pin" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data } = await supabase
    .from("devices")
    .select("blynk_token")
    .eq("id", deviceId)
    .single();

  const token = data?.blynk_token;
  if (!token) {
    return NextResponse.json({ error: "device not found" }, { status: 404 });
  }

  // DEMO 모드 → 항상 성공
  if (token === "DEMO") {
    return NextResponse.json({ ok: true });
  }

  // Blynk 업데이트
  try {
    const v = value ? "1" : "0";
    const res = await fetch(
      `${BLYNK_BASE}/update?token=${token}&${blynkPin}=${v}`
    );
    if (!res.ok) {
      return NextResponse.json({ error: "blynk write failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Blynk write error:", e);
    return NextResponse.json({ error: "communication error" }, { status: 502 });
  }
}