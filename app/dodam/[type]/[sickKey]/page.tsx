"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getDodamDetail, DodamDetail } from "@/lib/dodam";

export default function DodamDetailPage() {
  const params = useParams();
  const type = params.type as string; // "disease" | "pest"
  const sickKey = params.sickKey as string;
  const backHref = `/dodam/${type === "disease" ? "disease" : "pest"}`;

  const [detail, setDetail] = useState<DodamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageIdx, setImageIdx] = useState(0);

  useEffect(() => {
    async function load() {
      console.log("[Dodam Detail] Loading sickKey:", sickKey);
      const d = await getDodamDetail(sickKey);
      console.log("[Dodam Detail] Got data:", d);
      setDetail(d);
      setLoading(false);
    }
    load();
  }, [sickKey]);

  // ━━━ 로딩 ━━━
  if (loading) {
    return (
      <div className="phone-frame items-center justify-center">
        <div className="w-10 h-10 border-4 border-g5 border-t-g1 rounded-full animate-spin" />
      </div>
    );
  }

  // ━━━ detail 자체가 없음 (API 실패 또는 404) ━━━
  if (!detail) {
    return (
      <div className="phone-frame">
        <header className="flex items-center justify-between px-5 py-4 border-b border-brd">
          <Link href={backHref} className="text-2xl">‹</Link>
          <h1 className="text-base font-bold">정보 없음</h1>
          <div className="w-6" />
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-5 text-center">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-sm text-txt2 mb-2">상세 정보를 가져오지 못했어요</p>
          <p className="text-xs text-txt3 mb-6">잠시 후 다시 시도해주세요</p>
          <Link
            href={backHref}
            className="px-6 py-3 rounded-2xl bg-g1 text-white font-bold text-sm"
          >
            도감으로 돌아가기
          </Link>
        </main>
      </div>
    );
  }

  const typeLabel = type === "disease" ? "질병" : "해충";

  // 실제 컨텐츠가 있는지 확인 (이름은 있어도 내용은 빌 수 있음)
  const hasContent = !!(
    detail.symptoms ||
    detail.cause ||
    detail.prevention ||
    detail.culturalControl ||
    detail.biologicalControl ||
    detail.chemicalControl ||
    (detail.imageUrls && detail.imageUrls.length > 0)
  );

  // ━━━ detail은 있지만 내용이 비어있음 ━━━
  if (!hasContent) {
    return (
      <div className="phone-frame overflow-y-auto">
        <header className="flex items-center justify-between px-5 py-4 border-b border-brd sticky top-0 bg-bg-main z-10">
          <Link href={backHref} className="text-2xl">‹</Link>
          <h1 className="text-base font-bold">{typeLabel} 도감</h1>
          <div className="w-6" />
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-5 text-center py-10">
          <div className="text-5xl mb-3">📖</div>
          {detail.name && (
            <h2 className="text-xl font-extrabold text-g1 mb-1">{detail.name}</h2>
          )}
          {detail.cropName && (
            <p className="text-sm text-txt2 mb-1">🌱 {detail.cropName}</p>
          )}
          {detail.nameSci && (
            <p className="text-xs text-txt3 italic mb-4">{detail.nameSci}</p>
          )}
          <div className="my-6 px-4 py-3 rounded-2xl bg-g5">
            <p className="text-sm text-g1 font-bold mb-1">상세 정보가 비어있어요</p>
            <p className="text-xs text-txt2 leading-relaxed">
              이 항목은 NCPMS 도감에<br />
              증상·방제 정보가 등록되지 않았어요.<br />
              다른 항목을 확인해보세요!
            </p>
          </div>
          <Link
            href={backHref}
            className="px-6 py-3 rounded-2xl bg-g1 text-white font-bold text-sm"
          >
            다른 항목 보기
          </Link>
        </main>
      </div>
    );
  }

  // ━━━ 정상 상세 화면 ━━━
  return (
    <div className="phone-frame overflow-y-auto">
      <header className="flex items-center justify-between px-5 py-4 border-b border-brd sticky top-0 bg-bg-main z-10">
        <Link href={backHref} className="text-2xl">‹</Link>
        <h1 className="text-base font-bold">{typeLabel} 도감</h1>
        <div className="w-6" />
      </header>

      <main className="flex-1 pb-6">
        {/* 이미지 갤러리 */}
        {detail.imageUrls && detail.imageUrls.length > 0 && (
          <div className="bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={detail.imageUrls[imageIdx]}
              alt={detail.name}
              className="w-full aspect-video object-cover"
            />
            {detail.imageUrls.length > 1 && (
              <div className="flex justify-center gap-1.5 py-2 bg-black">
                {detail.imageUrls.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setImageIdx(i)}
                    className={`w-2 h-2 rounded-full transition ${
                      i === imageIdx ? "bg-white" : "bg-white/30"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-5">
          {/* 제목 + 학명 */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-g5 text-g1">
                {typeLabel}
              </span>
              {detail.cropName && (
                <span className="text-xs text-txt2">🌱 {detail.cropName}</span>
              )}
            </div>
            <h2 className="text-2xl font-extrabold text-g1 mb-1">{detail.name}</h2>
            {detail.nameEn && (
              <p className="text-sm text-txt2">{detail.nameEn}</p>
            )}
            {detail.nameSci && (
              <p className="text-xs text-txt3 italic">{detail.nameSci}</p>
            )}
          </div>

          {/* 증상 */}
          {detail.symptoms && (
            <Section title="🔍 증상" content={detail.symptoms} />
          )}

          {/* 발생 환경 */}
          {detail.cause && (
            <Section title="🌡️ 발생 환경" content={detail.cause} />
          )}

          {/* 방제 정보 */}
          {(detail.prevention || detail.culturalControl || detail.chemicalControl || detail.biologicalControl) && (
            <div className="mb-5 p-4 rounded-2xl bg-g5">
              <h3 className="text-base font-bold text-g1 mb-3">💊 방제 방법</h3>

              {detail.prevention && (
                <SubSection title="예방" content={detail.prevention} />
              )}
              {detail.culturalControl && (
                <SubSection title="경종적 방제" content={detail.culturalControl} />
              )}
              {detail.biologicalControl && (
                <SubSection title="생물학적 방제" content={detail.biologicalControl} />
              )}
              {detail.chemicalControl && (
                <SubSection title="화학적 방제" content={detail.chemicalControl} />
              )}
            </div>
          )}

          {/* 안내 */}
          <p className="text-xs text-txt3 text-center leading-relaxed">
            📖 출처: 농촌진흥청 NCPMS<br />
            정확한 방제는 농업기술센터 상담을 권장합니다
          </p>
        </div>
      </main>
    </div>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div className="mb-5 p-4 rounded-2xl bg-bg-card border border-brd">
      <h3 className="text-sm font-bold mb-2">{title}</h3>
      <p className="text-sm text-txt2 leading-relaxed whitespace-pre-line">{content}</p>
    </div>
  );
}

function SubSection({ title, content }: { title: string; content: string }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-sm font-bold text-g1 mb-1">{title}</p>
      <p className="text-xs text-txt leading-relaxed whitespace-pre-line">{content}</p>
    </div>
  );
}