"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { getMyCrops, MyCrop } from "@/lib/crops";
import { CameraIcon, UploadIcon, SearchIcon } from "@/components/Icons";

export default function DiagnosePage() {
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedCropId, setSelectedCropId] = useState<string | null>(null);
  const [myCrops, setMyCrops] = useState<MyCrop[]>([]);
  const [cropsLoading, setCropsLoading] = useState(true);
  const [cameraError, setCameraError] = useState("");

  // 내 작물 목록 로드
  useEffect(() => {
    (async () => {
      const crops = await getMyCrops();
      setMyCrops(crops);
      setCropsLoading(false);
    })();
  }, []);

  // HF Space cold start 완화: 진입 시 백그라운드 warmup
  useEffect(() => {
    fetch("/api/diagnose/ping").catch(() => {});
  }, []);

  // 카메라 끄기 (stream 정리)
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  }, []);

  // 컴포넌트 사라질 때 카메라 정리
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // 카메라 켜기
  const startCamera = async () => {
    setCameraError("");
    setImagePreview(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("camera error:", err);
      setCameraError("카메라를 사용할 수 없어요. 브라우저 권한을 확인해주세요.");
    }
  };

  // 사진 촬영
  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setImagePreview(dataUrl);
    stopCamera();
  };

  // 갤러리 업로드
  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDiagnose = () => {
    if (!imagePreview) {
      alert("먼저 사진을 촬영하거나 업로드해주세요!");
      return;
    }

    const selectedCrop = myCrops.find((c) => c.id === selectedCropId);

    sessionStorage.setItem("diagnose_image", imagePreview);
    sessionStorage.setItem("diagnose_crop", selectedCrop?.crop_name || "미지정");
    sessionStorage.setItem("diagnose_crop_id", selectedCropId || "");

    router.push("/diagnose/result");
  };

  const resetImage = () => {
    setImagePreview(null);
  };

  return (
    <div className="phone-frame">
      <header className="flex items-center justify-between px-5 py-4 border-b border-brd sticky top-0 bg-bg-main z-10">
        <Link href="/home" className="text-2xl" onClick={stopCamera}>‹</Link>
        <h1 className="text-base font-bold">AI 작물 진단</h1>
        <div className="w-6" />
      </header>

      <main className="flex-1 px-5 py-5 pb-2">
        {/* 안내 */}
        <div className="mb-5 p-3.5 rounded-2xl bg-g5">
          <p className="text-sm text-g1 font-medium leading-relaxed">
            🌿 병해충이 의심되는 잎이나 줄기를 가까이서 촬영하면<br />
            더 정확하게 진단할 수 있어요!
          </p>
        </div>

        {/* 작물 선택 (내 작물 관리에서 로드) */}
        <div className="mb-5">
          <label className="block text-sm font-bold mb-2">작물 선택 (선택사항)</label>

          {cropsLoading ? (
            <p className="text-xs text-txt3">불러오는 중...</p>
          ) : myCrops.length === 0 ? (
            <div className="p-3 rounded-2xl bg-bg-soft">
              <p className="text-xs text-txt2 mb-2">아직 등록된 작물이 없어요</p>
              <Link href="/crops" className="text-xs text-g1 font-bold">
                작물 관리에서 추가하기 ›
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {myCrops.map((c) => (
                <button
                  key={c.id}
                  onClick={() =>
                    setSelectedCropId(selectedCropId === c.id ? null : c.id)
                  }
                  className={`px-3 py-2 rounded-full border-2 text-xs transition ${
                    selectedCropId === c.id
                      ? "bg-g5 border-g3 text-g1 font-bold"
                      : "border-brd text-txt2 bg-bg-card"
                  }`}
                >
                  {c.emoji} {c.crop_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 화면 영역: 카메라 / 미리보기 / 빈 상태 */}
        <div className="mb-5">
          {cameraOn ? (
            <div className="fixed inset-0 z-50 bg-black flex flex-col">
              <div className="flex justify-between items-center px-5 py-4 text-white">
                <button onClick={stopCamera} className="text-2xl">✕</button>
                <span className="text-sm font-medium">작물을 화면에 담아주세요</span>
                <div className="w-6" />
              </div>

              <div className="flex-1 relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="py-8 flex justify-center bg-black">
                <button
                  onClick={takePhoto}
                  className="rounded-full bg-white border-4 border-g3 shadow-lg active:scale-95 transition"
                  style={{ width: "72px", height: "72px" }}
                  aria-label="촬영"
                />
              </div>
            </div>
          ) : imagePreview ? (
            <div className="relative rounded-3xl overflow-hidden border-2 border-g3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="진단할 작물" className="w-full h-85 object-cover" />
              <button
                onClick={resetImage}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-brd h-85 flex flex-col items-center justify-center bg-bg-card">
              <CameraIcon className="w-14 h-14 mb-3 opacity-70" />
              <p className="text-sm text-txt2">카메라를 켜거나 사진을 업로드하세요</p>
            </div>
          )}
        </div>

        {cameraError && (
          <div className="mb-3 px-3 py-2.5 bg-red/10 border border-red rounded-lg text-sm text-red">
            {cameraError}
          </div>
        )}

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleGalleryUpload}
          className="hidden"
        />

        <canvas ref={canvasRef} className="hidden" />

        {!cameraOn && (
          <>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <button
                onClick={startCamera}
                className="py-3.5 rounded-2xl bg-bg-card border-2 border-g1 text-g1 font-bold hover:bg-g5 transition flex items-center justify-center gap-2"
              >
                <CameraIcon className="w-5 h-5" /> 카메라 켜기
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="py-3.5 rounded-2xl bg-bg-card border-2 border-g1 text-g1 font-bold hover:bg-g5 transition flex items-center justify-center gap-2"
              >
                <UploadIcon className="w-5 h-5" /> 업로드
              </button>
            </div>

            <button
              onClick={handleDiagnose}
              disabled={!imagePreview}
              className="w-full py-4 rounded-2xl bg-g1 text-white font-bold hover:bg-g2 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              <SearchIcon className="w-5 h-5" /> AI 진단 시작하기
            </button>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}