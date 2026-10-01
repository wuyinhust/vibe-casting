import type { Metadata } from "next";
import "../../public-preview/preview.css";

export const metadata: Metadata = {
  title: "avibe — 为你的故事选角",
  description: "AVIBE 是面向 AI 视频创作者的数字角色选角与角色资产平台。",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
