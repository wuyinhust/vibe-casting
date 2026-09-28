import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { query } from "../src/lib/db";
import { createAsset } from "../src/lib/storage";
import { buildSheet } from "../src/lib/generation";
import { makePackage } from "../src/lib/packages";

const localized = z.object({ zh: z.string().min(1), en: z.string().min(1) });
const schema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: localized,
  age: z.number().int().min(1).max(110),
  gender: z.enum(["woman", "man", "nonbinary"]),
  personality: localized,
  background: localized,
  anchors: localized,
  tags: z.array(z.string()),
  license: z.enum(["commercial", "noncommercial", "negotiation"]),
  commercial: z.boolean(),
  brand_collaboration: z.boolean(),
  license_text: localized,
  source: z.string().min(1),
  rights_confirmed: z.literal(true),
  look_tags: z.array(z.string()).default([]),
  look_name: localized,
  look_description: localized,
  images: z.object({
    identity: z.string(),
    front: z.string(),
    back: z.string(),
    side: z.string().optional(),
    showcase: z.string(),
  }),
});
const inputFile = process.argv[2];
if (!inputFile)
  throw new Error(
    "Usage: npm run import:character -- ./authorized-character.json",
  );
const input = schema.parse(JSON.parse(await readFile(inputFile, "utf8"))),
  lookId = randomUUID();
// Imports never publish automatically. Duplicate character IDs fail without replacing assets.
await query(
  `INSERT INTO characters(id,name,age,gender,personality,background,anchors,tags,license,commercial,brand_collaboration,license_text,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')`,
  [
    input.id,
    JSON.stringify(input.name),
    input.age,
    input.gender,
    JSON.stringify(input.personality),
    JSON.stringify(input.background),
    JSON.stringify(input.anchors),
    JSON.stringify(input.tags),
    input.license,
    input.commercial,
    input.brand_collaboration,
    JSON.stringify(input.license_text),
  ],
);
await query(
  `INSERT INTO looks(id,character_id,name,description,visibility) VALUES($1,$2,$3,$4,'private')`,
  [
    lookId,
    input.id,
    JSON.stringify(input.look_name),
    JSON.stringify(input.look_description),
  ],
);
for (const [role, file] of Object.entries(input.images)) {
  const asset = await createAsset(
    await readFile(path.resolve(path.dirname(inputFile), file)),
    {
      characterId: input.id,
      lookId,
      role,
      metadata: { source: input.source, rights_confirmed: true },
    },
  );
  if (role === "showcase")
    await query(`UPDATE characters SET cover=$2 WHERE id=$1`, [
      input.id,
      `/api/v1/assets/${asset.id}`,
    ]);
}
await query(`UPDATE looks SET search_tags=$2 WHERE id=$1`, [
  lookId,
  JSON.stringify(input.look_tags),
]);
await buildSheet(lookId, undefined);
await query(`UPDATE looks SET state='ready',approved_at=now() WHERE id=$1`, [
  lookId,
]);
const pack = await makePackage(input.id, lookId);
await query(`UPDATE looks SET visibility='pending' WHERE id=$1`, [lookId]);
console.log(
  JSON.stringify(
    {
      character_id: input.id,
      look_id: lookId,
      package_id: pack.id,
      status: "pending_review",
    },
    null,
    2,
  ),
);
process.exit(0);
