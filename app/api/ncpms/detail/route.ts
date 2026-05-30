import { NextRequest, NextResponse } from "next/server";

const NCPMS_KEY = process.env.NCPMS_KEY;
const NCPMS_BASE = "http://ncpms.rda.go.kr/npmsAPI/service";

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

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sickKey = searchParams.get("sickKey") || "";

  if (!sickKey) {
    return NextResponse.json({ error: "sickKey required" }, { status: 400 });
  }
  if (!NCPMS_KEY) {
    return NextResponse.json({ error: "NCPMS_KEY not set" }, { status: 500 });
  }

  try {
    const params = new URLSearchParams();
    params.set("apiKey", NCPMS_KEY);
    params.set("serviceCode", "SVC05");
    params.set("sickKey", sickKey);

    const url = `${NCPMS_BASE}?${params.toString()}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    const json = await res.json();

    // 상세는 service.list 또는 service 자체에 데이터가 들어있을 수 있음
    const list = json?.service?.list;
    let item: NcpmsDetailItem | undefined;
    if (Array.isArray(list) && list.length > 0) item = list[0];
    else if (list && typeof list === "object") item = list as NcpmsDetailItem;

    if (!item) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const imageUrls = [item.imageUrl, item.imgUrl1, item.imgUrl2, item.imgUrl3].filter(
      (url): url is string => !!url && url.length > 0
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
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("NCPMS detail error:", errMsg);
    return NextResponse.json(
      { error: "fetch failed", detail: errMsg, sickKey },
      { status: 502 }
    );
  }
}