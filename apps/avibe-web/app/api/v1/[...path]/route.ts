import { createRevision, publishIdentity } from "@/lib/versions";
import { listTalentLeads } from "@/lib/talent-leads";
import {
  readPassport,
  submitPassportClaim,
  reviewPassportClaim,
  uploadPassportEvidence,
  readPassportEvidence,
  ensurePassport,
  passportCode,
} from "@/lib/passports";
import { NextRequest, NextResponse, after } from "next/server";
import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import { zipSync, strToU8 } from "fflate";
import { query, one, transaction, Row } from "@/lib/db";
import { AppError, assert, fail } from "@/lib/errors";
import { capabilities, isDemo, required } from "@/lib/config";
import {
  currentUser,
  requireUser,
  requireStaff,
  requireAdmin,
  newSession,
  loginDemo,
  hash,
  sameOrigin,
  rateLimit,
  supabaseAdmin,
} from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { searchCharacters } from "@/lib/search";
import { createAsset, getBytes, canReadAsset } from "@/lib/storage";
import {
  makePackage,
  packageForUser,
  packageZip,
  packageFiles,
  Purpose,
} from "@/lib/packages";
import {
  submitGeneration,
  processGeneration,
  buildSheet,
} from "@/lib/generation";
import {
  createCheckout,
  wechatWebhook,
  alipayWebhook,
  reconcilePayment,
} from "@/lib/payments";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const localized = z.object({
  zh: z.string().min(1).max(3000),
  en: z.string().min(1).max(3000),
});
const characterSchema = z.object({
  name: localized,
  age: z.number().int().min(1).max(110),
  gender: z.enum(["woman", "man", "nonbinary"]),
  personality: localized,
  background: localized,
  anchors: localized,
  tags: z.array(z.string().max(40)).max(30).default([]),
  style: z.literal("realistic").default("realistic"),
  license: z
    .enum(["commercial", "noncommercial", "negotiation"])
    .default("negotiation"),
  commercial: z.boolean().default(false),
  brand_collaboration: z.boolean().default(false),
  license_text: localized,
});
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function body(req: Request) {
  const raw = await req.text();
  assert(raw.length < 50_000, 413, "BODY_SIZE", "Request is too large");
  try {
    return JSON.parse(raw);
  } catch {
    fail(400, "JSON", "Invalid JSON body");
  }
}
const purpose = (url: URL) =>
  z
    .enum(["personal", "commercial", "brand"])
    .parse(url.searchParams.get("purpose") || "personal");
