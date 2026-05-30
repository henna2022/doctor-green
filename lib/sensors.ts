import { supabase } from "./supabase";

// ━━━ 타입 ━━━
export interface Device {
  id: string;
  name: string;
  crop_id: string | null;
  blynk_token: string | null;
  camera_url: string | null;
  camera_type: string;
  created_at: string;
}

export interface SensorReading {
  temp: number | null;
  hum: number | null;
  soil: number | null;
  ledOn: boolean;
  fanOn: boolean;
  ok: boolean;       // 통신 성공 여부
}

// ━━━ 디바이스 CRUD ━━━
export async function getMyDevices(): Promise<Device[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}

export async function getDevice(id: string): Promise<Device | null> {
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

interface AddDeviceParams {
  name: string;
  cropId?: string | null;
  blynkToken?: string;
  cameraUrl?: string;
  cameraType?: string;
}

export async function addDevice(params: AddDeviceParams) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const { error } = await supabase.from("devices").insert({
    user_id: user.id,
    name: params.name,
    crop_id: params.cropId || null,
    blynk_token: params.blynkToken || null,
    camera_url: params.cameraUrl || null,
    camera_type: params.cameraType || "mjpeg",
  });
  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteDevice(id: string) {
  const { error } = await supabase.from("devices").delete().eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}

// ━━━ 센서 읽기 (Supabase sensor_readings) ━━━
export async function readSensors(deviceId: string): Promise<SensorReading> {
  try {
    const res = await fetch(`http://localhost:5001/api/blynk/read?deviceId=${deviceId}`);
    if (!res.ok) throw new Error(`read failed: ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("readSensors error:", e);
    return { temp: null, hum: null, soil: null, ledOn: false, fanOn: false, ok: false };
  }
}

// ━━━ 액추에이터 제어 ━━━
// pin: 'led' | 'fan', value: true(켜기) / false(끄기)
export async function writeActuator(deviceId: string, pin: "led" | "fan", value: boolean) {
  try {
    const res = await fetch("http://localhost:5001/api/blynk/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, pin, value }),
    });
    if (!res.ok) return { error: "쓰기 실패" };
    return { error: null };
  } catch (e) {
    console.error("writeActuator error:", e);
    return { error: "통신 오류" };
  }
}

// ━━━ 센서 로그 저장 (DB) ━━━
export async function saveSensorLog(deviceId: string, reading: SensorReading) {
  if (!reading.ok) return;
  await supabase.from("sensor_logs").insert({
    device_id: deviceId,
    temp: reading.temp,
    hum: reading.hum,
    soil: reading.soil,
  });
}

// ━━━ 센서 로그 조회 (차트용, 최근 N개) ━━━
export interface SensorLog {
  temp: number | null;
  hum: number | null;
  soil: number | null;
  measured_at: string;
}

export async function getSensorLogs(deviceId: string, limit = 30): Promise<SensorLog[]> {
  const { data, error } = await supabase
    .from("sensor_logs")
    .select("temp, hum, soil, measured_at")
    .eq("device_id", deviceId)
    .order("measured_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  // 차트는 오름차순이 보기 좋음
  return (data || []).reverse();
}