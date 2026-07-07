import { RefObject } from "react";
import { Device } from "@/lib/sensors";
import { CameraIcon, WarningIcon } from "@/components/Icons";

export function CameraSection({
  device,
  cameraDevices,
  selectedCameraId,
  setSelectedCameraId,
  cameraStream,
  cameraError,
  videoRef,
  onSnapshot,
}: {
  device: Device;
  cameraDevices: MediaDeviceInfo[];
  selectedCameraId: string;
  setSelectedCameraId: (id: string) => void;
  cameraStream: MediaStream | null;
  cameraError: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  onSnapshot: () => void;
}) {
  const hasCamera = device.camera_type === "usb" || (device.camera_type === "mjpeg" && device.camera_url);

  return (
    <section className="mb-5">
      {/* USB 카메라일 때: 카메라 선택 드롭다운 */}
      {device.camera_type === "usb" && cameraDevices.length > 1 && (
        <select
          value={selectedCameraId}
          onChange={(e) => setSelectedCameraId(e.target.value)}
          className="w-full mb-2 px-3 py-2 border-2 border-brd rounded-xl text-sm bg-bg-card outline-none"
        >
          {cameraDevices.map((cam) => (
            <option key={cam.deviceId} value={cam.deviceId}>
              {cam.label || `카메라 ${cam.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      )}

      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
        {/* USB 웹캠 */}
        {device.camera_type === "usb" && cameraStream && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/60 text-white text-[10px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
              LIVE (USB)
            </div>
          </>
        )}

        {device.camera_type === "usb" && cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 px-4 text-center">
            <WarningIcon className="w-9 h-9 mb-2" />
            <p className="text-xs">{cameraError}</p>
          </div>
        )}

        {device.camera_type === "usb" && !cameraStream && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mb-2" />
            <p className="text-xs">카메라 연결 중...</p>
          </div>
        )}

        {/* MJPEG 네트워크 카메라 */}
        {device.camera_type === "mjpeg" && device.camera_url && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              id="camera-img"
              src={device.camera_url}
              alt="카메라"
              crossOrigin="anonymous"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/60 text-white text-[10px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
              LIVE
            </div>
          </>
        )}

        {/* 카메라 미사용 */}
        {device.camera_type === "none" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
            <CameraIcon className="w-9 h-9 mb-2 opacity-70" />
            <p className="text-xs">카메라 미연결</p>
          </div>
        )}
      </div>

      {/* 📸 스냅샷 버튼 */}
      <button
        onClick={onSnapshot}
        disabled={!hasCamera || (device.camera_type === "usb" && !cameraStream)}
        className="w-full mt-2 py-3 rounded-2xl bg-g1 text-white font-bold disabled:opacity-40 transition flex items-center justify-center gap-2"
      >
        <CameraIcon className="w-4 h-4" /> 스냅샷 → AI 진단
      </button>
    </section>
  );
}
