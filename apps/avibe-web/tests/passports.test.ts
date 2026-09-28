import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { one, query } from "../src/lib/db";
import sharp from "sharp";
import { createAsset } from "../src/lib/storage";
import { makePackage, packageFiles } from "../src/lib/packages";
import { createHash } from "node:crypto";
import {
  readPassport,
  submitPassportClaim,
  uploadPassportEvidence,
  readPassportEvidence,
  reviewPassportClaim,
  effectiveClaimStatus,
  packagePassport,
} from "../src/lib/passports";
process.env.AVIBE_MODE = "demo";
process.env.AVIBE_DATA_DIR = await mkdtemp(
  path.join(tmpdir(), "avibe-passports-db-"),
);
process.env.AVIBE_ASSET_DIR = await mkdtemp(
  path.join(tmpdir(), "avibe-passports-files-"),
);
const owner = {
    id: "owner",
    email: "owner@local.invalid",
    role: "creator" as const,
  },
  other = {
    id: "other",
    email: "other@local.invalid",
    role: "creator" as const,
  },
  staff = {
    id: "reviewer",
    email: "reviewer@local.invalid",
    role: "staff" as const,
  };
const input = {
  kind: "display",
  identity_version: 1,
  title: "Display agreement",
  declarant: "Private Legal Name",
  private_notes: "PRIVATE contract terms and reference links",
  public_summary: "Display on AVIBE only; no download rights",
  evidence_ids: [] as string[],
};
let evidenceId = "",
  claimId = "";
