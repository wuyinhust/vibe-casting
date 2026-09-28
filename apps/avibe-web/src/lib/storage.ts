import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import { query, one, Row } from "./db";
import { isDemo } from "./config";
import { supabaseAdmin, User } from "./auth";
import { assert } from "./errors";
const bucket = () => process.env.SUPABASE_ASSET_BUCKET || "avibe-private";
function localPath(key: string) {
  assert(
    /^[a-zA-Z0-9/_\-.]+$/.test(key) && !key.includes(".."),
    400,
    "BAD_PATH",
    "Invalid storage key",
  );
  return path.join(
    process.env.AVIBE_ASSET_DIR || path.join(process.cwd(), ".data/assets"),
    key,
  );
}
export async function putBytes(key: string, buffer: Buffer, mime: string) {
  if (isDemo()) {
    const p = localPath(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, buffer);
  } else {
    const { error } = await supabaseAdmin()
      .storage.from(bucket())
      .upload(key, buffer, { contentType: mime, upsert: false });
    if (error) throw error;
  }
}
export async function getBytes(key: string) {
  if (isDemo()) return readFile(localPath(key));
  const { data, error } = await supabaseAdmin()
    .storage.from(bucket())
    .download(key);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}
export async function createAsset(
  buffer: Buffer,
  info: {
    ownerId?: string;
    characterId?: string;
    lookId?: string;
    role: string;
    metadata?: Row;
  },
) {
  assert(
    buffer.length <= 20 * 1024 * 1024,
    400,
    "IMAGE_SIZE",
    "Images must be under 20 MB",
  );
  const meta = await sharp(buffer, { limitInputPixels: 40_000_000 }).metadata();
  assert(
    ["png", "jpeg", "webp"].includes(meta.format || ""),
    400,
    "IMAGE_TYPE",
    "Use PNG, JPEG or WebP",
  );
  const sanitized = await sharp(buffer).rotate().png().toBuffer();
  assert(
    sanitized.length <= 20 * 1024 * 1024,
    400,
    "IMAGE_SIZE",
    "Decoded image exceeds storage limit",
  );
  const size = await sharp(sanitized).metadata();
  const id = randomUUID(),
    key = `${info.ownerId || "official"}/${id}.png`;
  await putBytes(key, sanitized, "image/png");
  return (
    await query(
      `INSERT INTO assets(id,owner_id,character_id,look_id,role,storage_key,mime,sha256,width,height,bytes,metadata) VALUES($1,$2,$3,$4,$5,$6,'image/png',$7,$8,$9,$10,$11) RETURNING *`,
      [
        id,
        info.ownerId || null,
        info.characterId || null,
        info.lookId || null,
        info.role,
        key,
        createHash("sha256").update(sanitized).digest("hex"),
        size.width,
        size.height,
        sanitized.length,
        JSON.stringify(info.metadata || {}),
      ],
    )
  )[0];
}
export async function canReadAsset(asset: Row, user?: User) {
  if (!user) return false;
  if (user.tokenScopes && ["chat", "garment"].includes(asset.role))
    return false;
  if (
    user.role === "admin" ||
    user.role === "staff" ||
    asset.owner_id === user.id
  )
    return true;
  if (asset.role === "chat")
    return !!(await one(
      `SELECT 1 FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.asset_id=$1 AND c.user_id=$2 AND NOT m.internal`,
      [asset.id, user.id],
    ));
  // Unassigned candidate images are always private, including candidates for a published character.
  if (!asset.look_id) return false;
  if (asset.look_id) {
    const look = await one(`SELECT * FROM looks WHERE id=$1`, [asset.look_id]);
    if (!look || look.visibility !== "published") return false;
  }
  if (!asset.character_id) return false;
  const c = await one(`SELECT * FROM characters WHERE id=$1`, [
    asset.character_id,
  ]);
  if (!c) return false;
  if (c.owner_id === user.id) return true;
  if (c.status !== "published") return false;
  // Raw production references require the same license gate as a package download.
  if (c.license !== "negotiation") return true;
  return !!(await one(
    `SELECT 1 FROM grants WHERE character_id=$1 AND user_id=$2 AND (expires_at IS NULL OR expires_at>now())`,
    [c.id, user.id],
  ));
}
