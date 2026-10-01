import { getStore } from "../src/lib/db";
import { isDemo } from "../src/lib/config";

const requiredTables = [
  "users",
  "sessions",
  "api_tokens",
  "characters",
  "identity_versions",
  "looks",
  "assets",
  "packages",
  "grants",
  "likes",
  "boards",
  "board_entries",
  "wallets",
  "credit_ledger",
  "pricing",
  "plans",
  "generation_jobs",
  "payment_orders",
  "payment_events",
  "conversations",
  "messages",
  "conversation_reads",
  "events",
  "rate_limits",
  "talent_leads",
  "talent_lead_snapshots",
  "asset_passports",
  "passport_evidence",
  "passport_claims",
  "passport_events",
];

const { db } = await getStore();
const demo = isDemo();
const failures: string[] = [];
for (const table of requiredTables) {
  const result = await db.query<{ exists: boolean; rls: boolean }>(
    "SELECT c.oid IS NOT NULL AS exists, COALESCE(c.relrowsecurity, false) AS rls FROM (SELECT to_regclass($1) AS oid) r LEFT JOIN pg_class c ON c.oid = r.oid",
    [`public.${table}`],
  );
  const row = result.rows[0];
  if (!row?.exists) failures.push(`missing table: ${table}`);
  else if (!demo && !row.rls) failures.push(`RLS disabled: ${table}`);
}

if (!demo) {
  const bucket = await db.query<{ public: boolean }>(
    "SELECT public FROM storage.buckets WHERE id = $1",
    [process.env.SUPABASE_ASSET_BUCKET || "avibe-private"],
  );
  if (bucket.rows.length !== 1) failures.push("private asset bucket missing");
  else if (bucket.rows[0].public) failures.push("asset bucket is public");
}

if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log(
    `${requiredTables.length} tables checked; ${demo ? "local demo schema" : "live RLS and private bucket"} ready.`,
  );
}
