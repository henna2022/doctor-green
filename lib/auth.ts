import { supabase } from "./supabase";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 회원가입
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface SignupParams {
  name: string;
  email: string;
  password: string;
  region?: string;
  crops?: string[];
  farmType?: string | null;
}

export async function signUp({
  name,
  email,
  password,
  region,
  crops,
  farmType,
}: SignupParams) {
  // 1) Supabase 인증 시스템에 계정 생성
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: translateError(error.message) };
  }

  if (!data.user) {
    return { error: "회원가입에 실패했습니다. 다시 시도해주세요." };
  }

  // 2) profiles 테이블에 추가 정보 저장
  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    name,
    farm_region: region || null,
    farm_crops: crops && crops.length > 0 ? crops : null,
    farm_type: farmType || null,
  });

  if (profileError) {
    console.error("Profile insert error:", JSON.stringify(profileError, null, 2));
    return { error: "프로필 저장 실패: " + (profileError.message || profileError.code || "알 수 없는 오류") };
  }

  return { user: data.user, error: null };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 로그인
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: translateError(error.message) };
  }

  return { user: data.user, error: null };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 로그아웃
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function signOut() {
  await supabase.auth.signOut();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 현재 로그인한 사용자 정보 가져오기 (profiles 포함)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { ...user, profile };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 프로필 정보 수정
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface UpdateProfileParams {
  name?: string;
  region?: string;
  crops?: string[];
  farmType?: string | null;
}

export async function updateProfile(params: UpdateProfileParams) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인이 필요합니다." };

  const updates: Record<string, unknown> = {};
  if (params.name !== undefined) updates.name = params.name;
  if (params.region !== undefined) updates.farm_region = params.region || null;
  if (params.crops !== undefined)
    updates.farm_crops = params.crops.length > 0 ? params.crops : null;
  if (params.farmType !== undefined) updates.farm_type = params.farmType || null;
  updates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Supabase 영어 에러 → 한국어 변환
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function translateError(msg: string): string {
  if (msg.includes("already registered")) {
    return "이미 가입된 이메일입니다.";
  }
  if (msg.includes("Invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (msg.includes("Password should be at least")) {
    return "비밀번호는 6자 이상이어야 합니다.";
  }
  if (msg.includes("Unable to validate email")) {
    return "올바른 이메일 형식이 아닙니다.";
  }
  if (msg.includes("Email not confirmed")) {
    return "이메일 인증이 필요합니다.";
  }
  return msg; // 변환 못한 건 원본 표시
}