import { supabase } from "./supabase";

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

// 진단 기록 저장
export async function saveDiagnosis(params: SaveParams) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase.from("diagnoses").insert({
    user_id: user.id,
    crop_id: params.cropId || null,
    crop_name: params.cropName === "미지정" ? null : params.cropName,
    disease_name: params.diseaseName,
    confidence: params.confidence,
    severity: params.severity,
    image_url: params.imageUrl,
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

// 특정 작물의 진단 기록 (crop_id 기준 - 정확한 매칭)
export async function getDiagnosesByCropId(cropId: string): Promise<DiagnosisRecord[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("diagnoses")
    .select("*")
    .eq("user_id", user.id)
    .eq("crop_id", cropId)
    .order("diagnosed_at", { ascending: false });

  if (error) return [];
  return data || [];
}