import { NextRequest, NextResponse } from "next/server";
import { Client, handle_file } from "@gradio/client";

const SPACE = process.env.HF_SPACE_ID!;

// 첫 호출이 느려서 (Space cold start) 60초까지는 기다림
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return NextResponse.json(
        { error: "이미지가 없습니다" },
        { status: 400 }
      );
    }

    // base64 → Blob 변환
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const blob = new Blob([buffer], { type: "image/jpeg" });

    // Gradio Client로 HF Space 호출
    const client = await Client.connect(SPACE);
    const result = await client.predict("/diagnose", {
      image: handle_file(blob),
    });

    // Gradio 응답은 result.data[0]에 우리가 만든 JSON이 담겨있음
    const data = (result.data as any[])[0];

    return NextResponse.json(data);
  } catch (e: any) {
    console.error("diagnose API error:", e);
    // ⚠️ 폴백/가짜데이터 없음 - 실패는 실패로 반환
    return NextResponse.json(
      {
        error: "진단 서버 호출 실패",
        detail: String(e?.message ?? e),
      },
      { status: 502 }
    );
  }
}