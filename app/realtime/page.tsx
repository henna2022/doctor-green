"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { getCurrentUser } from "@/lib/auth";
import { getMyDevices, addDevice, deleteDevice, Device } from "@/lib/sensors";
import { getMyCrops, MyCrop } from "@/lib/crops";

export default function RealtimePage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [crops, setCrops] = useState<MyCrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  // 추가 폼
  const [name, setName] = useState("");
  const [cropId, setCropId] = useState<string>("");
  const [blynkToken, setBlynkToken] = useState("DEMO");
  const [cameraUrl, setCameraUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user) {
        router.push("/");
        return;
      }
      const [d, c] = await Promise.all([getMyDevices(), getMyCrops()]);
      setDevices(d);
      setCrops(c);
      setLoading(false);
    }
    load();
  }, [router]);

  const handleAdd = async () => {
    if (!name.trim()) {
      alert("디바이스 이름을 입력해주세요!");
      return;
    }
    setSaving(true);
    const res = await addDevice({
      name: name.trim(),
      cropId: cropId || null,
      blynkToken: blynkToken.trim() || "DEMO",
      cameraUrl: cameraUrl.trim() || undefined,
    });
    if (res.error) {
      alert("저장 실패: " + res.error);
    } else {
      setDevices(await getMyDevices());
      setName(""); setCropId(""); setBlynkToken("DEMO"); setCameraUrl("");
      setShowAdd(false);
    }
    setSaving(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("이 디바이스를 삭제할까요?")) return;
    await deleteDevice(id);
    setDevices(devices.filter((d) => d.id !== id));
  };

  return (
    <div className="phone-frame overflow-y-auto">
      <header className="flex items-center justify-between px-5 py-4 border-b border-brd sticky top-0 bg-bg-main z-10">
        <div className="w-6" />
        <h1 className="text-base font-bold">실시간 분석</h1>
        <button onClick={() => setShowAdd(true)} className="text-xl text-g1 font-bold w-6 text-right">
          +
        </button>
      </header>

      <main className="flex-1 px-5 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-g5 border-t-g1 rounded-full animate-spin mb-3" />
            <p className="text-sm text-txt3">불러오는 중...</p>
          </div>
        ) : devices.length > 0 ? (
          <div className="flex flex-col gap-3">
            {devices.map((d) => {
              const crop = crops.find((c) => c.id === d.crop_id);
              const isDemo = d.blynk_token === "DEMO";
              return (
                <div
                  key={d.id}
                  onClick={() => router.push(`/realtime/${d.id}`)}
                  className="p-4 rounded-2xl bg-bg-card border border-brd hover:border-g3 transition cursor-pointer relative"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-g5 flex items-center justify-center text-2xl shrink-0">
                      {crop?.emoji || "📡"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h3 className="text-base font-bold">{d.name}</h3>
                        {isDemo && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange/20 text-orange">
                            DEMO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-txt2">
                        {crop?.crop_name || "작물 미연결"}
                        {d.camera_url && " · 📹"}
                      </p>
                    </div>
                    <button onClick={(e) => handleDelete(e, d.id)} className="text-txt3 text-sm shrink-0">
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-txt3 mt-2 text-right">실시간 보기 ›</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">📡</div>
            <p className="text-sm text-txt2 mb-4">등록된 스마트팜이 없어요</p>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-block px-6 py-3 rounded-2xl bg-g1 text-white font-bold text-sm"
            >
              디바이스 추가하기
            </button>
          </div>
        )}
      </main>

      <BottomNav />

      {/* 디바이스 추가 모달 */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-[420px] bg-bg-main rounded-t-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-bg-main px-5 py-4 border-b border-brd flex items-center justify-between">
              <h2 className="text-lg font-extrabold">디바이스 추가</h2>
              <button onClick={() => setShowAdd(false)} className="text-2xl text-txt3">✕</button>
            </div>

            <div className="px-5 py-5">
              <label className="block text-sm font-bold mb-2">디바이스 이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 베란다 1호"
                className="w-full px-3.5 py-3 border-2 border-brd rounded-xl text-sm bg-bg-card focus:border-g3 outline-none transition mb-4"
              />

              <label className="block text-sm font-bold mb-2">연결할 작물 (선택)</label>
              <select
                value={cropId}
                onChange={(e) => setCropId(e.target.value)}
                className="w-full px-3.5 py-3 border-2 border-brd rounded-xl text-sm bg-bg-card focus:border-g3 outline-none transition mb-4"
              >
                <option value="">선택 안 함</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.crop_name}
                  </option>
                ))}
              </select>

              <label className="block text-sm font-bold mb-1">Blynk Auth Token</label>
              <p className="text-xs text-txt3 mb-2">실제 디바이스 연결 전엔 <code className="bg-bg-card px-1 rounded">DEMO</code>로 시뮬레이션</p>
              <input
                type="text"
                value={blynkToken}
                onChange={(e) => setBlynkToken(e.target.value)}
                placeholder="DEMO 또는 실제 Blynk 토큰"
                className="w-full px-3.5 py-3 border-2 border-brd rounded-xl text-sm bg-bg-card focus:border-g3 outline-none transition mb-4 font-mono"
              />

              <label className="block text-sm font-bold mb-1">카메라 URL (선택)</label>
              <p className="text-xs text-txt3 mb-2">MJPEG 스트림 또는 정적 이미지 URL</p>
              <input
                type="text"
                value={cameraUrl}
                onChange={(e) => setCameraUrl(e.target.value)}
                placeholder="http://192.168.0.10:81/stream"
                className="w-full px-3.5 py-3 border-2 border-brd rounded-xl text-sm bg-bg-card focus:border-g3 outline-none transition mb-5 font-mono"
              />

              <button
                onClick={handleAdd}
                disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-g1 text-white font-bold hover:bg-g2 disabled:opacity-50 transition"
              >
                {saving ? "저장 중..." : "디바이스 추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}