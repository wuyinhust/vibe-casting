import { notFound } from "next/navigation";
import { Platform } from "@/components/platform";

const sections = new Set([
  "discover",
  "boards",
  "studio",
  "messages",
  "account",
  "skill",
  "admin",
]);

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  if (
    !(slug.length === 1 && sections.has(slug[0])) &&
    !(slug.length === 2 && slug[0] === "characters")
  )
    notFound();
  return (
    <Platform
      initialView={slug[0] === "characters" ? "discover" : slug[0]}
      initialCharacter={slug[0] === "characters" ? slug[1] : null}
    />
  );
}
