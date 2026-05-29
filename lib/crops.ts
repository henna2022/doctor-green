import { supabase } from "./supabase";

export interface MyCrop {
  id: string;
  crop_name: string;
  emoji: string;
  planted_date: string | null;
  memo: string | null;
  is_favorite: boolean;
  created_at: string;
}

interface AddCropParams {
  cropName: string;
  emoji: string;
  plantedDate?: string;
  memo?: string;
}

// 작물 추가
export async function addCrop(params: AddCropParams) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase.from("my_crops").insert({
    user_id: user.id,
    crop_name: params.cropName,
    emoji: params.emoji,
    planted_date: params.plantedDate || null,
    memo: params.memo || null,
  });
  if (error) return { error: error.message };
  return { error: null };
}

// 내 작물 목록 (즐겨찾기 우선 정렬)
export async function getMyCrops(): Promise<MyCrop[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("my_crops")
    .select("*")
    .eq("user_id", user.id)
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Get crops error:", error);
    return [];
  }
  return data || [];
}

// 단일 작물 조회
export async function getCropById(id: string): Promise<MyCrop | null> {
  const { data, error } = await supabase
    .from("my_crops")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

// 작물 삭제
export async function deleteCrop(id: string) {
  const { error } = await supabase.from("my_crops").delete().eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}

// 메모 수정
export async function updateCropMemo(id: string, memo: string) {
  const { error } = await supabase.from("my_crops").update({ memo }).eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}

// 즐겨찾기 토글
export async function toggleFavorite(id: string, current: boolean) {
  const { error } = await supabase
    .from("my_crops")
    .update({ is_favorite: !current })
    .eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}

// 작물 전체 수정 (이모지, 이름, 심은 날짜, 메모)
interface UpdateCropParams {
  cropName?: string;
  emoji?: string;
  plantedDate?: string | null;
  memo?: string | null;
}

export async function updateCrop(id: string, params: UpdateCropParams) {
  const updates: Record<string, unknown> = {};
  if (params.cropName !== undefined) updates.crop_name = params.cropName;
  if (params.emoji !== undefined) updates.emoji = params.emoji;
  if (params.plantedDate !== undefined) updates.planted_date = params.plantedDate || null;
  if (params.memo !== undefined) updates.memo = params.memo || null;

  const { error } = await supabase
    .from("my_crops")
    .update(updates)
    .eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}