import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { one, query, transaction, Row } from "./db";
import { User, requireStaff } from "./auth";
import { assert } from "./errors";
import { putBytes, getBytes } from "./storage";
export const passportKinds = [
  "production",
  "identity",
  "rights_holder",
  "display",
  "download",
  "adaptation",
  "commercial",
  "brand",
  "sublicense",
  "official_registration",
] as const;
export const passportCode = (p: Row) =>
  `AVB-P-${String(p.serial).padStart(8, "0")}`;
export async function recordPassportEvent(
  characterId: string,
  userId: string,
  event: string,
  payload: Row,
) {
  const p = await ensurePassport("characters", characterId);
  await query(
    `INSERT INTO passport_events(id,passport_id,actor_id,event,payload) VALUES($1,$2,$3,$4,$5)`,
    [randomUUID(), p.id, userId, event, JSON.stringify(payload)],
  );
}
export async function ensurePassport(type: "characters" | "leads", id: string) {
  const field = type === "characters" ? "character_id" : "lead_id";
  return (
    await query(
      `INSERT INTO asset_passports(id,${field}) VALUES($1,$2) ON CONFLICT(${field}) DO UPDATE SET ${field}=EXCLUDED.${field} RETURNING *`,
      [randomUUID(), id],
    )
  )[0];
}
export async function passportAccess(
  type: string,
  id: string,
  user?: User,
  write = false,
) {
  assert(
    type === "characters" || type === "leads",
    404,
    "NOT_FOUND",
    "Passport not found",
  );
  const staff = !!user && !user.tokenScopes && user.role !== "creator";
  const subject = await one(
    `SELECT * FROM ${type === "characters" ? "characters" : "talent_leads"} WHERE id=$1`,
    [id],
  );
  assert(subject, 404, "NOT_FOUND", "Passport not found");
  const owner =
    type === "characters" &&
    !!user &&
    !user.tokenScopes &&
    subject.owner_id === user.id;
  const manage = staff || owner;
  assert(
    type === "characters" ? subject.status === "published" || manage : staff,
    404,
    "NOT_FOUND",
    "Passport not found",
  );
  assert(
    !write || manage,
    403,
    "PASSPORT_ACCESS",
    "Only the owner or staff can submit evidence",
  );
  const p = await ensurePassport(type, id);
  return { subject, p, manage, staff };
}
export async function passportVersion(
  subject: Row,
  characterId: string | undefined,
  version: number,
  lookId?: string | null,
  manage = false,
) {
  if (!characterId) {
    assert(
      version === 1 && !lookId,
      400,
      "VERSION",
      "Candidate accounts have no character versions",
    );
    return;
  }
  const current = subject.identity_version === version;
  const recorded = await one(
    `SELECT 1 FROM identity_versions WHERE character_id=$1 AND version=$2`,
    [characterId, version],
  );
  const published = await one(
    `SELECT 1 FROM looks WHERE character_id=$1 AND identity_version=$2 AND visibility='published'`,
    [characterId, version],
  );
  assert(
    (current || recorded) && (manage || current || published),
    404,
    "VERSION",
    "Identity version not available",
  );
  if (lookId)
    assert(
      await one(
        `SELECT 1 FROM looks WHERE id=$1 AND character_id=$2 AND identity_version=$3 AND (visibility='published' OR $4)`,
        [lookId, characterId, version, manage],
      ),
      404,
      "LOOK",
      "Look not available",
    );
}
export function effectiveClaimStatus(c: Row, now = Date.now()) {
  if (c.status !== "approved") return c.status;
  if (c.valid_from && new Date(c.valid_from).getTime() > now)
    return "scheduled";
  if (c.valid_until && new Date(c.valid_until).getTime() <= now)
    return "expired";
  return "approved";
}
export async function readPassport(
  type: string,
  id: string,
  user?: User,
  version?: number,
  lookId?: string | null,
) {
  const { subject, p, manage, staff } = await passportAccess(type, id, user);
  const v = version || subject.identity_version || 1;
  await passportVersion(subject, p.character_id, v, lookId, manage);
  const claims = await query(
    `SELECT * FROM passport_claims WHERE passport_id=$1 AND identity_version=$2 AND (look_id IS NULL OR look_id=$3) ORDER BY submitted_at DESC,id DESC`,
    [p.id, v, lookId || null],
  );
  const statuses = passportKinds.map((kind) => {
    const matching = claims.filter((c) => c.kind === kind);
    // A pending replacement never creates or silently cancels a reviewed license.
    const c =
      matching
        .filter((c) => c.reviewed_at)
        .sort(
          (a, b) =>
            new Date(b.reviewed_at).getTime() -
            new Date(a.reviewed_at).getTime(),
        )[0] || matching[0];
    return {
      kind,
      status: c ? effectiveClaimStatus(c) : "missing",
      summary: c?.status === "approved" ? c.public_summary : "",
      valid_from: c?.status === "approved" ? c.valid_from : null,
      valid_until: c?.status === "approved" ? c.valid_until : null,
      record_id: c?.status === "approved" ? c.id : null,
    };
  });
  const assets = p.character_id
    ? await query(
        `SELECT a.id,a.role,a.sha256,a.width,a.height,a.bytes,l.id look_id,l.version look_version FROM assets a JOIN looks l ON l.id=a.look_id WHERE a.character_id=$1 AND l.identity_version=$2 AND (l.visibility='published' OR $3) AND ($4::text IS NULL OR l.id=$4) ORDER BY a.created_at`,
        [id, v, manage, lookId || null],
      )
    : [];
  const result: Row = {
    schema: "avibe-asset-passport-v1",
    id: p.id,
    number: passportCode(p),
    subject_type: type === "characters" ? "character" : "candidate_account",
    subject_id: id,
    name: subject.name || {
      zh: subject.account_name,
      en: subject.account_name,
    },
    registered_at: p.registered_at,
    identity_version: v,
    look_id: lookId || null,
    generated_at: new Date().toISOString(),
    demo: !!subject.demo,
    statuses,
    assets,
    can_manage: manage,
    can_review: staff,
    notice:
      "AVIBE platform registration and evidence review only; not an official copyright certificate or a grant of usage rights. No independent timestamp provider connected.",
  };
  if (manage) {
    result.claims = claims.map((c) => ({
      ...c,
      effective_status: effectiveClaimStatus(c),
    }));
    result.evidence = await query(
      `SELECT id,filename,mime,bytes,sha256,received_at FROM passport_evidence WHERE passport_id=$1 ORDER BY received_at DESC`,
      [p.id],
    );
    result.events = await query(
      `SELECT event,payload,recorded_at FROM passport_events WHERE passport_id=$1 ORDER BY recorded_at DESC`,
      [p.id],
    );
    result.production = p.character_id
      ? await query(
          `SELECT id,kind,status,input,output,usage,created_at,updated_at FROM generation_jobs WHERE input->>'character_id'=$1 AND (input->>'identity_version')::int=$2 ORDER BY created_at`,
          [id, v],
        )
      : [];
  }
  return result;
}
export const claimSchema = z
  .object({
    kind: z.enum(passportKinds),
    identity_version: z.number().int().positive(),
    look_id: z.string().nullable().optional(),
    title: z.string().min(2).max(200),
    declarant: z.string().min(1).max(200),
    private_notes: z.string().min(5).max(10000),
    public_summary: z.string().min(2).max(600),
    claimed_created_at: z.iso.date().nullable().optional(),
    valid_from: z.iso.datetime({ offset: true }).nullable().optional(),
    valid_until: z.iso.datetime({ offset: true }).nullable().optional(),
    evidence_ids: z.array(z.string()).max(20).default([]),
  })
  .strict()
  .refine(
    (v) =>
      !v.valid_until ||
      !v.valid_from ||
      Date.parse(v.valid_until) > Date.parse(v.valid_from),
    "End date must follow start date",
  );
