import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get("lat") || "");
  const lon = parseFloat(searchParams.get("lon") || "");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ name: "현재 위치" });
  }

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${lat}&lon=${lon}&format=json&accept-language=ko`;
    const res = await fetch(url, {
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