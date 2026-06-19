"use client";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 교육용 "완전 가상" 시뮬레이션 스토어 (/control 실습실 전용)
//
//   ▸ 실제 네트워크 / 실제 Supabase 를 전혀 쓰지 않는다.
//   ▸ 모든 데이터는 브라우저(localStorage) 안에서만 살아 있다.
//   ▸ 학생은 방 번호(1~15)별로 자기만의 "가상 데이터베이스"를 가진다.
//   ▸ 스테이션(날씨·YOLO·센서)에서 버튼을 누르면 가상 테이블에 행이 INSERT
//     되고, 이를 화면에서 "Supabase 로 전송되는 것처럼" 보여준다.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useCallback, useSyncExternalStore } from "react";

export type Station = "weather" | "yolo" | "sensor";

// ━━━ 가상 테이블 행 타입 (실제 Supabase 스키마를 흉내) ━━━
// 공통 베이스: 모든 가상 테이블 행이 가지는 컬럼.
export interface SimRow {
  id: number;
  created_at: string;
}
export interface WeatherRow extends SimRow {
  region: string;
  temp: number;
  sky: string; // 맑음 / 구름 / 비
}
export interface DiagnosisRow extends SimRow {
  crop: string;
  label: string; // 건강한 잎 / 병해 의심 / 해충 흔적
  confidence: number;
}
export interface SensorRow extends SimRow {
  device_id: string;
  temp: number;
  hum: number;
}

export interface StationState {
  active: boolean;
  payload: Record<string, unknown>;
}

export interface RoomState {
  stations: Record<Station, StationState>;
  weather_cache: WeatherRow[];
  diagnoses: DiagnosisRow[];
  sensor_readings: SensorRow[];
}

// ━━━ 방 번호 1~15 ━━━
export const ROOMS: string[] = Array.from({ length: 15 }, (_, i) => String(i + 1));
export const DEFAULT_ROOM = "1";

const ROOM_KEY = "dg_sim_room";
const stateKey = (room: string) => `dg_sim_state:${room}`;

function emptyState(): RoomState {
  return {
    stations: {
      weather: { active: false, payload: {} },
      yolo: { active: false, payload: {} },
      sensor: { active: false, payload: {} },
    },
    weather_cache: [],
    diagnoses: [],
    sensor_readings: [],
  };
}

// ━━━ 인메모리 캐시 + 구독자 (간단한 외부 스토어) ━━━
const cache = new Map<string, RoomState>();
const listeners = new Set<(room: string) => void>();
const EMPTY: RoomState = emptyState(); // 서버 스냅샷용 안정 참조

function load(room: string): RoomState {
  const cached = cache.get(room);
  if (cached) return cached;
  let s = emptyState();
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(stateKey(room));
      if (raw) s = { ...emptyState(), ...(JSON.parse(raw) as RoomState) };
    } catch {
      /* 손상된 데이터는 무시하고 빈 상태로 */
    }
  }
  cache.set(room, s);
  return s;
}

function save(room: string, next: RoomState) {
  cache.set(room, next);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(stateKey(room), JSON.stringify(next));
    } catch {
      /* 용량 초과 등은 조용히 무시 */
    }
  }
  listeners.forEach((fn) => fn(room));
}

function subscribe(fn: (room: string) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ━━━ id 시퀀스 (항상 증가) ━━━
let idSeq = Date.now();
const nextId = () => ++idSeq;
const ROW_CAP = 80; // 테이블당 최근 N행만 보관

// ━━━ 쓰기(액션) — 항상 새 객체/배열을 만들어 React 가 변화를 감지하게 함 ━━━
export function activateStation(
  room: string,
  station: Station,
  payload: Record<string, unknown> = {}
) {
  const s = load(room);
  save(room, {
    ...s,
    stations: { ...s.stations, [station]: { active: true, payload } },
  });
}

export function deactivateStation(room: string, station: Station) {
  const s = load(room);
  save(room, {
    ...s,
    stations: { ...s.stations, [station]: { active: false, payload: {} } },
  });
}

export function insertWeather(
  room: string,
  row: Omit<WeatherRow, "id" | "created_at">
): WeatherRow {
  const s = load(room);
  const full: WeatherRow = { ...row, id: nextId(), created_at: new Date().toISOString() };
  save(room, { ...s, weather_cache: [...s.weather_cache, full].slice(-ROW_CAP) });
  return full;
}

export function insertDiagnosis(
  room: string,
  row: Omit<DiagnosisRow, "id" | "created_at">
): DiagnosisRow {
  const s = load(room);
  const full: DiagnosisRow = { ...row, id: nextId(), created_at: new Date().toISOString() };
  save(room, { ...s, diagnoses: [...s.diagnoses, full].slice(-ROW_CAP) });
  return full;
}

export function insertSensor(
  room: string,
  row: Omit<SensorRow, "id" | "created_at">
): SensorRow {
  const s = load(room);
  const full: SensorRow = { ...row, id: nextId(), created_at: new Date().toISOString() };
  save(room, { ...s, sensor_readings: [...s.sensor_readings, full].slice(-ROW_CAP) });
  return full;
}

export function resetRoom(room: string) {
  save(room, emptyState());
}

export function completedCount(s: RoomState): number {
  return (Object.keys(s.stations) as Station[]).filter((k) => s.stations[k].active).length;
}

// ━━━ 현재 방 번호 외부 스토어 ━━━
let currentRoom: string | null = null;
const roomListeners = new Set<() => void>();

function getRoomSnapshot(): string {
  if (currentRoom == null) {
    if (typeof window === "undefined") return DEFAULT_ROOM;
    const saved = localStorage.getItem(ROOM_KEY);
    currentRoom = saved && ROOMS.includes(saved) ? saved : DEFAULT_ROOM;
  }
  return currentRoom;
}

export function setRoom(r: string) {
  currentRoom = ROOMS.includes(r) ? r : DEFAULT_ROOM;
  if (typeof window !== "undefined") localStorage.setItem(ROOM_KEY, currentRoom);
  roomListeners.forEach((fn) => fn());
}

// ━━━ 훅: 현재 방 번호 ━━━
export function useRoom(): [string, (room: string) => void] {
  const room = useSyncExternalStore(
    (cb) => {
      roomListeners.add(cb);
      return () => roomListeners.delete(cb);
    },
    getRoomSnapshot,
    () => DEFAULT_ROOM
  );
  return [room, setRoom];
}

// ━━━ 훅: 특정 방의 가상 상태 (변경 시 자동 리렌더) ━━━
export function useRoomState(room: string): RoomState {
  const subscribeRoom = useCallback(
    (cb: () => void) => subscribe((changed) => (changed === room ? cb() : undefined)),
    [room]
  );
  const getSnapshot = useCallback(() => load(room), [room]);
  return useSyncExternalStore(subscribeRoom, getSnapshot, () => EMPTY);
}
