import { NextRequest, NextResponse } from "next/server";
import { Client, handle_file } from "@gradio/client";

const SPACE = process.env.HF_SPACE_ID;

// imageBase64 크기 상한 (8MB, base64 인코딩 문자열 기준)
const MAX_IMAGE_BASE64_BYTES = 8 * 1024 * 1024;

// data:image 접두 검증용
const DATA_IMAGE_PREFIX_PATTERN = /^data:image\/\w+;base64,/;

// 첫 호출이 느려서 (Space cold start) 60초까지는 기다림
export const maxDuration = 60;

// Gradio Client 연결을 모듈 레벨에서 재사용 (요청마다 재연결하지 않도록)
let clientPromise: ReturnType<typeof Client.connect> | null = null;
function getClient() {
  if (!clientPromise) {
    clientPromise = Client.connect(SPACE!).catch((e) => {
      // 연결 실패 시 다음 요청에서 재시도할 수 있도록 캐시 초기화
      clientPromise = null;
      throw e;
    });
  }
  return clientPromise;
}

async function callDiagnoseOnce(blob: Blob) {
  const client = await getClient();
  const result = await client.predict("/diagnose", {
    image: handle_file(blob),
  });
  // Gradio 응답은 result.data[0]에 우리가 만든 JSON이 담겨있음
  return (result.data as unknown[])[0];
}

export async function POST(req: NextRequest) {
  if (!SPACE) {
    return NextResponse.json(
      { error: "HF_SPACE_ID 환경변수가 설정되지 않았습니다" },
      { status: 500 }
    );
  }

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { error: "이미지가 없습니다" },
        { status: 400 }
      );
    }

    if (!DATA_IMAGE_PREFIX_PATTERN.test(imageBase64)) {
      return NextResponse.json(
        { error: "올바른 이미지 형식이 아닙니다 (data:image/* base64 필요)" },
        { status: 400 }
      );
    }

    if (imageBase64.length > MAX_IMAGE_BASE64_BYTES) {
      return NextResponse.json(
        { error: "이미지 용량이 너무 큽니다 (최대 8MB)" },
        { status: 400 }
      );
    }

    // base64 → Blob 변환
    const base64Data = imageBase64.replace(DATA_IMAGE_PREFIX_PATTERN, "");
    const buffer = Buffer.from(base64Data, "base64");
    const blob = new Blob([buffer], { type: "image/jpeg" });

    // Gradio Client로 HF Space 호출 — 502/타임아웃 시 1회 자동 재시도
    let data: unknown;
    try {
      data = await callDiagnoseOnce(blob);
    } catch (firstErr) {
      console.warn("diagnose API 1차 호출 실패, 재시도합니다:", firstErr);
      // predict 실패는 연결 자체가 죽었을 수 있으니 캐시를 비우고 재연결 후 재시도
      clientPromise = null;
      data = await callDiagnoseOnce(blob);
    }

    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error("diagnose API error:", e);
    // ⚠️ 폴백/가짜데이터 없음 - 실패는 실패로 반환
    return NextResponse.json(
      {
        error: "진단 서버 호출 실패",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 502 }
    );
  }
}