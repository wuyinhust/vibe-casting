import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { importTalentLeads, listTalentLeads } from "../src/lib/talent-leads";
import { one, query } from "../src/lib/db";
process.env.AVIBE_MODE = "demo";
process.env.AVIBE_DATA_DIR = await mkdtemp(
  path.join(tmpdir(), "avibe-leads-test-"),
);
const row = {
  account_name: "测试账号",
  account_handle: "123",
  profile_url:
    "https://www.xiaohongshu.com/user/profile/654cbf4e00000000020288ed",
  character_label: "甲、乙",
  persona_type: "剧情宇宙",
  reported_followers: 50,
  reported_engagement: 150,
  reported_posts: null,
  source_status: "追踪中",
  platform: "小红书",
  source_notes: "历史记录",
  review_flags: [],
  observed_on: "2026-09-17",
};
const batch = {
  schema: "avibe-talent-leads-v1",
  source_url: "https://saas.docs.qq.com/smartsheet/example",
  source_kind: "user_pasted_table",
  metric_note: "口径未核实",
  records: [row],
};
test("Research imports remain unverified, staff-only and create no character assets", async () => {
  const result = await importTalentLeads(batch);
  assert.equal(result.inserted, 1);
  assert.equal(result.visibility, "staff_only");
  const [lead] = await listTalentLeads();
  assert.equal(lead.payload.character_label, "甲、乙");
  assert.equal(lead.payload.reported_posts, null);
  assert.equal(lead.verification_status, "unverified");
  assert.equal(lead.rights_status, "unknown");
  assert.equal((await one("SELECT count(*)::int n FROM characters")).n, 0);
  assert.equal((await one("SELECT count(*)::int n FROM packages")).n, 0);
  const rls = await query(
    "SELECT relrowsecurity FROM pg_class WHERE relname IN ('talent_leads','talent_lead_snapshots')",
  );
  assert.equal(rls.length, 2);
  assert.ok(rls.every((r) => r.relrowsecurity));
});
test("Replaying import creates no duplicate accounts or snapshots", async () => {
  const result = await importTalentLeads(batch);
  assert.equal(result.inserted, 0);
  assert.equal(result.new_snapshots, 0);
  assert.equal((await listTalentLeads()).length, 1);
});
test("Updated research keeps original snapshot and clears prior verification", async () => {
  await query("UPDATE talent_leads SET verification_status='verified'");
  await importTalentLeads({
    ...batch,
    records: [{ ...row, reported_followers: 51 }],
  });
  assert.equal(
    (await one("SELECT count(*)::int n FROM talent_lead_snapshots")).n,
    2,
  );
  const [lead] = await listTalentLeads();
  assert.equal(lead.payload.reported_followers, 51);
  assert.equal(lead.verification_status, "unverified");
});
test("Older observations cannot replace latest metrics", async () => {
  await importTalentLeads({
    ...batch,
    records: [{ ...row, observed_on: "2026-09-16", reported_followers: 20 }],
  });
  assert.equal((await listTalentLeads())[0].payload.reported_followers, 51);
});
test("Invalid second record aborts whole batch before writes, unsafe links rejected", async () => {
  const before = (
    await one("SELECT count(*)::int n FROM talent_lead_snapshots")
  ).n;
  await assert.rejects(
    importTalentLeads({
      ...batch,
      records: [
        { ...row, reported_followers: 999 },
        { ...row, profile_url: "https://evil.example/user/profile/123" },
      ],
    }),
  );
  assert.equal(
    (await one("SELECT count(*)::int n FROM talent_lead_snapshots")).n,
    before,
  );
  assert.equal((await listTalentLeads())[0].payload.reported_followers, 51);
  await assert.rejects(importTalentLeads({ ...batch, records: [row, row] }));
});