async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: p } = await params;
    const route = p.join("/"),
      method = req.method,
      url = new URL(req.url);
    if (route === "billing/webhooks/wechat" && method === "POST")
      return await wechatWebhook(req);
    if (route === "billing/webhooks/alipay" && method === "POST")
      return await alipayWebhook(req);
    sameOrigin(req);
    await ensureSeed();
    if (route === "health")
      return json({ ok: true, capabilities: capabilities() });
    if (route === "auth/demo" && method === "POST") {
      const { user } = await loginDemo();
      return NextResponse.json(
        { user },
        { headers: { "Set-Cookie": await newSession(user) } },
      );
    }
    if (route === "auth/otp" && method === "POST") {
      const { email } = z.object({ email: z.email() }).parse(await body(req));
      assert(
        !isDemo(),
        503,
        "DEMO_MODE",
        "Use the explicit demo session in local mode",
      );
      await rateLimit(`otp:${email}`, 3, 300);
      const { error } = await supabaseAdmin().auth.signInWithOtp({ email });
      assert(!error, 400, "OTP_SEND", "Could not send sign-in code");
      return json({ sent: true });
    }
    if (route === "auth/verify" && method === "POST") {
      const { email, token } = z
        .object({ email: z.email(), token: z.string().min(6).max(10) })
        .parse(await body(req));
      await rateLimit(`verify:${email}`, 8, 300);
      const { data, error } = await supabaseAdmin().auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      assert(
        !error && data.user,
        401,
        "OTP_INVALID",
        "Invalid or expired code",
      );
      const user = (
        await query(
          `INSERT INTO users(id,email) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email RETURNING *`,
          [data.user.id, data.user.email],
        )
      )[0];
      await query(
        `INSERT INTO wallets(user_id) VALUES($1) ON CONFLICT DO NOTHING`,
        [user.id],
      );
      return NextResponse.json(
        { user, session: data.session },
        { headers: { "Set-Cookie": await newSession(user as any) } },
      );
    }
    if (route === "auth/logout" && method === "POST") {
      const token = req.cookies.get("avibe_session")?.value;
      if (token)
        await query(`DELETE FROM sessions WHERE token_hash=$1`, [hash(token)]);
      return NextResponse.json(
        { ok: true },
        {
          headers: {
            "Set-Cookie":
              "avibe_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
          },
        },
      );
    }
    if (route === "me" && method === "GET") {
      const user = await currentUser(req, "read");
      assert(
        !user?.tokenScopes,
        403,
        "TOKEN_SCOPE",
        "Use the website session for account details",
      );
      return json({
        user: user || null,
        capabilities: capabilities(),
        wallet: user
          ? await one(`SELECT * FROM wallets WHERE user_id=$1`, [user.id])
          : null,
      });
    }
    if (route === "characters" && method === "GET") {
      const u = await currentUser(req, "read");
      return json(
        await searchCharacters(Object.fromEntries(url.searchParams), u?.id),
      );
    }
    if (p[0] === "characters" && p.length === 2 && method === "GET") {
      const u = await currentUser(req, "read"),
        c = await one(
          `SELECT * FROM characters WHERE id=$1 AND (status='published' OR owner_id=$2 OR $3)`,
          [p[1], u?.id || null, !!u && !u.tokenScopes && u.role !== "creator"],
        );
      assert(c, 404, "NOT_FOUND", "Character not found");
      delete c.embedding;
      const passport = await ensurePassport("characters", c.id);
      c.asset_passport = {
        number: passportCode(passport),
        lookup_path: `/api/v1/passports/characters/${c.id}`,
      };
      c.looks = await query(
        `SELECT l.*,p.id package_id FROM looks l LEFT JOIN packages p ON p.look_id=l.id AND p.look_version=l.version AND p.state='ready' WHERE l.character_id=$1 AND (l.visibility='published' OR l.owner_id=$2 OR $3) ORDER BY l.created_at`,
        [c.id, u?.id || null, !!u && !u.tokenScopes && u.role !== "creator"],
      );
      for (const l of c.looks) {
        const revision = await one(
          `SELECT snapshot FROM identity_versions WHERE character_id=$1 AND version=$2`,
          [c.id, l.identity_version],
        );
        if (revision) {
          const s = revision.snapshot;
          l.identity_profile = {
            name: s.name,
            age: s.age,
            personality: s.personality,
            background: s.background,
            anchors: s.anchors,
            identity_version: l.identity_version,
          };
        }

        const a = await query(`SELECT * FROM assets WHERE look_id=$1`, [l.id]);
        l.assets = [];
        for (const asset of a)
          if (await canReadAsset(asset, u))
            l.assets.push({
              id: asset.id,
              role: asset.role,
              width: asset.width,
              height: asset.height,
              url: `/api/v1/assets/${asset.id}`,
            });
        l.available_views = a.map((a) => a.role);
      }
      return json(c);
    }
    if (p[0] === "passports") {
      if (p[1] === "evidence" && p.length === 3 && method === "GET") {
        const user = await requireUser(req);
        const { e, bytes } = await readPassportEvidence(p[2], user);
        return new Response(new Uint8Array(bytes), {
          headers: {
            "Content-Type": e.mime,
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(e.filename)}`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (
        (p[1] === "characters" || p[1] === "leads") &&
        p.length === 3 &&
        method === "GET"
      ) {
        const user = await currentUser(req, "read");
        const version = url.searchParams.has("identity_version")
          ? z.coerce
              .number()
              .int()
              .positive()
              .parse(url.searchParams.get("identity_version"))
          : undefined;
        return json(
          await readPassport(
            p[1],
            p[2],
            user,
            version,
            url.searchParams.get("look_id"),
          ),
        );
      }
      if (
        (p[1] === "characters" || p[1] === "leads") &&
        p.length === 4 &&
        method === "POST"
      ) {
        const user = await requireUser(req);
        if (p[3] === "claims")
          return json(
            await submitPassportClaim(p[1], p[2], user, await body(req)),
            201,
          );
        if (p[3] === "evidence") {
          await rateLimit(`passport-evidence:${user.id}`, 20, 3600);
          assert(
            Number(req.headers.get("content-length") || 0) <= 11 * 1024 * 1024,
            413,
            "EVIDENCE_SIZE",
            "Evidence is too large",
          );
          const data = await req.formData();
          const file = data.get("file");
          assert(file instanceof File, 400, "FILE", "Choose an evidence file");
          return json(
            await uploadPassportEvidence(
              p[1],
              p[2],
              user,
              file.name,
              Buffer.from(await file.arrayBuffer()),
            ),
            201,
          );
        }
      }
    }
    if (p[0] === "assets" && p.length === 2 && method === "GET") {
      const a = await one(`SELECT * FROM assets WHERE id=$1`, [p[1]]);
      assert(a, 404, "NOT_FOUND", "Asset not found");
      const u = await currentUser(req, "download");
      const showcase =
        a.role === "showcase" &&
        (await one(
          `SELECT 1 FROM characters WHERE id=$1 AND status='published' AND cover=$2`,
          [a.character_id, `/api/v1/assets/${a.id}`],
        ));
      assert(
        showcase || (await canReadAsset(a, u)),
        404,
        "NOT_FOUND",
        "Asset not found",
      );
      return new Response(new Uint8Array(await getBytes(a.storage_key)), {
        headers: {
          "Content-Type": a.mime,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (p[0] === "packages" && p.length >= 2 && method === "GET") {
      const u = await requireUser(req, "download");
      const pack = await packageForUser(p[1], u, purpose(url));
      if (p[2] === "download") {
        await query(
          `INSERT INTO events(id,user_id,name,data) VALUES($1,$2,'package_download',$3)`,
          [
            randomUUID(),
            u.id,
            JSON.stringify({
              package_id: pack.id,
              character_id: pack.character_id,
              purpose: purpose(url),
            }),
          ],
        );
        return new Response(new Uint8Array(await packageZip(pack)), {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="avibe-${pack.character_id}-${pack.look_version}.zip"`,
            "Cache-Control": "no-store",
          },
        });
      }
      return json(pack.manifest);
    }
    const u = await requireUser(req, method === "GET" ? "read" : undefined);
    if (u.tokenScopes)
      assert(
        p[0] === "casting-boards",
        403,
        "TOKEN_SCOPE",
        "Personal tokens can only read characters, packages and casting boards",
      );
    if (route === "characters" && method === "POST") {
      const c = characterSchema.parse(await body(req));
      const id = randomUUID();
      const row = (
        await query(
          `INSERT INTO characters(id,owner_id,name,age,gender,personality,background,anchors,tags,style,license,commercial,brand_collaboration,license_text) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
          [
            id,
            u.id,
            JSON.stringify(c.name),
            c.age,
            c.gender,
            JSON.stringify(c.personality),
            JSON.stringify(c.background),
            JSON.stringify(c.anchors),
            JSON.stringify(c.tags),
            c.style,
            c.license,
            c.commercial,
            c.brand_collaboration,
            JSON.stringify(c.license_text),
          ],
        )
      )[0];
      return json(row, 201);
    }
    if (p[0] === "characters" && p[2] === "revisions" && method === "GET") {
      assert(
        await one(`SELECT 1 FROM characters WHERE id=$1 AND owner_id=$2`, [
          p[1],
          u.id,
        ]),
        404,
        "NOT_FOUND",
        "Character not found",
      );
      return json({
        items: await query(
          `SELECT version,snapshot,created_at FROM identity_versions WHERE character_id=$1 ORDER BY version DESC`,
          [p[1]],
        ),
      });
    }
    if (
      p[0] === "characters" &&
      ((p.length === 2 && method === "PATCH") ||
        (p[2] === "revisions" && method === "POST"))
    )
      return json(
        await createRevision(
          p[1],
          u.id,
          characterSchema.parse(await body(req)),
        ),
        201,
      );
    if (p[0] === "characters" && p[2] === "submit" && method === "POST") {
      const { look_id } = z
        .object({ look_id: z.string() })
        .parse(await body(req));
      const pack = await one(
        `SELECT p.id,l.identity_version FROM packages p JOIN looks l ON l.id=p.look_id WHERE l.id=$1 AND l.character_id=$2 AND l.owner_id=$3 AND l.visibility='private' AND p.state='ready'`,
        [look_id, p[1], u.id],
      );
      assert(
        pack,
        409,
        "PACKAGE_REQUIRED",
        "Approve a complete reference package before submitting",
      );
      await transaction(async (db) => {
        await db.query(
          `UPDATE characters SET status='pending' WHERE id=$1 AND owner_id=$2 AND status IN ('private','rejected')`,
          [p[1], u.id],
        );
        await db.query(
          `UPDATE looks SET visibility='pending' WHERE id=$1 AND owner_id=$2`,
          [look_id, u.id],
        );
      });
      return json({ submitted: true });
    }
    if (p[0] === "characters" && p[2] === "like" && method === "POST") {
      assert(
        await one(
          `SELECT 1 FROM characters WHERE id=$1 AND status='published'`,
          [p[1]],
        ),
        404,
        "NOT_FOUND",
        "Character not found",
      );
      const { liked } = z.object({ liked: z.boolean() }).parse(await body(req));
      if (liked)
        await query(`INSERT INTO likes VALUES($1,$2) ON CONFLICT DO NOTHING`, [
          u.id,
          p[1],
        ]);
      else
        await query(`DELETE FROM likes WHERE user_id=$1 AND character_id=$2`, [
          u.id,
          p[1],
        ]);
      return json({ liked });
    }
    if (route === "assets" && method === "POST") {
      assert(
        Number(req.headers.get("content-length") || 0) < 22 * 1024 * 1024,
        413,
        "IMAGE_SIZE",
        "Image too large",
      );
      const form = await req.formData(),
        file = form.get("file"),
        role = z.enum(["garment", "chat"]).parse(form.get("role"));
      assert(
        file instanceof File && file.size <= 20 * 1024 * 1024,
        400,
        "IMAGE_REQUIRED",
        "Upload an image under 20 MB",
      );
      const metadata = {
        brand: String(form.get("brand") || "").slice(0, 200),
        category: String(form.get("category") || "").slice(0, 40),
        sku: String(form.get("sku") || "").slice(0, 100),
        color: String(form.get("color") || "").slice(0, 100),
        view: String(form.get("view") || "front").slice(0, 20),
      };
      return json(
        await createAsset(Buffer.from(await file.arrayBuffer()), {
          ownerId: u.id,
          role,
          metadata,
        }),
        201,
      );
    }
    if (route === "casting-boards" && method === "GET") {
      const boards = await query(
        `SELECT * FROM boards WHERE user_id=$1 ORDER BY created_at DESC`,
        [u.id],
      );
      for (const b of boards)
        b.entries = await query(
          `SELECT e.*,c.name,c.cover,c.sprite_index FROM board_entries e JOIN characters c ON c.id=e.character_id WHERE board_id=$1 ORDER BY e.created_at`,
          [b.id],
        );
      return json({ items: boards });
    }
    if (route === "casting-boards" && method === "POST") {
      const { name } = z
        .object({ name: z.string().min(1).max(100) })
        .parse(await body(req));
      return json(
        (
          await query(
            `INSERT INTO boards(id,user_id,name) VALUES($1,$2,$3) RETURNING *`,
            [randomUUID(), u.id, name],
          )
        )[0],
        201,
      );
    }
    if (p[0] === "casting-boards" && p.length >= 2) {
      const b = await one(`SELECT * FROM boards WHERE id=$1 AND user_id=$2`, [
        p[1],
        u.id,
      ]);
      assert(b, 404, "NOT_FOUND", "Board not found");
      if (p[2] === "entries" && method === "POST") {
        const e = z
          .object({
            character_id: z.string(),
            look_id: z.string(),
            role_name: z.string().max(100).default(""),
          })
          .parse(await body(req));
        const l = await one(
          `SELECT l.*,c.status,c.owner_id character_owner FROM looks l JOIN characters c ON c.id=l.character_id WHERE l.id=$1 AND l.character_id=$2 AND (c.status='published' OR c.owner_id=$3) AND (l.visibility='published' OR l.owner_id=$3)`,
          [e.look_id, e.character_id, u.id],
        );
        assert(l, 404, "NOT_FOUND", "Look not found");
        const pack = await one(
          `SELECT id FROM packages WHERE look_id=$1 AND state='ready'`,
          [l.id],
        );
        return json(
          (
            await query(
              `INSERT INTO board_entries(id,board_id,character_id,look_id,package_id,role_name) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(board_id,character_id,look_id) DO UPDATE SET role_name=EXCLUDED.role_name RETURNING *`,
              [
                randomUUID(),
                b.id,
                e.character_id,
                l.id,
                pack?.id || null,
                e.role_name,
              ],
            )
          )[0],
        );
      }
      if (p[2] === "entries" && p[3] && method === "DELETE") {
        await query(`DELETE FROM board_entries WHERE id=$1 AND board_id=$2`, [
          p[3],
          b.id,
        ]);
        return json({ ok: true });
      }
      if (p[2] === "export" && method === "GET") {
        await requireUser(req, "download");
        const entries = await query(
          `SELECT * FROM board_entries WHERE board_id=$1 ORDER BY created_at`,
          [b.id],
        );
        assert(entries.length > 0, 409, "EMPTY_BOARD", "Board is empty");
        const files: Record<string, Uint8Array> = {
          "cast.json": strToU8(
            JSON.stringify(
              {
                schema: "avibe-cast-v1",
                board: b.name,
                purpose: purpose(url),
                entries,
              },
              null,
              2,
            ),
          ),
        };
        for (const e of entries) {
          assert(
            e.package_id,
            409,
            "INCOMPLETE_CAST",
            "Some selected looks do not have a complete package",
          );
          const pack = await packageForUser(e.package_id, u, purpose(url));
          for (const [file, bytes] of Object.entries(await packageFiles(pack)))
            files[`${e.id}/${file}`] = bytes;
        }
        return new Response(new Uint8Array(zipSync(files, { level: 0 })), {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="avibe-cast.zip"',
          },
        });
      }
    }
    if (route === "generation-jobs" && method === "GET")
      return json({
        items: await query(
          `SELECT * FROM generation_jobs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
          [u.id],
        ),
      });
    if (route === "generation-jobs/quote" && method === "POST") {
      const { kind } = z
        .object({ kind: z.string().max(30) })
        .parse(await body(req));
      const price = await one(
        `SELECT * FROM pricing WHERE kind=$1 AND active`,
        [kind],
      );
      assert(price, 503, "PRICING_UNAVAILABLE", "Pricing unavailable");
      return json({
        ...price,
        generation_available: capabilities().generation,
      });
    }
    if (route === "generation-jobs" && method === "POST") {
      await rateLimit(`jobs:${u.id}`, 10, 60);
      const job = await submitGeneration(u, await body(req));
      if (isDemo() && job.status === "queued")
        after(() => processGeneration(job.id));
      return json(job, 202);
    }
    if (p[0] === "generation-jobs" && p[2] === "approve" && method === "POST") {
      const j = await one(
        `SELECT * FROM generation_jobs WHERE id=$1 AND user_id=$2`,
        [p[1], u.id],
      );
      assert(
        j?.status === "review",
        409,
        "REVIEW_STATE",
        "Job is not ready for review",
      );
      let approvedIdentityVersion = j.input.identity_version;
      const { identity_asset_id, quality_confirmed, profile_override } = z
        .object({
          identity_asset_id: z.string().optional(),
          quality_confirmed: z.boolean().default(false),
          profile_override: z
            .object({ personality: localized, background: localized })
            .optional(),
        })
        .parse(await body(req));
      if (j.kind !== "candidates")
        assert(
          quality_confirmed,
          400,
          "QUALITY_REVIEW",
          "Review identity, body and garment details before approving",
        );
      if (j.kind === "candidates") {
        assert(
          j.output.candidate_ids.includes(identity_asset_id),
          400,
          "CANDIDATE",
          "Choose one of the generated candidates",
        );
        if (j.output.suggested_profile) {
          const revision = await createRevision(j.input.character_id, u.id, {
            ...j.input.character_snapshot,
            ...(profile_override || j.output.suggested_profile),
          });
          approvedIdentityVersion = revision.identity_version;
        }
        await query(
          `UPDATE generation_jobs SET output=output||$2::jsonb WHERE id=$1`,
          [
            j.id,
            JSON.stringify({
              selected_identity: identity_asset_id,
              approved_identity_version: approvedIdentityVersion,
            }),
          ],
        );
      } else if (j.kind === "showcase") {
        const c = await one(`SELECT * FROM characters WHERE id=$1`, [
          j.input.character_id,
        ]);
        assert(
          c.owner_id === u.id,
          403,
          "OWNERSHIP",
          "Only the identity owner can approve its showcase",
        );
        await query(
          `UPDATE identity_versions SET showcase_asset_id=$3 WHERE character_id=$1 AND version=$2`,
          [c.id, j.input.identity_version, j.output.showcase_asset_id],
        );
        if (
          c.status !== "published" &&
          c.identity_version === j.input.identity_version
        )
          await query(`UPDATE characters SET cover=$2 WHERE id=$1`, [
            c.id,
            `/api/v1/assets/${j.output.showcase_asset_id}`,
          ]);
      } else if (j.kind !== "tryon") {
        await buildSheet(j.output.look_id, u.id);
        await query(
          `UPDATE looks SET state='ready',approved_at=now() WHERE id=$1 AND owner_id=$2`,
          [j.output.look_id, u.id],
        );
        await makePackage(j.input.character_id, j.output.look_id);
      }
      await query(
        `UPDATE generation_jobs SET status='succeeded',updated_at=now() WHERE id=$1`,
        [j.id],
      );
      return json({
        approved: true,
        look_id: j.output.look_id,
        identity_version: approvedIdentityVersion,
      });
    }
    if (route === "billing" && method === "GET")
      return json({
        wallet: await one(`SELECT * FROM wallets WHERE user_id=$1`, [u.id]),
        ledger: await query(
          `SELECT * FROM credit_ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
          [u.id],
        ),
        plans: await query(
          `SELECT * FROM plans WHERE active ORDER BY amount_fen`,
        ),
        orders: await query(
          `SELECT * FROM payment_orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`,
          [u.id],
        ),
        enabled: capabilities().payments,
      });
    if (route === "billing/orders" && method === "POST") {
      assert(
        capabilities().payments,
        503,
        "PAYMENTS_DISABLED",
        "Real payments are not enabled",
      );
      const { plan_id, provider } = z
        .object({ plan_id: z.string(), provider: z.enum(["wechat", "alipay"]) })
        .parse(await body(req));
      assert(
        capabilities().payment_providers.includes(provider),
        503,
        "PAYMENT_PROVIDER_DISABLED",
        "This payment provider is not configured",
      );
      const plan = await one(`SELECT * FROM plans WHERE id=$1 AND active`, [
        plan_id,
      ]);
      assert(plan, 400, "PLAN_UNAVAILABLE", "Plan is unavailable");
      const id = randomBytes(16).toString("hex");
      const o = (
        await query(
          `INSERT INTO payment_orders(id,user_id,provider,amount_fen,credits) VALUES($1,$2,$3,$4,$5) RETURNING *`,
          [id, u.id, provider, plan.amount_fen, plan.credits],
        )
      )[0];
      const checkout = await createCheckout(o);
      await query(`UPDATE payment_orders SET checkout=$2 WHERE id=$1`, [
        id,
        JSON.stringify(checkout),
      ]);
      return json({ ...o, checkout }, 201);
    }
    if (p[0] === "billing" && p[1] === "orders" && p[2] && method === "GET") {
      const o = await one(
        `SELECT * FROM payment_orders WHERE id=$1 AND user_id=$2`,
        [p[2], u.id],
      );
      assert(o, 404, "NOT_FOUND", "Order not found");
      if (o.status === "pending") await reconcilePayment(o);
      return json(
        await one(`SELECT * FROM payment_orders WHERE id=$1`, [o.id]),
      );
    }
    if (route === "tokens" && method === "GET")
      return json({
        items: await query(
          `SELECT id,name,scopes,revoked_at,created_at FROM api_tokens WHERE user_id=$1 ORDER BY created_at DESC`,
          [u.id],
        ),
      });
    if (route === "tokens" && method === "POST") {
      const { name } = z
        .object({ name: z.string().min(1).max(100) })
        .parse(await body(req));
      const token = `avibe_${randomBytes(32).toString("hex")}`,
        id = randomUUID();
      await query(
        `INSERT INTO api_tokens(id,user_id,token_hash,name) VALUES($1,$2,$3,$4)`,
        [id, u.id, hash(token), name],
      );
      return json({ id, token, name, scopes: ["read", "download"] }, 201);
    }
    if (p[0] === "tokens" && p[1] && method === "DELETE") {
      await query(
        `UPDATE api_tokens SET revoked_at=now() WHERE id=$1 AND user_id=$2`,
        [p[1], u.id],
      );
      return json({ ok: true });
    }
    if (route === "conversations" && method === "GET") {
      const items = await query(
        `SELECT v.*,c.name character_name,c.cover,c.sprite_index,(SELECT body FROM messages WHERE conversation_id=v.id AND (NOT internal OR $2) ORDER BY created_at DESC LIMIT 1) last_message,(SELECT count(*)::int FROM messages m WHERE m.conversation_id=v.id AND m.sender_id<>$1 AND (NOT m.internal OR $2) AND m.created_at>coalesce((SELECT read_at FROM conversation_reads WHERE conversation_id=v.id AND user_id=$1),'1970-01-01'::timestamptz)) unread FROM conversations v LEFT JOIN characters c ON c.id=v.character_id WHERE v.user_id=$1 OR $2 ORDER BY v.created_at DESC`,
        [u.id, u.role !== "creator"],
      );
      return json({ items });
    }
    if (route === "conversations" && method === "POST") {
      const { character_id, look_id } = z
        .object({ character_id: z.string(), look_id: z.string().optional() })
        .parse(await body(req));
      assert(
        await one(
          `SELECT 1 FROM characters WHERE id=$1 AND (status='published' OR owner_id=$2)`,
          [character_id, u.id],
        ),
        404,
        "NOT_FOUND",
        "Character not found",
      );
      if (look_id)
        assert(
          await one(
            `SELECT 1 FROM looks WHERE id=$1 AND character_id=$2 AND (visibility='published' OR owner_id=$3)`,
            [look_id, character_id, u.id],
          ),
          404,
          "NOT_FOUND",
          "Look not found",
        );
      return json(
        (
          await query(
            `INSERT INTO conversations(id,user_id,character_id,look_id) VALUES($1,$2,$3,$4) RETURNING *`,
            [randomUUID(), u.id, character_id, look_id || null],
          )
        )[0],
        201,
      );
    }
    if (p[0] === "conversations" && p.length >= 2) {
      const conv = await one(
        `SELECT * FROM conversations WHERE id=$1 AND (user_id=$2 OR $3)`,
        [p[1], u.id, u.role !== "creator"],
      );
      assert(conv, 404, "NOT_FOUND", "Conversation not found");
      if (p[2] === "messages" && method === "GET") {
        const items = await query(
          `SELECT m.*,u.role sender_role FROM messages m JOIN users u ON u.id=m.sender_id WHERE conversation_id=$1 AND (NOT internal OR $2) ORDER BY m.created_at,m.id`,
          [conv.id, u.role !== "creator"],
        );
        await query(
          `INSERT INTO conversation_reads(conversation_id,user_id) VALUES($1,$2) ON CONFLICT(conversation_id,user_id) DO UPDATE SET read_at=now()`,
          [conv.id, u.id],
        );
        return json({ items });
      }
      if (p[2] === "messages" && method === "POST") {
        await rateLimit(`chat:${u.id}`, 30);
        const msg = z
          .object({
            body: z.string().max(5000).default(""),
            asset_id: z.string().optional(),
            client_id: z.string().min(8).max(100),
            internal: z.boolean().default(false),
          })
          .parse(await body(req));
        assert(
          msg.body.trim() || msg.asset_id,
          400,
          "EMPTY_MESSAGE",
          "Message cannot be empty",
        );
        if (msg.internal) requireStaff(u);
        if (msg.asset_id)
          assert(
            await one(
              `SELECT 1 FROM assets WHERE id=$1 AND owner_id=$2 AND role='chat'`,
              [msg.asset_id, u.id],
            ),
            403,
            "ATTACHMENT",
            "Attachment not found",
          );
        const row = (
          await query(
            `INSERT INTO messages(id,conversation_id,sender_id,body,asset_id,client_id,internal) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(conversation_id,sender_id,client_id) DO UPDATE SET client_id=EXCLUDED.client_id RETURNING *`,
            [
              randomUUID(),
              conv.id,
              u.id,
              msg.body,
              msg.asset_id || null,
              msg.client_id,
              msg.internal,
            ],
          )
        )[0];
        return json(row, 201);
      }
      if (method === "PATCH") {
        requireStaff(u);
        const data = z
          .object({
            status: z.enum(["open", "negotiating", "won", "closed"]),
            assigned_to: z.string().nullable(),
          })
          .parse(await body(req));
        if (data.assigned_to)
          assert(
            await one(
              `SELECT 1 FROM users WHERE id=$1 AND role IN ('staff','admin')`,
              [data.assigned_to],
            ),
            400,
            "STAFF",
            "Invalid staff member",
          );
        await query(
          `UPDATE conversations SET status=$2,assigned_to=$3 WHERE id=$1`,
          [conv.id, data.status, data.assigned_to],
        );
        return json({ ok: true });
      }
    }
    if (p[0] === "admin") {
      requireStaff(u);
      if (route === "admin/passports/review" && method === "POST") {
        const data = await body(req);
        const claimId = z.string().parse(data.claim_id);
        delete data.claim_id;
        return json(await reviewPassportClaim(claimId, u, data));
      }
      if (route === "admin/passports" && method === "GET")
        return json({
          subjects: await query(
            `SELECT c.id,'characters' AS type,c.name,p.serial FROM characters c LEFT JOIN asset_passports p ON p.character_id=c.id UNION ALL SELECT l.id,'leads' AS type,jsonb_build_object('zh',l.account_name,'en',l.account_name) AS name,p.serial FROM talent_leads l LEFT JOIN asset_passports p ON p.lead_id=l.id`,
          ),
        });
      if (route === "admin/talent-leads" && method === "GET")
        return json({ items: await listTalentLeads() });
      if (route === "admin/overview" && method === "GET")
        return json({
          pending: await query(
            `SELECT * FROM characters WHERE status='pending' ORDER BY created_at`,
          ),
          talent_leads: await listTalentLeads(),
          pending_looks: await query(
            `SELECT l.*,c.name character_name FROM looks l JOIN characters c ON c.id=l.character_id WHERE visibility='pending'`,
          ),
          pricing: await query(`SELECT * FROM pricing ORDER BY kind`),
          plans: await query(`SELECT * FROM plans ORDER BY amount_fen`),
          staff: await query(
            `SELECT id,email,role FROM users WHERE role IN ('staff','admin')`,
          ),
          metrics: await query(
            `SELECT name,count(*)::int count FROM events GROUP BY name`,
          ),
          generation: await query(
            `SELECT status,count(*)::int count FROM generation_jobs GROUP BY status`,
          ),
        });
      if (route === "admin/review" && method === "POST") {
        const v = z
          .object({
            character_id: z.string(),
            look_id: z.string(),
            approved: z.boolean(),
          })
          .parse(await body(req));
        assert(
          await one(
            `SELECT 1 FROM looks WHERE id=$1 AND character_id=$2 AND visibility='pending' AND state='ready'`,
            [v.look_id, v.character_id],
          ),
          409,
          "REVIEW_STATE",
          "Submitted look not found",
        );
        await transaction(async (db) => {
          const look = (
            await db.query(`SELECT * FROM looks WHERE id=$1 FOR UPDATE`, [
              v.look_id,
            ])
          ).rows[0];
          assert(
            look.visibility === "pending",
            409,
            "REVIEW_STATE",
            "This submission was already reviewed",
          );
          await db.query(`UPDATE looks SET visibility=$2 WHERE id=$1`, [
            v.look_id,
            v.approved ? "published" : "private",
          ]);
          if (v.approved) {
            const c = (
              await db.query(`SELECT * FROM characters WHERE id=$1`, [
                v.character_id,
              ])
            ).rows[0];
            if (c.owner_id === look.owner_id)
              await publishIdentity(db, v.character_id, look.identity_version);
          }
          await db.query(
            `UPDATE characters SET status=$2 WHERE id=$1 AND status='pending'`,
            [v.character_id, v.approved ? "published" : "rejected"],
          );
        });
        return json({ ok: true });
      }
      requireAdmin(u);
      if (route === "admin/pricing" && method === "POST") {
        const v = z
          .object({
            kind: z.enum([
              "candidates",
              "views",
              "showcase",
              "tryon",
              "complete-look",
              "redo",
            ]),
            credits: z.number().int().positive(),
            active: z.boolean(),
          })
          .parse(await body(req));
        await query(
          `INSERT INTO pricing(kind,credits,active) VALUES($1,$2,$3) ON CONFLICT(kind) DO UPDATE SET credits=EXCLUDED.credits,active=EXCLUDED.active,version=pricing.version+1`,
          [v.kind, v.credits, v.active],
        );
        return json({ ok: true });
      }
      if (route === "admin/plans" && method === "POST") {
        const v = z
          .object({
            id: z.string().min(1).max(80),
            name: z.string().max(100),
            amount_fen: z.number().int().positive(),
            credits: z.number().int().positive(),
            active: z.boolean(),
          })
          .parse(await body(req));
        await query(
          `INSERT INTO plans(id,name,amount_fen,credits,active) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,amount_fen=EXCLUDED.amount_fen,credits=EXCLUDED.credits,active=EXCLUDED.active`,
          [v.id, v.name, v.amount_fen, v.credits, v.active],
        );
        return json({ ok: true });
      }
      if (route === "admin/grants" && method === "POST") {
        const v = z
          .object({
            user_id: z.string(),
            character_id: z.string(),
            purpose: z.enum(["personal", "commercial", "brand"]),
            expires_at: z.iso.datetime().nullable(),
          })
          .parse(await body(req));
        await query(
          `INSERT INTO grants(id,user_id,character_id,purpose,expires_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,character_id,purpose) DO UPDATE SET expires_at=EXCLUDED.expires_at`,
          [randomUUID(), v.user_id, v.character_id, v.purpose, v.expires_at],
        );
        return json({ ok: true });
      }
    }
    return json(
      { error: { code: "NOT_FOUND", message: "Endpoint not found" } },
      404,
    );
  } catch (e) {
    if (e instanceof AppError)
      return json({ error: { code: e.code, message: e.message } }, e.status);
    if (e instanceof z.ZodError)
      return json(
        {
          error: {
            code: "VALIDATION",
            message: "Invalid input / 输入格式不正确",
            details: e.issues.map((x) => ({
              path: x.path,
              message: x.message,
            })),
          },
        },
        400,
      );
    console.error(
      "avibe api:",
      e instanceof Error ? e.message : "unknown error",
    );
    return json(
      {
        error: {
          code: "INTERNAL",
          message: "The operation could not be completed / 操作未完成",
        },
      },
      500,
    );
  }
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
