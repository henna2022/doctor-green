"use client";

import { useState, useEffect, useRef } from "react";
import { Device } from "@/lib/sensors";

export function useUsbCamera(device: Device | null) {
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);

  // ━━━ USB 카메라: 디바이스 목록 가져오기 ━━━
  useEffect(() => {
    if (!device || device.camera_type !== "usb") return;

    async function loadCameras() {
      try {
        // 권한 먼저 요청 (이거 없으면 라벨이 안 보임)
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach((t) => t.stop()); // 일단 끄고 디바이스만 받기

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const cameras = allDevices.filter((d) => d.kind === "videoinput");
        setCameraDevices(cameras);

        if (cameras.length > 0 && !selectedCameraId) {
          setSelectedCameraId(cameras[0].deviceId);
        }
      } catch (e) {
        console.error("Camera enumerate error:", e);
        setCameraError("카메라 권한이 거부되었거나 카메라가 연결되지 않았어요.");
      }
    }
    loadCameras();
  }, [device, selectedCameraId]);

  // ━━━ USB 카메라: 선택된 카메라 스트림 시작 ━━━
  useEffect(() => {
    if (!device || device.camera_type !== "usb" || !selectedCameraId) return;

    let stream: MediaStream | null = null;

    async function startStream() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: selectedCameraId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        setCameraStream(stream);
        setCameraError("");
      } catch (e) {
        console.error("Camera start error:", e);
        setCameraError("카메라를 시작할 수 없어요. 다른 카메라를 선택해보세요.");
      }
    }
    startStream();

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraId, device]);

  // ━━━ 비디오 엘리먼트에 스트림 연결 ━━━
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  return {
    cameraDevices,
    selectedCameraId,
    setSelectedCameraId,
    cameraStream,
    cameraError,
    videoRef,
  };
}
