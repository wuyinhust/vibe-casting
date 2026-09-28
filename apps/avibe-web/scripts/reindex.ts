import OpenAI from "openai";
import { query } from "../src/lib/db";
import { required } from "../src/lib/config";
const ai = new OpenAI({ apiKey: required("OPENAI_API_KEY") });
const rows = await query(
  `SELECT * FROM characters WHERE status='published' AND embedding IS NULL`,
);
for (const c of rows) {
  const response = await ai.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    input: JSON.stringify([c.name, c.personality, c.background, c.tags]),
  });
  await query(`UPDATE characters SET embedding=$2 WHERE id=$1`, [
    c.id,
    JSON.stringify(response.data[0].embedding),
  ]);
  console.log("Indexed", c.id);
}
process.exit(0);
