import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { query, one } from "./db";
import { isDemo, required, appOrigin, supabaseSecretKey } from "./config";
import { assert, fail } from "./errors";
export type User = {
  id: string;
  email: string;
  role: "creator" | "staff" | "admin";
  tokenScopes?: string[];
};
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function supabaseAdmin() {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseSecretKey() || required("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export function sameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  if (req.headers.get("authorization")?.startsWith("Bearer ")) return;
  const origin = req.headers.get("origin");
  assert(
    origin === appOrigin(),
    403,
    "ORIGIN",
    "Request origin is not allowed",
  );
}
export async function currentUser(
  req: Request,
  scope?: "read" | "download",
): Promise<User | undefined> {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (bearer) {
    const row = await one(
      `SELECT u.*,t.scopes FROM api_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=$1 AND t.revoked_at IS NULL`,
      [hash(bearer)],
    );
    if (!row) return undefined;
    if (scope && !row.scopes.includes(scope))
      fail(403, "TOKEN_SCOPE", "This token cannot perform this operation");
    return {
      id: row.id,
      email: row.email,
      role: "creator",
      tokenScopes: row.scopes,
    } as User;
  }
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("avibe_session="))
    ?.slice(14);
  if (!token) return undefined;
  return await one<User>(
    `SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [hash(token)],
  );
}
export async function requireUser(req: Request, scope?: "read" | "download") {
  const u = await currentUser(req, scope);
  assert(u, 401, "AUTH_REQUIRED", "Please sign in / 请先登录");
  if (u.tokenScopes && !scope)
    fail(
      403,
      "TOKEN_SCOPE",
      "Personal tokens are limited to search and download",
    );
  return u;
}
export function requireStaff(user: User) {
  assert(
    ["staff", "admin"].includes(user.role),
    403,
    "STAFF_REQUIRED",
    "Staff access required",
  );
}
export function requireAdmin(user: User) {
  assert(user.role === "admin", 403, "ADMIN_REQUIRED", "Admin access required");
}
export async function newSession(user: User) {
  const token = randomBytes(32).toString("hex");
  await query(
    `INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')`,
    [hash(token), user.id],
  );
  return `avibe_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${appOrigin().startsWith("https:") ? "; Secure" : ""}`;
}
export async function loginDemo() {
  assert(isDemo(), 404, "NOT_FOUND", "Not found");
  const id = randomUUID();
  const email = `demo-${id}@local.invalid`;
  await query(`INSERT INTO users(id,email) VALUES($1,$2)`, [id, email]);
  await query(`INSERT INTO wallets(user_id,balance) VALUES($1,200)`, [id]);
  await query(
    `INSERT INTO credit_ledger(id,user_id,event_key,kind,amount,description) VALUES($1,$2,$3,'demo',200,'Local demonstration credits — no monetary value')`,
    [randomUUID(), id, `demo:${id}`],
  );
  return { user: { id, email, role: "creator" } as User };
}
export async function rateLimit(key: string, limit: number, seconds = 60) {
  const r = await one(
    `INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+($2||' seconds')::interval) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END,expires_at=CASE WHEN rate_limits.expires_at<now() THEN EXCLUDED.expires_at ELSE rate_limits.expires_at END RETURNING count`,
    [key, String(seconds)],
  );
  assert(
    r.count <= limit,
    429,
    "RATE_LIMIT",
    "Too many requests. Please try again later.",
  );
}
