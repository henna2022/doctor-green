"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

export default function DiagnosePage() {
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedCrop, setSelectedCrop] = useState("");
  const [cameraError, setCameraError] = useState("");

  const CROPS = ["토마토", "고추", "딸기", "오이", "복숭아", "사과", "배추", "기타"];

  // 카메라 끄기 (stream 정리)
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  }, []);

  // 컴포넌트 사라질 때 카메라 정리 (메모리 누수 방지)
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // 카메라 켜기
  const startCamera = async () => {
    setCameraError("");
    setImagePreview(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // 후면 카메라 우선
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);

      // video 요소에 스트림 연결 (약간의 딜레이 후)
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError(
        "카메라를 켤 수 없어요. 브라우저 설정에서 카메라 권한을 허용해주세요."
      );
    }
  };

  // 사진 촬영 (현재 영상 프레임을 캡처)
  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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
    sessionStorage.setItem("diagnose_image", imagePreview);
    sessionStorage.setItem("diagnose_crop", selectedCrop || "미지정");
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

        {/* 작물 선택 */}
        <div className="mb-5">
          <label className="block text-sm font-bold mb-2">작물 선택 (선택사항)</label>
          <div className="flex flex-wrap gap-1.5">
            {CROPS.map((crop) => (
              <button
                key={crop}
                onClick={() => setSelectedCrop(selectedCrop === crop ? "" : crop)}
                className={`px-3 py-2 rounded-full border-2 text-xs transition ${
                  selectedCrop === crop
                    ? "bg-g5 border-g3 text-g1 font-bold"
                    : "border-brd text-txt2 bg-bg-card"
                }`}
              >
                {crop}
              </button>
            ))}
          </div>
        </div>

        {/* 화면 영역: 카메라 / 미리보기 / 빈 상태 */}
        <div className="mb-5">
          {cameraOn ? (
          // 카메라 켜진 상태 - 전체 화면 덮기
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* 상단 닫기 */}
            <div className="flex justify-between items-center px-5 py-4 text-white">
              <button onClick={stopCamera} className="text-2xl">✕</button>
              <span className="text-sm font-medium">작물을 화면에 담아주세요</span>
              <div className="w-6" />
            </div>

            {/* 카메라 영상 (꽉 차게) */}
            <div className="flex-1 relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>

            {/* 하단 촬영 버튼 */}
            <div className="py-8 flex justify-center bg-black">
              <button
                onClick={takePhoto}
                className="w-18 h-18 rounded-full bg-white border-4 border-g3 shadow-lg active:scale-95 transition"
                style={{ width: "72px", height: "72px" }}
                aria-label="촬영"
              />
            </div>
          </div>
        ) : imagePreview ? (
            // 사진 찍은 후 미리보기
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
            // 빈 상태
            <div className="rounded-3xl border-2 border-dashed border-brd h-85 flex flex-col items-center justify-center bg-bg-card">
              <div className="text-5xl mb-3">📷</div>
              <p className="text-sm text-txt2">카메라를 켜거나 사진을 업로드하세요</p>
            </div>
          )}
        </div>

        {/* 카메라 에러 메시지 */}
        {cameraError && (
          <div className="mb-3 px-3 py-2.5 bg-red/10 border border-red rounded-lg text-sm text-red">
            {cameraError}
          </div>
        )}

        {/* 숨겨진 갤러리 input */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleGalleryUpload}
          className="hidden"
        />

        {/* 촬영을 위한 canvas (화면엔 안 보임) */}
        <canvas ref={canvasRef} className="hidden" />

        {/* 버튼들 - 카메라 안 켜졌을 때만 표시 */}
        {!cameraOn && (
          <>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <button
                onClick={startCamera}
                className="py-3.5 rounded-2xl bg-bg-card border-2 border-g1 text-g1 font-bold hover:bg-g5 transition flex items-center justify-center gap-2"
              >
                📸 카메라 켜기
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="py-3.5 rounded-2xl bg-bg-card border-2 border-g1 text-g1 font-bold hover:bg-g5 transition flex items-center justify-center gap-2"
              >
                🖼️ 업로드
              </button>
            </div>

            <button
              onClick={handleDiagnose}
              disabled={!imagePreview}
              className="w-full py-4 rounded-2xl bg-g1 text-white font-bold hover:bg-g2 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              🔍 AI 진단 시작하기
            </button>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}