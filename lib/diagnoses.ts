import { supabase } from "./supabase";

// 진단 이미지 업로드용 Supabase Storage 버킷
const DIAGNOSIS_IMAGES_BUCKET = "diagnosis-images";

export interface DiagnosisRecord {
  id: string;
  crop_id: string | null;
  crop_name: string | null;
  disease_name: string;
  confidence: number | null;
  severity: string | null;
  image_url: string | null;
  symptoms: string[] | null;
  diagnosed_at: string;
}

interface SaveParams {
  cropId?: string | null;
  cropName: string;
  diseaseName: string;
  confidence: number;
  severity: string;
  imageUrl: string;
  symptoms: string[];
}

// base64 dataURL → Blob 변환
function dataUrlToBlob(dataUrl: string): { blob: Blob; contentType: string } {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
  const contentType = match?.[1] || "image/jpeg";
  const base64 = match?.[2] || dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { blob: new Blob([bytes], { type: contentType }), contentType };
}

// 진단 이미지를 Supabase Storage에 업로드하고 publicUrl을 반환.
// 이미 http(s) URL이면 그대로 반환. 업로드 실패(버킷 없음 포함) 시 base64 원본으로 폴백.
async function uploadDiagnosisImage(imageDataUrl: string, userId: string): Promise<string> {
  if (!imageDataUrl.startsWith("data:image")) {
    return imageDataUrl;
  }

  try {
    const { blob, contentType } = dataUrlToBlob(imageDataUrl);
    const ext = contentType.split("/")[1] || "jpg";
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(DIAGNOSIS_IMAGES_BUCKET)
      .upload(path, blob, { contentType, upsert: false });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(DIAGNOSIS_IMAGES_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("publicUrl을 가져오지 못했습니다.");

    return data.publicUrl;
  } catch (e) {
    console.warn("진단 이미지 Storage 업로드 실패, base64로 폴백합니다:", e);
    return imageDataUrl;
  }
}

// 진단 기록 저장
export async function saveDiagnosis(params: SaveParams) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인이 필요합니다." };

  const imageUrl = await uploadDiagnosisImage(params.imageUrl, user.id);

  const { error } = await supabase.from("diagnoses").insert({
    user_id: user.id,
    crop_id: params.cropId || null,
    crop_name: params.cropName === "미지정" ? null : params.cropName,
    disease_name: params.diseaseName,
    confidence: params.confidence,
    severity: params.severity,
    image_url: imageUrl,
    symptoms: params.symptoms,
  });

  if (error) {
    console.error("Save diagnosis error:", error);
    return { error: error.message };
  }
  return { error: null };
}

// 내 진단 기록 목록 가져오기
export async function getMyDiagnoses(): Promise<DiagnosisRecord[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("diagnoses")
    .select("*")
    .eq("user_id", user.id)
    .order("diagnosed_at", { ascending: false });

  if (error) {
    console.error("Get diagnoses error:", error);
    return [];
  }
  return data || [];
}

// 진단 기록 삭제
export async function deleteDiagnosis(id: string) {
  const { error } = await supabase.from("diagnoses").delete().eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}

// 특정 작물의 진단 기록 (작물명 기준 - 레거시 호환용)
export async function getDiagnosesByCrop(cropName: string): Promise<DiagnosisRecord[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("diagnoses")
    .select("*")
    .eq("user_id", user.id)
    .eq("crop_name", cropName)
    .order("diagnosed_at", { ascending: false });

  if (error) return [];
  return data || [];
}