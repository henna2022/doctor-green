import { NextRequest, NextResponse } from "next/server";
import { fetchUpstream } from "@/lib/upstream";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get("lat") || "");
  const lon = parseFloat(searchParams.get("lon") || "");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ name: "현재 위치" });
  }

  // 캐시 적중률을 위해 좌표를 소수 2자리(약 1.1km 격자)로 반올림해 요청 URL을 만든다.
  // (fetch의 캐시 키는 URL 기준이라, 원본 좌표를 그대로 쓰면 소수점 차이마다 캐시 미스가 난다)
  const latRounded = Math.round(lat * 100) / 100;
  const lonRounded = Math.round(lon * 100) / 100;

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${latRounded}&lon=${lonRounded}&format=json&accept-language=ko`;
    const res = await fetchUpstream(url, {
      headers: { "User-Agent": "doctor-green/1.0" },
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    const a = data.address || {};
    const name =
      a.city || a.town || a.county || a.municipality || a.province || a.state || "현재 위치";
    return NextResponse.json({ name });
  } catch (e) {
    console.error("Geocode error:", e);
    return NextResponse.json({ name: "현재 위치" });
  }
}