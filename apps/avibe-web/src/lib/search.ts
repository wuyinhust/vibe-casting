import { query, Row } from "./db";
import { z } from "zod";
export const SearchSchema = z.object({
  q: z.string().max(500).default(""),
  gender: z.enum(["woman", "man", "nonbinary"]).optional(),
  min_age: z.coerce.number().int().min(1).max(110).optional(),
  max_age: z.coerce.number().int().min(1).max(110).optional(),
  license: z.enum(["commercial", "noncommercial", "negotiation"]).optional(),
  purpose: z.enum(["personal", "commercial", "brand"]).optional(),
  style: z.string().max(50).optional(),
  ready: z.enum(["true", "false"]).optional(),
  category: z.string().max(50).optional(),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(60).default(30),
});
export function parseIntent(q: string) {
  const exact = q.match(
      /(?:约|大约|around|about)\s*(\d{1,3})\s*(?:岁|years? old)?/i,
    ),
    range = q.match(/(\d{1,3})\s*(?:-|–|至|到)\s*(\d{1,3})\s*(?:岁|years?)/i),
    age = q.match(/(\d{1,3})\s*(?:岁|years? old)/i);
  const result: Record<string, any> = {};
  if (range) {
    result.min_age = +range[1];
    result.max_age = +range[2];
  } else if (exact) {
    result.min_age = Math.max(1, +exact[1] - 5);
    result.max_age = Math.min(110, +exact[1] + 5);
  } else if (age) {
    result.min_age = result.max_age = +age[1];
  }
  if (/女性|女人|女演员|女主|母亲|\b(woman|female|actress|mother)\b/i.test(q))
    result.gender = "woman";
  else if (/男性|男人|男演员|男主|父亲|\b(man|male|actor|father)\b/i.test(q))
    result.gender = "man";
  if (
    /可商用|允许商用|允许商业|商业视频|commercial use|commercial video/i.test(q)
  )
    result.purpose = "commercial";
  if (/品牌广告|品牌合作|brand ad|brand campaign/i.test(q))
    result.purpose = "brand";
  if (/古装|historical|period costume/i.test(q)) result.category = "historical";
  if (/职业装|西装|business attire|business suit|wearing a suit/i.test(q))
    result.garment = "business";
  if (/完整角色卡|完整素材|complete package|all views/i.test(q))
    result.ready = "true";
  return result;
}
export function matchesHard(c: Row, f: Row) {
  return (
    (!f.gender || c.gender === f.gender) &&
    (!f.min_age || c.age >= f.min_age) &&
    (!f.max_age || c.age <= f.max_age) &&
    (!f.license || c.license === f.license) &&
    (!f.style || c.style === f.style) &&
    (!f.category || c.tags.includes(f.category)) &&
    (!f.garment ||
      (c.search_looks || []).some(
        (l: Row) =>
          l.tags.includes(f.garment) && (f.ready !== "true" || l.package_id),
      )) &&
    (!(f.ready === "true") || c.package_count > 0) &&
    (!(f.purpose === "commercial") ||
      (!c.demo && c.commercial && c.license !== "negotiation")) &&
    (!(f.purpose === "brand") ||
      (!c.demo &&
        c.commercial &&
        c.brand_collaboration &&
        c.license !== "negotiation"))
  );
}
function cosine(a: number[], b: number[]) {
  if (a.length !== b.length) return 0;
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
const terms = [
  ["父亲", "father"],
  ["温柔", "gentle"],
  ["严肃", "serious"],
  ["都市", "urban"],
  ["自然", "natural"],
  ["老年", "senior"],
  ["旅行", "travel"],
  ["职业装", "business"],
  ["古装", "historical"],
  ["青年", "young"],
  ["生活方式", "lifestyle"],
];
export async function searchCharacters(
  params: Record<string, string>,
  userId?: string,
) {
  const input = SearchSchema.parse(params),
    intent = parseIntent(input.q),
    filters = {
      ...intent,
      ...Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined && v !== ""),
      ),
    };
  if (input.min_age !== undefined && intent.min_age !== undefined)
    filters.min_age = Math.max(input.min_age, intent.min_age);
  if (input.max_age !== undefined && intent.max_age !== undefined)
    filters.max_age = Math.min(input.max_age, intent.max_age);
  if (intent.purpose === "commercial" && filters.purpose !== "brand")
    filters.purpose = "commercial";
  if (intent.purpose === "brand") filters.purpose = "brand";
  if (intent.ready === "true") filters.ready = "true";
  const contradictory = !!(
    (intent.gender && input.gender && intent.gender !== input.gender) ||
    (intent.category && input.category && intent.category !== input.category)
  );
  const candidates = await query(
    `SELECT c.*,coalesce((SELECT jsonb_agg(jsonb_build_object('id',sl.id,'name',sl.name,'identity_version',sl.identity_version,'tags',sl.search_tags,'package_id',sp.id,'views',coalesce((SELECT jsonb_agg(role) FROM assets sa WHERE sa.look_id=sl.id),'[]'::jsonb))) FROM looks sl LEFT JOIN packages sp ON sp.look_id=sl.id AND sp.state='ready' WHERE sl.character_id=c.id AND (sl.visibility='published' OR sl.owner_id=$1)),'[]'::jsonb) search_looks, (SELECT count(*)::int FROM packages p JOIN looks pl ON pl.id=p.look_id WHERE p.character_id=c.id AND p.state='ready' AND (pl.visibility='published' OR pl.owner_id=$1)) package_count,(SELECT count(*)::int FROM likes WHERE character_id=c.id) likes,(SELECT count(*)::int FROM looks WHERE character_id=c.id AND (visibility='published' OR owner_id=$1)) look_count, EXISTS(SELECT 1 FROM likes WHERE character_id=c.id AND user_id=$1) liked FROM characters c WHERE c.status='published' OR c.owner_id=$1 ORDER BY c.created_at,c.id`,
    [userId || null],
  );
  let embedding: number[] | undefined;
  let ranking = "keyword";
  if (
    input.q &&
    process.env.OPENAI_API_KEY &&
    candidates.some((c) => c.embedding)
  ) {
    try {
      const { default: OpenAI } = await import("openai");
      const r = await new OpenAI({
        timeout: 8000,
        maxRetries: 0,
      }).embeddings.create({
        model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
        input: input.q,
      });
      embedding = r.data[0].embedding;
      ranking = "hybrid";
    } catch {
      ranking = "keyword-fallback";
    }
  }
  const keywords = input.q
    .toLowerCase()
    .split(/[\s,，。.]+/)
    .filter(Boolean);
  for (const pair of terms)
    if (pair.some((t) => input.q.toLowerCase().includes(t)))
      keywords.push(...pair);
  const results = candidates
    .filter((c) => !contradictory && matchesHard(c, filters))
    .map((c): Row => {
      const text = JSON.stringify([
        c.name,
        c.personality,
        c.background,
        c.tags,
      ]).toLowerCase();
      const matched = [...new Set(keywords.filter((k) => text.includes(k)))];
      let score =
        matched.length +
        (embedding && c.embedding ? cosine(embedding, c.embedding) * 2 : 0);
      if (
        [c.id, c.name.zh, c.name.en].some(
          (v) => v?.toLowerCase() === input.q.toLowerCase(),
        )
      )
        score += 100;
      const { embedding: _, search_looks, ...safe } = c;
      const available = (search_looks || []).filter(
        (l: Row) =>
          (!filters.garment || l.tags.includes(filters.garment)) &&
          (filters.ready !== "true" || l.package_id),
      );
      const best = available.find((l: Row) => l.package_id) || available[0];
      return {
        ...safe,
        score,
        matched_terms: matched,
        available_looks: available,
        missing: ["identity", "front", "back"].filter(
          (role) => !best?.views?.includes(role),
        ),
        optional_missing: ["side"].filter(
          (role) => !best?.views?.includes(role),
        ),
        match_reason: matched.length
          ? matched.join(" · ")
          : "符合筛选条件 / Matches selected filters",
      };
    })
    .filter(
      (c) => !input.q.trim() || Object.keys(intent).length > 0 || c.score > 0,
    )
    .sort((a, b) => b.score - a.score);
  return {
    items: results.slice(input.cursor, input.cursor + input.limit),
    total: results.length,
    next_cursor:
      input.cursor + input.limit < results.length
        ? input.cursor + input.limit
        : null,
    parsed_filters: filters,
    ranking,
    suggestions: results.length
      ? []
      : [
          {
            label: {
              zh: "尝试扩大年龄范围，或取消完整素材限制",
              en: "Try widening the age range or removing the complete-package filter",
            },
            requires_explicit_change: true,
          },
        ],
  };
}
