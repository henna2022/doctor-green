import { NextRequest, NextResponse } from "next/server";

const NCPMS_KEY = process.env.NCPMS_KEY;
const NCPMS_BASE = "http://ncpms.rda.go.kr/npmsAPI/service";

const SERVICE_CODE = {
  disease: "SVC01",
  pest: "SVC03",
};

// 전체 조회 시 사용할 작물 목록
const ALL_CROPS = [
  "토마토", "고추", "딸기", "오이", "복숭아",
  "사과", "배추", "벼", "마늘", "양파",
];

interface NcpmsListItem {
  sickKey?: string;
  insectKey?: string;
  sickNameKor?: string;
  sickNameEng?: string;
  sickNameChn?: string;
  insectKorName?: string;
  insectEngName?: string;
  insectGattung?: string;
  cropName?: string;
  thumbImg?: string;
}

// 단일 작물(또는 전체)에 대한 NCPMS API 호출
async function fetchForCrop(
  type: "disease" | "pest",
  cropName: string,
  keyword: string,
  ncpmsKey: string
): Promise<NcpmsListItem[]> {
  const params = new URLSearchParams();
  params.set("apiKey", ncpmsKey);
  params.set("serviceCode", SERVICE_CODE[type]);
  params.set("serviceType", "AA003");
  params.set("displayCount", "100");

  if (cropName) params.set("cropName", cropName);
  if (keyword) {
    if (type === "disease") params.set("sickNameKor", keyword);
    else params.set("insectKorName", keyword);
  }

  const url = `${NCPMS_BASE}?${params.toString()}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  const json = await res.json();

  const list = json?.service?.list;
  return Array.isArray(list) ? list : list ? [list] : [];
}

function mapItem(it: NcpmsListItem, type: "disease" | "pest") {
  if (type === "disease") {
    return {
      sickKey: it.sickKey || "",
      name: it.sickNameKor || "",
      nameEn: it.sickNameEng || "",
      nameSci: it.sickNameChn || "",
      crop: it.cropName || "",
      imageUrl: it.thumbImg || "",
    };
  } else {
    return {
      sickKey: it.insectKey || "",
      name: it.insectKorName || "",
      nameEn: it.insectEngName || "",
      nameSci: it.insectGattung || "",
      crop: it.cropName || "",
      imageUrl: it.thumbImg || "",
    };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = (searchParams.get("type") || "disease") as "disease" | "pest";
  const cropName = searchParams.get("cropName") || "";
  const keyword = searchParams.get("keyword") || "";

  if (!NCPMS_KEY) {
    console.error("NCPMS_KEY not set");
    return NextResponse.json([]);
  }

  try {
    let allItems: NcpmsListItem[];

    if (!cropName) {
      // 전체 선택: 모든 작물을 병렬 호출 후 합산
      const perCropResults = await Promise.all(
        ALL_CROPS.map((crop) => fetchForCrop(type, crop, keyword, NCPMS_KEY!))
      );
      allItems = perCropResults.flat();
    } else {
      // 특정 작물 선택
      allItems = await fetchForCrop(type, cropName, keyword, NCPMS_KEY);
    }

    // 매핑 + 유효 항목만 + 중복 제거 (sickKey 기준)
    const seen = new Set<string>();
    const results = allItems
      .map((it) => mapItem(it, type))
      .filter((x) => {
        if (!x.sickKey || !x.name) return false;
        if (seen.has(x.sickKey)) return false;
        seen.add(x.sickKey);
        return true;
      });

    return NextResponse.json(results);
  } catch (e) {
    console.error("NCPMS search error:", e);
    return NextResponse.json([]);
  }
}