export async function submitPassportClaim(
  type: string,
  id: string,
  user: User,
  input: unknown,
) {
  const data = claimSchema.parse(input);
  const { p, subject } = await passportAccess(type, id, user, true);
  await passportVersion(
    subject,
    p.character_id,
    data.identity_version,
    data.look_id,
    true,
  );
  return transaction(async (db) => {
    for (const e of data.evidence_ids)
      assert(
        (
          await db.query(
            `SELECT 1 FROM passport_evidence WHERE id=$1 AND passport_id=$2`,
            [e, p.id],
          )
        ).rows.length,
        400,
        "EVIDENCE",
        "Evidence belongs to a different passport",
      );
    const record = (
      await db.query(
        `INSERT INTO passport_claims(id,passport_id,submitter_id,kind,identity_version,look_id,title,declarant,private_notes,public_summary,claimed_created_at,valid_from,valid_until,evidence_ids) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [
          randomUUID(),
          p.id,
          user.id,
          data.kind,
          data.identity_version,
          data.look_id || null,
          data.title,
          data.declarant,
          data.private_notes,
          data.public_summary,
          data.claimed_created_at || null,
          data.valid_from || null,
          data.valid_until || null,
          JSON.stringify(data.evidence_ids),
        ],
      )
    ).rows[0];
    await db.query(
      `INSERT INTO passport_events(id,passport_id,actor_id,event,payload) VALUES($1,$2,$3,'claim_submitted',$4)`,
      [
        randomUUID(),
        p.id,
        user.id,
        JSON.stringify({
          claim_id: record.id,
          kind: data.kind,
          identity_version: data.identity_version,
          look_id: data.look_id || null,
        }),
      ],
    );
    return record;
  });
}
export async function reviewPassportClaim(
  claimId: string,
  user: User,
  input: unknown,
) {
  requireStaff(user);
  assert(!user.tokenScopes, 403, "TOKEN_SCOPE", "Staff session required");
  const data = z
    .object({
      status: z.enum(["approved", "rejected", "revoked"]),
      expected_revision: z.number().int().positive(),
      note: z.string().min(5).max(2000),
    })
    .strict()
    .parse(input);
  return transaction(async (db) => {
    const c = (
      await db.query(`SELECT * FROM passport_claims WHERE id=$1 FOR UPDATE`, [
        claimId,
      ])
    ).rows[0];
    assert(c, 404, "NOT_FOUND", "Record not found");
    assert(
      c.revision === data.expected_revision,
      409,
      "STALE_REVIEW",
      "Record changed; reload before reviewing",
    );
    assert(
      data.status === "revoked"
        ? c.status === "approved"
        : c.status === "submitted",
      409,
      "REVIEW_STATE",
      "This decision is not valid for the current state",
    );
    if (data.status === "approved") {
      assert(
        c.evidence_ids.length > 0,
        409,
        "EVIDENCE_REQUIRED",
        "Upload supporting evidence before approval",
      );
      assert(
        !c.valid_until || new Date(c.valid_until).getTime() > Date.now(),
        409,
        "EXPIRED",
        "Cannot approve an expired record",
      );
    }
    const updated = (
      await db.query(
        `UPDATE passport_claims SET status=$2,reviewed_by=$3,review_note=$4,reviewed_at=now(),revision=revision+1 WHERE id=$1 RETURNING *`,
        [claimId, data.status, user.id, data.note],
      )
    ).rows[0];
    await db.query(
      `INSERT INTO passport_events(id,passport_id,actor_id,event,payload) VALUES($1,$2,$3,'claim_reviewed',$4)`,
      [
        randomUUID(),
        c.passport_id,
        user.id,
        JSON.stringify({
          claim_id: c.id,
          from: c.status,
          to: data.status,
          note: data.note,
          revision: updated.revision,
        }),
      ],
    );
    return updated;
  });
}
export async function uploadPassportEvidence(
  type: string,
  id: string,
  user: User,
  filename: string,
  bytes: Buffer,
) {
  const { p } = await passportAccess(type, id, user, true);
  assert(
    bytes.length > 0 && bytes.length <= 10 * 1024 * 1024,
    413,
    "EVIDENCE_SIZE",
    "Evidence must be between 1 byte and 10 MB",
  );
  let mime = "";
  if (bytes.subarray(0, 5).toString() === "%PDF-") mime = "application/pdf";
  else if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    mime = "image/png";
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    mime = "image/jpeg";
  else if (/\.(txt|json)$/i.test(filename) && !bytes.includes(0)) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      mime = "text/plain";
    } catch {}
  }
  assert(mime, 400, "EVIDENCE_TYPE", "Use PDF, PNG, JPEG, UTF-8 TXT or JSON");
  const eid = randomUUID(),
    key = `passport-evidence/${p.id}/${eid}`;
  await putBytes(key, bytes, mime);
  return transaction(async (db) => {
    const e = (
      await db.query(
        `INSERT INTO passport_evidence(id,passport_id,uploader_id,filename,storage_key,mime,bytes,sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,filename,sha256,bytes,received_at`,
        [
          eid,
          p.id,
          user.id,
          filename.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 180),
          key,
          mime,
          bytes.length,
          createHash("sha256").update(bytes).digest("hex"),
        ],
      )
    ).rows[0];
    await db.query(
      `INSERT INTO passport_events(id,passport_id,actor_id,event,payload) VALUES($1,$2,$3,'evidence_received',$4)`,
      [
        randomUUID(),
        p.id,
        user.id,
        JSON.stringify({ evidence_id: eid, sha256: e.sha256 }),
      ],
    );
    return e;
  });
}
export async function readPassportEvidence(id: string, user: User) {
  const e = await one(
    `SELECT e.*,p.character_id,p.lead_id FROM passport_evidence e JOIN asset_passports p ON p.id=e.passport_id WHERE e.id=$1`,
    [id],
  );
  assert(e, 404, "NOT_FOUND", "Evidence not found");
  await passportAccess(
    e.character_id ? "characters" : "leads",
    e.character_id || e.lead_id,
    user,
    true,
  );
  const bytes = await getBytes(e.storage_key);
  assert(
    createHash("sha256").update(bytes).digest("hex") === e.sha256,
    409,
    "INTEGRITY",
    "Evidence integrity check failed",
  );
  return { e, bytes };
}
export async function packagePassport(
  characterId: string,
  version: number,
  lookId: string,
) {
  const p = await ensurePassport("characters", characterId);
  return {
    schema: "avibe-asset-passport-v1",
    number: passportCode(p),
    character_id: characterId,
    identity_version: version,
    look_id: lookId,
    registered_at: p.registered_at,
    snapshot_at: new Date().toISOString(),
    lookup_path: `/api/v1/passports/characters/${characterId}?identity_version=${version}&look_id=${lookId}`,
    notice:
      "Platform asset registration only. Consult LICENSE.json for package terms and the live passport for evidence review. This record does not certify copyright or grant additional permissions.",
  };
}
