import { readFile } from "node:fs/promises";
import { getStore } from "../src/lib/db";
import { isDemo } from "../src/lib/config";
const { db } = await getStore();
if (isDemo())
  console.log("Local PostgreSQL-compatible demo schema initialized.");
else {
  await db.query(await readFile("supabase/migrations/001_core.sql", "utf8"));
  await db.query(
    await readFile("supabase/migrations/003_talent_leads.sql", "utf8"),
  );
  await db.query(
    await readFile("supabase/migrations/004_asset_passports.sql", "utf8"),
  );
  console.log(
    "Core migration applied. Apply 002_access.sql once using the Supabase SQL editor.",
  );
}
process.exit(0);
