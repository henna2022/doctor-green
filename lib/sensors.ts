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

// DEMO 디바이스용 시뮬레이션 값 (실제 하드웨어 없이 화면 확인용)
function simulate(): SensorReading {
  const baseTemp = 22 + Math.sin(Date.now() / 60000) * 3;
  const baseHum = 60 + Math.cos(Date.now() / 50000) * 10;
  const baseSoil = 50 + Math.sin(Date.now() / 70000) * 15;
  return {
    temp: parseFloat((baseTemp + Math.random() * 2).toFixed(1)),
    hum: parseFloat((baseHum + Math.random() * 5).toFixed(1)),
    soil: parseFloat((baseSoil + Math.random() * 5).toFixed(1)),
    ledOn: false,
    fanOn: false,
    ok: true,
  };
}

// ━━━ 센서 읽기 (Supabase sensor_readings 최신 1건) ━━━
// 헥사보드(ESP32)가 sensor_readings 테이블에 직접 POST 한 값을 읽음.
export async function readSensors(deviceId: string): Promise<SensorReading> {
  // 센서값(sensor_readings)과 제어상태(devices.led_on/fan_on)를 함께 읽음
  const [{ data, error }, { data: dev }] = await Promise.all([
    supabase
      .from("sensor_readings")
      .select("temp, hum, soil, recorded_at")
      .eq("device_id", deviceId)
      .order("recorded_at", { ascending: false })
      .limit(1),
    supabase
      .from("devices")
      .select("blynk_token, led_on, fan_on")
      .eq("id", deviceId)
      .single(),
  ]);

  const ledOn = dev?.led_on ?? false;
  const fanOn = dev?.fan_on ?? false;

  const row = data?.[0];
  if (!error && row) {
    return {
      temp: row.temp ?? null,
      hum: row.hum ?? null,
      soil: row.soil ?? null,
      ledOn,
      fanOn,
      ok: true,
    };
  }

  // 실데이터가 없는 DEMO 디바이스 → 시뮬레이션 (제어상태는 유지)
  if (dev?.blynk_token === "DEMO") return { ...simulate(), ledOn, fanOn };

  return { temp: null, hum: null, soil: null, ledOn, fanOn, ok: false };
}

// ━━━ 액추에이터 제어 ━━━
// 앱이 devices.led_on/fan_on 을 업데이트 → ESP32가 그 값을 폴링해 GPIO 제어.
export async function writeActuator(deviceId: string, pin: "led" | "fan", value: boolean) {
  const col = pin === "led" ? "led_on" : "fan_on";
  const { error } = await supabase
    .from("devices")
    .update({ [col]: value })
    .eq("id", deviceId);
  if (error) return { error: error.message };
  return { error: null };
}

// ━━━ 센서 로그 조회 (차트용, 최근 N개) ━━━
// ESP32가 sensor_readings 에 직접 기록하므로 별도 저장 없이 그대로 조회.
export interface SensorLog {
  temp: number | null;
  hum: number | null;
  soil: number | null;
  measured_at: string;
}

export async function getSensorLogs(deviceId: string, limit = 30): Promise<SensorLog[]> {
  const { data, error } = await supabase
    .from("sensor_readings")
    .select("temp, hum, soil, recorded_at")
    .eq("device_id", deviceId)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  // recorded_at → measured_at 로 맞추고, 차트는 오름차순이 보기 좋음
  return (data || [])
    .map((r) => ({
      temp: r.temp ?? null,
      hum: r.hum ?? null,
      soil: r.soil ?? null,
      measured_at: r.recorded_at,
    }))
    .reverse();
}

// ━━━ 장기 추이 (N시간을 구간별 평균으로 다운샘플) ━━━
// Supabase RPC sensor_history 사용 (시간 구간별 평균). 6시간이면 ~36개 점.
export async function getSensorHistory(
  deviceId: string,
  hours = 6,
  buckets = 36
): Promise<SensorLog[]> {
  const { data, error } = await supabase.rpc("sensor_history", {
    p_device: deviceId,
    p_hours: hours,
    p_buckets: buckets,
  });
  if (error || !data) {
    console.error("getSensorHistory error:", error?.message);
    return [];
  }
  return (data as { bucket: string; temp: number | null; hum: number | null; soil: number | null }[]).map((r) => ({
    temp: r.temp ?? null,
    hum: r.hum ?? null,
    soil: r.soil ?? null,
    measured_at: r.bucket,
  }));
}