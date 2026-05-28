import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "닥터 그린 - AI 작물 주치의",
  description: "AI 기반 작물 병해충 진단 및 농장 관리 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}