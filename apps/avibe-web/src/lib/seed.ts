import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { query, one } from "./db";
import { isDemo } from "./config";
import { createAsset } from "./storage";
import { makePackage } from "./packages";
import cast from "../../data/demo-characters.json";
let seeding: Promise<void> | undefined;
export function ensureSeed() {
  if (!isDemo()) return Promise.resolve();
  return (seeding ??= (async () => {
    for (const [index, c] of cast.entries()) {
      const { id, name, age, gender, personality, background, tags } = c;
      const zh = name.zh;
      const en = name.en;
      const pz = personality.zh;
      const pe = personality.en;
      const bz = background.zh;
      const be = background.en;
      await query(
        `INSERT INTO characters(id,name,age,gender,personality,background,tags,cover,sprite_index,license,commercial,brand_collaboration,status,demo,license_text,anchors) VALUES($1,$2,$3,$4,$5,$6,$7,'/images/cast-editorial.png',$8,$9,$10,true,'published',true,$11,$12) ON CONFLICT(id) DO NOTHING`,
        [
          id,
          JSON.stringify(name),
          age,
          gender,
          JSON.stringify(personality),
          JSON.stringify(background),
          JSON.stringify(tags),
          index,
          index === 1
            ? "negotiation"
            : index === 2
              ? "noncommercial"
              : "commercial",
          index !== 2,
          JSON.stringify({
            zh: "原创演示素材，仅用于本地产品评估。正式商用授权须另行确认。",
            en: "Original demonstration assets for local evaluation. No commercial license is granted by demo metadata.",
          }),
          JSON.stringify({
            zh: `保持${zh}的脸型、年龄感、发型和身体比例。`,
            en: `Preserve ${en}'s facial structure, apparent age, hair and proportions.`,
          }),
        ],
      );
      await query(
        `INSERT INTO looks(id,character_id,name,description,state,visibility) VALUES($1,$2,$3,$4,'draft','published') ON CONFLICT(id) DO NOTHING`,
        [
          `${id}-signature`,
          id,
          JSON.stringify({ zh: "标志造型", en: "Signature look" }),
          JSON.stringify({
            zh: "标志服装与造型",
            en: "Signature clothing and styling",
          }),
        ],
      );
    }
    for (const id of ["chen-yu", "su-ning"])
      await query(`UPDATE looks SET search_tags='["business"]' WHERE id=$1`, [
        `${id}-signature`,
      ]);
    // A complete original reference package is provided for one character; others are clearly marked showcase-only.
    const l = await one(`SELECT state FROM looks WHERE id='lin-yue-signature'`);
    if (l.state !== "ready") {
      const card = await readFile(
        path.join(process.cwd(), "assets/demo/lin-yue-card.png"),
      );
      const m = await sharp(card).metadata();
      const bounds = [0, 0.287, 0.533, 0.778, 1];
      const roles = ["identity", "front", "back", "side"];
      for (let i = 0; i < 4; i++) {
        if (
          await one(
            `SELECT 1 FROM assets WHERE look_id='lin-yue-signature' AND role=$1`,
            [roles[i]],
          )
        )
          continue;
        const left = Math.round(bounds[i] * m.width!),
          right = Math.round(bounds[i + 1] * m.width!);
        const buf = await sharp(card)
          .extract({ left, top: 0, width: right - left, height: m.height! })
          .png()
          .toBuffer();
        await createAsset(buf, {
          characterId: "lin-yue",
          lookId: "lin-yue-signature",
          role: roles[i],
          metadata: { source: "Original AI-generated demo reference card" },
        });
      }
      if (
        !(await one(
          `SELECT 1 FROM assets WHERE look_id='lin-yue-signature' AND role='sheet'`,
        ))
      )
        await createAsset(card, {
          characterId: "lin-yue",
          lookId: "lin-yue-signature",
          role: "sheet",
        });
      await query(
        `UPDATE looks SET state='ready',approved_at=now() WHERE id='lin-yue-signature'`,
      );
      await makePackage("lin-yue", "lin-yue-signature");
    }
    for (const [kind, credits] of [
      ["candidates", 8],
      ["views", 24],
      ["showcase", 8],
      ["tryon", 10],
      ["complete-look", 18],
      ["redo", 8],
    ])
      await query(
        `INSERT INTO pricing(kind,credits,active) VALUES($1,$2,true) ON CONFLICT(kind) DO UPDATE SET active=true`,
        [kind, credits],
      );
  })().catch((e) => {
    seeding = undefined;
    throw e;
  }));
}
