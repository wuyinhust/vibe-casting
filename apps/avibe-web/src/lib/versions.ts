import { one, transaction, Row } from "./db";
import { assert } from "./errors";

export async function identitySnapshot(character: Row, version: number) {
  const stored = await one(
    `SELECT snapshot FROM identity_versions WHERE character_id=$1 AND version=$2`,
    [character.id, version],
  );
  if (stored)
    return {
      ...stored.snapshot,
      id: character.id,
      owner_id: character.owner_id,
      identity_version: version,
    };
  assert(
    version === character.identity_version,
    404,
    "IDENTITY_VERSION",
    "Identity version not found",
  );
  return transaction(async (db) => {
    await db.query(
      `INSERT INTO identity_versions(character_id,version,snapshot) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
      [character.id, version, JSON.stringify(character)],
    );
    return (
      await db.query(
        `SELECT snapshot FROM identity_versions WHERE character_id=$1 AND version=$2`,
        [character.id, version],
      )
    ).rows[0].snapshot;
  });
}

export async function createRevision(
  characterId: string,
  userId: string,
  profile: Row,
) {
  return transaction(async (db) => {
    const c = (
      await db.query(
        `SELECT * FROM characters WHERE id=$1 AND owner_id=$2 FOR UPDATE`,
        [characterId, userId],
      )
    ).rows[0];
    assert(c, 404, "NOT_FOUND", "Character not found");
    await db.query(
      `INSERT INTO identity_versions(character_id,version,snapshot) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
      [c.id, c.identity_version, JSON.stringify(c)],
    );
    const row = (
      await db.query(
        `SELECT coalesce(max(version),0)+1 version FROM identity_versions WHERE character_id=$1`,
        [c.id],
      )
    ).rows[0];
    const snapshot = {
      ...c,
      ...profile,
      identity_version: row.version,
      status: "private",
      cover: null,
      sprite_index: null,
    };
    await db.query(
      `INSERT INTO identity_versions(character_id,version,snapshot) VALUES($1,$2,$3)`,
      [c.id, row.version, JSON.stringify(snapshot)],
    );
    return snapshot;
  });
}

export async function publishIdentity(
  db: { query: Function },
  characterId: string,
  version: number,
) {
  const v = (
    await db.query(
      `SELECT snapshot,showcase_asset_id FROM identity_versions WHERE character_id=$1 AND version=$2`,
      [characterId, version],
    )
  ).rows[0];
  if (!v) return;
  const s = v.snapshot;
  const current = (
    await db.query(`SELECT * FROM characters WHERE id=$1 FOR UPDATE`, [
      characterId,
    ])
  ).rows[0];
  if (current.status === "published" && version < current.identity_version)
    return;
  const cover = v.showcase_asset_id
    ? `/api/v1/assets/${v.showcase_asset_id}`
    : version === current.identity_version
      ? current.cover
      : null;
  assert(
    cover,
    409,
    "SHOWCASE_REQUIRED",
    "Approve a showcase image for this identity version before publication",
  );
  await db.query(
    `UPDATE characters SET identity_version=$2,name=$3,age=$4,gender=$5,personality=$6,background=$7,anchors=$8,tags=$9,license=$10,commercial=$11,brand_collaboration=$12,license_text=$13,cover=$14,sprite_index=CASE WHEN $15 THEN NULL ELSE sprite_index END,status='published' WHERE id=$1`,
    [
      characterId,
      version,
      s.name,
      s.age,
      s.gender,
      s.personality,
      s.background,
      s.anchors,
      JSON.stringify(s.tags),
      s.license,
      s.commercial,
      s.brand_collaboration,
      s.license_text,
      cover,
      !!v.showcase_asset_id,
    ],
  );
}
