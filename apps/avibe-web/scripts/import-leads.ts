import { readFile } from "node:fs/promises";
import { importTalentLeads } from "../src/lib/talent-leads";
const filename = process.argv[2];
if (!filename)
  throw new Error("Usage: npm run import:leads -- path/to/source.json");
console.log(
  JSON.stringify(
    await importTalentLeads(JSON.parse(await readFile(filename, "utf8"))),
    null,
    2,
  ),
);
process.exit(0);