before(async () => {
  for (const u of [owner, other, staff])
    await query("INSERT INTO users(id,email,role) VALUES($1,$2,$3)", [
      u.id,
      u.email,
      u.role,
    ]);
  for (const id of ["public", "private"])
    await query(
      `INSERT INTO characters(id,owner_id,name,age,gender,personality,background,status) VALUES($1,'owner','{"zh":"角色","en":"Talent"}',30,'woman','{}','{}',$2)`,
      [id, id === "public" ? "published" : "private"],
    );
  await query(
    `INSERT INTO looks(id,character_id,identity_version,name,description,visibility) VALUES('look1','public',1,'{}','{}','published'),('look2','public',2,'{}','{}','private')`,
  );
  await query(
    `INSERT INTO identity_versions(character_id,version,snapshot) VALUES('public',2,'{}')`,
  );
});
test("Stable unique numbers and private characters remain undiscoverable", async () => {
  const a = await readPassport("characters", "public"),
    b = await readPassport("characters", "public");
  assert.equal(a.number, b.number);
  assert.match(a.number, /^AVB-P-\d+$/);
  await assert.rejects(readPassport("characters", "private", other), {
    status: 404,
  });
  const own = await readPassport("characters", "private", owner);
  assert.notEqual(a.number, own.number);
  assert.equal(own.can_manage, true);
  assert.equal(a.can_manage, false);
  await assert.rejects(
    readPassport("characters", "private", { ...owner, tokenScopes: ["read"] }),
    { status: 404 },
  );
});
test("Original evidence bytes and fingerprints survive upload; access stays private", async () => {
  const bytes = Buffer.from("Original agreement. Private contents.");
  const e = await uploadPassportEvidence(
    "characters",
    "public",
    owner,
    "contract.txt",
    bytes,
  );
  evidenceId = e.id;
  assert.deepEqual(
    (await readPassportEvidence(evidenceId, owner)).bytes,
    bytes,
  );
  assert.deepEqual(
    (await readPassportEvidence(evidenceId, staff)).bytes,
    bytes,
  );
  await assert.rejects(readPassportEvidence(evidenceId, other), {
    status: 403,
  });
  await assert.rejects(
    uploadPassportEvidence(
      "characters",
      "public",
      owner,
      "script.html",
      Buffer.from("<html>unsafe</html>"),
    ),
    { status: 400 },
  );
});
test("Submitted claims do not grant access or expose private evidence, dates or names", async () => {
  const claim = await submitPassportClaim("characters", "public", owner, {
    ...input,
    claimed_created_at: "2020-01-01",
    evidence_ids: [evidenceId],
  });
  claimId = claim.id;
  const pub = await readPassport("characters", "public");
  assert.equal(
    pub.statuses.find((s: any) => s.kind === "display").status,
    "submitted",
  );
  for (const key of ["claims", "evidence", "events", "production"])
    assert.equal(pub[key], undefined);
  assert.ok(!JSON.stringify(pub).includes("Private Legal Name"));
  assert.ok(!JSON.stringify(pub).includes("2020-01-01"));
  assert.equal(
    (await one("SELECT license FROM characters WHERE id='public'")).license,
    "negotiation",
  );
  await assert.rejects(
    reviewPassportClaim(claimId, owner, {
      status: "approved",
      note: "Checked files",
      expected_revision: 1,
    }),
    { status: 403 },
  );
});
test("Review requires evidence and rejects foreign evidence references", async () => {
  await assert.rejects(
    submitPassportClaim("characters", "private", owner, {
      ...input,
      evidence_ids: [evidenceId],
    }),
    { status: 400 },
  );
  const c = await submitPassportClaim("characters", "public", owner, {
    ...input,
    kind: "commercial",
  });
  await assert.rejects(
    reviewPassportClaim(c.id, staff, {
      status: "approved",
      note: "Missing original agreement",
      expected_revision: 1,
    }),
    { status: 409 },
  );
});
test("Approved public summary is version scoped; concurrent review cannot overwrite", async () => {
  await reviewPassportClaim(claimId, staff, {
    status: "approved",
    note: "Checked the uploaded display-only agreement",
    expected_revision: 1,
  });
  const pub = await readPassport("characters", "public");
  assert.equal(
    pub.statuses.find((s: any) => s.kind === "display").summary,
    input.public_summary,
  );
  await assert.rejects(
    reviewPassportClaim(claimId, staff, {
      status: "revoked",
      note: "Stale reviewer action",
      expected_revision: 1,
    }),
    { status: 409 },
  );
  await assert.rejects(readPassport("characters", "public", undefined, 2), {
    status: 404,
  });
  const revision = await readPassport("characters", "public", owner, 2);
  assert.equal(
    revision.statuses.find((s: any) => s.kind === "display").status,
    "missing",
  );
  await assert.rejects(
    readPassport("characters", "public", owner, 1, "look2"),
    { status: 404 },
  );
});
test("Look-scoped approvals do not apply to other looks or the identity generally", async () => {
  const c = await submitPassportClaim("characters", "public", owner, {
    ...input,
    kind: "adaptation",
    look_id: "look1",
    evidence_ids: [evidenceId],
  });
  await reviewPassportClaim(c.id, staff, {
    status: "approved",
    note: "Only look1 is covered by this evidence",
    expected_revision: 1,
  });
  assert.equal(
    (
      await readPassport("characters", "public", undefined, 1, "look1")
    ).statuses.find((s: any) => s.kind === "adaptation").status,
    "approved",
  );
  assert.equal(
    (await readPassport("characters", "public")).statuses.find(
      (s: any) => s.kind === "adaptation",
    ).status,
    "missing",
  );
});
test("Revocations and expiry remove active approval while retaining audit history", async () => {
  await reviewPassportClaim(claimId, staff, {
    status: "revoked",
    note: "Agreement withdrawn after review",
    expected_revision: 2,
  });
  const pub = await readPassport("characters", "public");
  const s = pub.statuses.find((s: any) => s.kind === "display");
  assert.equal(s.status, "revoked");
  assert.equal(s.summary, "");
  const own = await readPassport("characters", "public", owner);
  assert.ok(
    own.events.filter((e: any) => e.event === "claim_reviewed").length >= 3,
  );
  assert.equal(
    effectiveClaimStatus({ status: "approved", valid_until: "2020-01-01" }),
    "expired",
  );
  assert.equal(
    effectiveClaimStatus({ status: "approved", valid_from: "2099-01-01" }),
    "scheduled",
  );
});
test("Package passport contains only stable reference, no private documents or permissions", async () => {
  const p = await packagePassport("public", 1, "look1");
  assert.equal(p.number, (await readPassport("characters", "public")).number);
  assert.equal("claims" in p, false);
  assert.match(p.lookup_path, /identity_version=1&look_id=look1/);
  assert.match(p.notice, /does not certify copyright/);
});
test("New complete packages include a verified passport document and remain immutable", async () => {
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#aaaaaa" },
  })
    .png()
    .toBuffer();
  for (const role of ["identity", "front", "back"])
    await createAsset(png, {
      ownerId: owner.id,
      characterId: "public",
      lookId: "look1",
      role,
    });
  await query(
    "UPDATE looks SET state='ready',approved_at=now() WHERE id='look1'",
  );
  const pack = await makePackage("public", "look1");
  const files = await packageFiles(pack),
    document = pack.manifest.files.find(
      (f: any) => f.path === "ASSET-PASSPORT.json",
    );
  assert.ok(document);
  assert.equal(
    document.sha256,
    createHash("sha256").update(files["ASSET-PASSPORT.json"]).digest("hex"),
  );
  assert.equal(
    JSON.parse(Buffer.from(files["ASSET-PASSPORT.json"]).toString())
      .identity_version,
    1,
  );
  assert.deepEqual(
    (await makePackage("public", "look1")).manifest,
    pack.manifest,
  );
});
