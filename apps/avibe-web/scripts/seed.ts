import { ensureSeed } from "../src/lib/seed";
import { isDemo } from "../src/lib/config";
if (!isDemo()) throw new Error("Demo seed must never be loaded into live mode");
await ensureSeed();
console.log(
  "Seeded 8 original demo showcases and one complete character package.",
);
process.exit(0);
