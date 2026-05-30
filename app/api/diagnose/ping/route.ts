import { NextResponse } from "next/server";

const SPACE = process.env.HF_SPACE_ID;

export async function GET() {
  if (!SPACE) {
    return NextResponse.json({ ok: false, reason: "HF_SPACE_ID not set" });
  }

  // henna22/doctor-green-strawberry → henna22-doctor-green-strawberry.hf.space
  const host = SPACE.replace("/", "-");
  const url = `https://${host}.hf.space/config`;

  try {
    // 5초 타임아웃 (응답 안 와도 깨어나는 신호는 이미 보냄)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);

    return NextResponse.json({ ok: res.ok, status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ping failed";
    // 타임아웃이어도 깨우는 신호는 보냈으니까 OK 취급
    return NextResponse.json({ ok: false, reason: msg });
  }
}