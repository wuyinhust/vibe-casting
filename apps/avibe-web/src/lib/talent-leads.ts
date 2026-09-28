import { createHash } from "node:crypto";
import { z } from "zod";
import { query, transaction } from "./db";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const recordSchema = z
  .object({
    account_name: z.string().min(1).max(120),
    account_handle: z.string().min(1).max(120),
    profile_url: z.url(),
    character_label: z.string().min(1).max(300),
    persona_type: z.enum(["剧情宇宙", "独立AI人设", "待定"]),
    reported_followers: count,
    reported_engagement: count,
    reported_posts: count.nullable(),
    source_status: z.enum(["追踪中", "观察中", "待解析"]),
    platform: z.enum(["小红书", "抖音"]),
    source_notes: z.string().max(10000),
    review_flags: z.array(z.string().max(400)).max(30),
    observed_on: z.iso.date(),
  })
  .strict()
  .superRefine((r, ctx) => {
    const u = new URL(r.profile_url);
    const valid =
      r.platform === "小红书"
        ? u.hostname === "www.xiaohongshu.com" &&
          /^\/user\/profile\/[a-f0-9]+$/.test(u.pathname)
        : u.hostname === "www.douyin.com" &&
          /^\/user\/[A-Za-z0-9_-]+$/.test(u.pathname);
    if (
      !valid ||
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.search ||
      u.hash
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Use the canonical HTTPS profile URL for the specified platform",
        path: ["profile_url"],
      });
  });
export const leadBatchSchema = z
  .object({
    schema: z.literal("avibe-talent-leads-v1"),
    source_url: z.url(),
    source_kind: z.literal("user_pasted_table"),
    metric_note: z.string().max(2000),
    records: z.array(recordSchema).min(1).max(500),
  })
  .strict()
  .superRefine((b, ctx) => {
    const urls = new Set<string>();
    for (const r of b.records) {
      if (urls.has(r.profile_url))
        ctx.addIssue({ code: "custom", message: "Duplicate account in batch" });
      urls.add(r.profile_url);
    }
  });
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export async function importTalentLeads(input: unknown) {
  const batch = leadBatchSchema.parse(input);
  return transaction(async (db) => {
    let inserted = 0,
      snapshots = 0;
    for (const record of batch.records) {
      const id = "lead-" + digest(record.profile_url).slice(0, 24);
      const payload = JSON.stringify(record);
      const created = await db.query(
        `INSERT INTO talent_leads(id,profile_url,account_name,platform,observed_on,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(profile_url) DO NOTHING RETURNING id`,
        [
          id,
          record.profile_url,
          record.account_name,
          record.platform,
          record.observed_on,
          payload,
        ],
      );
      inserted += created.rows.length;
      const current = await db.query<{ id: string }>(
        `SELECT id FROM talent_leads WHERE profile_url=$1 FOR UPDATE`,
        [record.profile_url],
      );
      const leadId = current.rows[0].id;
      const snapshotId = digest(
        JSON.stringify({
          source: batch.source_url,
          kind: batch.source_kind,
          note: batch.metric_note,
          record,
        }),
      );
      const snapshot = await db.query(
        `INSERT INTO talent_lead_snapshots(id,lead_id,source_url,source_kind,metric_note,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
        [
          snapshotId,
          leadId,
          batch.source_url,
          batch.source_kind,
          batch.metric_note,
          payload,
        ],
      );
      snapshots += snapshot.rows.length;
      if (snapshot.rows.length && !created.rows.length) {
        await db.query(
          `UPDATE talent_leads SET account_name=$2,observed_on=$3,payload=$4,verification_status='unverified',updated_at=now() WHERE id=$1 AND observed_on <= $3::date`,
          [leadId, record.account_name, record.observed_on, payload],
        );
      }
    }
    return {
      processed: batch.records.length,
      inserted,
      new_snapshots: snapshots,
      visibility: "staff_only",
      published_characters: 0,
    };
  });
}
export async function listTalentLeads() {
  return query(
    `SELECT id,profile_url,account_name,platform,observed_on::text,verification_status,rights_status,payload FROM talent_leads ORDER BY platform,account_name`,
  );
}
