import { query } from "../src/lib/db";
const [email, role = "staff"] = process.argv.slice(2);
if (!email || !["staff", "admin"].includes(role))
  throw new Error("Usage: npx tsx scripts/promote.ts EMAIL staff|admin");
const rows = await query(
  `UPDATE users SET role=$2 WHERE email=$1 RETURNING id,email,role`,
  [email, role],
);
if (!rows.length) throw new Error("User must sign in once first");
console.log(rows);
process.exit(0);
