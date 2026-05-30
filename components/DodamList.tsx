"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

import {
  searchDodam,
  DODAM_CROPS,
  DodamItem,
  DodamType,
} from "@/lib/dodam";

interface DodamListProps {
  title: string;
  type: DodamType;
  emptyEmoji: string;
}

export default function DodamList({ title, type, emptyEmoji }: DodamListProps) {
  const searchParams = useSearchParams();
  const initialCrop = searchParams.get("crop") || "";
  const initialKeyword = searchParams.get("keyword") || "";

  const [items, setItems] = useState<DodamItem[]>([]);
  const [loading, setLoading] = useState(false);
  // URL 파라미터를 초기값으로 사용 (진단 결과에서 점프 시 자동 검색)
  const [selectedCrop, setSelectedCrop] = useState<string>(initialCrop);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [debouncedKeyword, setDebouncedKeyword] = useState(initialKeyword);

  // 검색어 디바운싱 (입력 멈춘 후 500ms 뒤 검색)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 500);
    return () => clearTimeout(timer);
  }, [keyword]);

  // 조건 바뀔 때마다 재검색
  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await searchDodam(type, selectedCrop || undefined, debouncedKeyword || undefined);
      setItems(data);
      setLoading(false);
    }
    load();
  }, [type, selectedCrop, debouncedKeyword]);

  return (
    <div className="phone-frame overflow-y-auto">
      <header className="flex items-center justify-between px-5 py-4 border-b border-brd sticky top-0 bg-bg-main z-10">
        <Link href="/home" className="text-2xl">‹</Link>
        <h1 className="text-base font-bold">{title}</h1>
        <div className="w-6" />
      </header>

      <main className="flex-1 px-5 py-5">
        {/* 검색창 */}
        <div className="mb-3">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={`${title}에서 검색...`}
            className="w-full px-4 py-3 border-2 border-brd rounded-xl text-sm bg-bg-card focus:border-g3 outline-none transition"
          />
        </div>

        {/* 작물 필터 (가로 스크롤 칩) */}
        <div className="mb-4 -mx-5 px-5 overflow-x-auto">
          <div className="flex gap-1.5 pb-1 w-max">
            <button
              onClick={() => setSelectedCrop("")}
              className={`px-3 py-1.5 rounded-full border-2 text-xs whitespace-nowrap transition ${
                !selectedCrop
                  ? "bg-g5 border-g3 text-g1 font-bold"
                  : "border-brd text-txt2 bg-bg-card"
              }`}
            >
              전체
            </button>
            {DODAM_CROPS.map((crop) => {
              const active = selectedCrop === crop.name;
              return (
                <button
                  key={crop.name}
                  onClick={() => setSelectedCrop(crop.name)}
                  className={`px-3 py-1.5 rounded-full border-2 text-xs whitespace-nowrap transition ${
                    active
                      ? "bg-g5 border-g3 text-g1 font-bold"
                      : "border-brd text-txt2 bg-bg-card"
                  }`}
                >
                  {crop.emoji} {crop.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 카운트 */}
        {!loading && (
          <p className="text-xs text-txt3 mb-3">
            총 <span className="text-g1 font-bold">{items.length}</span>개
          </p>
        )}

        {/* 목록 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-g5 border-t-g1 rounded-full animate-spin mb-3" />
            <p className="text-sm text-txt3">불러오는 중...</p>
          </div>
        ) : items.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {items.map((item) => (
              <Link
                key={item.sickKey}
                href={`/dodam/${type}/${item.sickKey}`}
                className="flex gap-3 p-3 rounded-2xl bg-bg-card border border-brd hover:border-g3 transition"
              >
                {/* 썸네일 */}
                <div className="w-16 h-16 rounded-xl bg-g5 overflow-hidden shrink-0 flex items-center justify-center">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{emptyEmoji}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-g1 mb-0.5 truncate">{item.name}</h3>
                  {item.crop && (
                    <p className="text-xs text-txt2 mb-1 truncate">🌱 {item.crop}</p>
                  )}
                  {item.nameSci && (
                    <p className="text-[10px] text-txt3 italic truncate">{item.nameSci}</p>
                  )}
                </div>
                <span className="text-txt3 self-center">›</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">{emptyEmoji}</div>
            <p className="text-sm text-txt2">검색 결과가 없습니다</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}