import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "avibe — Find your next character",
  description:
    "Discover digital talent. Cast your story. 发现数字达人，为你的故事选角。",
};

export default function PlatformLayout({
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
