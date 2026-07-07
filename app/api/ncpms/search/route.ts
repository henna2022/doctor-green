import { NextRequest, NextResponse } from "next/server";
import { fetchUpstream } from "@/lib/upstream";

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
  const res = await fetchUpstream(url, { next: { revalidate: 3600 } });
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
  const typeParam = searchParams.get("type") || "disease";
  if (typeParam !== "disease" && typeParam !== "pest") {
    return NextResponse.json({ error: "type must be 'disease' or 'pest'" }, { status: 400 });
  }
  const type: "disease" | "pest" = typeParam;
  const cropName = searchParams.get("cropName") || "";
  const keyword = searchParams.get("keyword") || "";

  if (!NCPMS_KEY) {
    console.error("NCPMS_KEY not set");
    return NextResponse.json({ error: "NCPMS_KEY 환경변수가 설정되지 않았습니다" }, { status: 500 });
  }

  try {
    let allItems: NcpmsListItem[];

    if (!cropName) {
      const settled = await Promise.allSettled(
        ALL_CROPS.map((crop) => fetchForCrop(type, crop, keyword, NCPMS_KEY!))
      );
      // 전체 조회는 일부 작물 실패를 허용 (부분 실패로 홈 화면 전체가 죽지 않도록)
      // 단, 전부 실패했다면 업스트림 장애로 보고 502 처리
      const allFailed = settled.every((r) => r.status === "rejected");
      if (allFailed) {
        throw new Error("모든 작물 조회 실패");
      }
      allItems = settled.flatMap((r) =>
        r.status === "fulfilled" ? r.value : []
      );
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
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));

    return NextResponse.json(results);
  } catch (e) {
    console.error("NCPMS search error:", e);
    return NextResponse.json({ error: "NCPMS search fetch failed" }, { status: 502 });
  }
}
