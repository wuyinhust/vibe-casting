import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { zipSync } from "fflate";
export const runtime = "nodejs";
export async function GET() {
  const root = path.join(process.cwd(), "open-source/avibe-casting"),
    files: Record<string, Uint8Array> = {};
  async function walk(dir: string) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "__pycache__") continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile())
        files[
          `avibe-casting/${path.relative(root, p).split(path.sep).join("/")}`
        ] = await readFile(p);
    }
  }
  await walk(root);
  return new Response(new Uint8Array(zipSync(files, { level: 0 })), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="avibe-casting.zip"',
    },
  });
}
