import { NextRequest, NextResponse } from "next/server";

const NCPMS_KEY = process.env.NCPMS_KEY;
// 🔧 HTTPS 시도 (Vercel HTTP outbound 이슈 회피)
const NCPMS_BASE = "https://ncpms.rda.go.kr/npmsAPI/service";

interface NcpmsDetailItem {
  sickKey?: string;
  insectKey?: string;
  sickNameKor?: string;
  insectKorName?: string;
  sickNameEng?: string;
  insectEngName?: string;
  sickNameChn?: string;
  insectGattung?: string;
  cropName?: string;
  symptomCharacter?: string;
  developmentCharacter?: string;
  preventMethod?: string;
  chemicalPrevent?: string;
  bioPrevent?: string;
  cultivatePrevent?: string;
  imageUrl?: string;
  imgUrl1?: string;
  imgUrl2?: string;
  imgUrl3?: string;
}

// 타임아웃 + 재시도 fetch
async function fetchWithRetry(url: string, retries = 1): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DoctorGreen/1.0)",
        Accept: "application/json, text/xml",
      },
    });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 1500));
      return fetchWithRetry(url, retries - 1);
    }
    throw e;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sickKey = searchParams.get("sickKey") || "";

  if (!sickKey) {
    return NextResponse.json({ error: "sickKey required" }, { status: 400 });
  }
  if (!NCPMS_KEY) {
    return NextResponse.json({ error: "NCPMS_KEY not set" }, { status: 500 });
  }

  // search와 동일한 파라미터 패턴 (이게 검증된 패턴)
  const params = new URLSearchParams();
  params.set("apiKey", NCPMS_KEY);
  params.set("serviceCode", "SVC05");
  params.set("serviceType", "AA003");
  params.set("sickKey", sickKey);

  const url = `${NCPMS_BASE}?${params.toString()}`;

  try {
    const res = await fetchWithRetry(url);
    const text = await res.text();

    // 🔍 디버깅용 로그 (서버 로그)
    console.log("[NCPMS detail]", sickKey, "status:", res.status, "len:", text.length);

    // ?raw=1 이면 원본 응답 그대로
    if (searchParams.get("raw") === "1") {
      try {
        return NextResponse.json(JSON.parse(text));
      } catch {
        return new NextResponse(text, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "invalid JSON response", preview: text.slice(0, 200) },
        { status: 502 }
      );
    }

    // 응답 구조 처리 (service.list / service / json 자체 모두 시도)
    const j = json as Record<string, unknown>;
    const service = (j?.service as Record<string, unknown>) || {};
    let item: NcpmsDetailItem | undefined;

    const list = service.list;
    if (Array.isArray(list) && list.length > 0) {
      item = list[0] as NcpmsDetailItem;
    } else if (list && typeof list === "object") {
      item = list as NcpmsDetailItem;
    } else if (
      service.sickKey ||
      service.insectKey ||
      service.sickNameKor ||
      service.insectKorName
    ) {
      item = service as NcpmsDetailItem;
    }

    if (!item) {
      return NextResponse.json({ error: "not found", sickKey }, { status: 404 });
    }

    const imageUrls = [item.imageUrl, item.imgUrl1, item.imgUrl2, item.imgUrl3].filter(
      (u): u is string => !!u && u.length > 0
    );

    const result = {
      sickKey,
      name: item.sickNameKor || item.insectKorName || "",
      nameEn: item.sickNameEng || item.insectEngName || "",
      nameSci: item.sickNameChn || item.insectGattung || "",
      cropName: item.cropName || "",
      symptoms: item.symptomCharacter || "",
      cause: item.developmentCharacter || "",
      prevention: item.preventMethod || "",
      chemicalControl: item.chemicalPrevent || "",
      biologicalControl: item.bioPrevent || "",
      culturalControl: item.cultivatePrevent || "",
      imageUrls,
    };

    return NextResponse.json(result);
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const errCause =
      e instanceof Error && "cause" in e && e.cause
        ? String((e.cause as Error)?.message ?? e.cause)
        : "";
    console.error("NCPMS detail error:", errMsg, errCause);
    return NextResponse.json(
      {
        error: "fetch failed",
        detail: errMsg,
        cause: errCause,
        sickKey,
      },
      { status: 502 }
    );
  }
}