import { PgBoss } from "pg-boss";
import { required, isDemo } from "../src/lib/config";
import { query, one } from "../src/lib/db";
import { processGeneration } from "../src/lib/generation";
import { settleJob } from "../src/lib/billing";
import { reconcilePayment } from "../src/lib/payments";
if (isDemo())
  throw new Error(
    "Local demo executes jobs in Next.js after(). Use AVIBE_MODE=live for the dedicated PostgreSQL worker.",
  );
const boss = new PgBoss({ connectionString: required("DATABASE_URL") });
boss.on("error", (e) => console.error("Queue error:", e.message));
await boss.start();
await boss.createQueue("avibe-generate");
await boss.work<{ jobId: string }>(
  "avibe-generate",
  { batchSize: 1 },
  async (jobs) => {
    for (const job of jobs) await processGeneration(job.data.jobId);
  },
);
let stopping = false;
async function dispatch() {
  // Durable outbox: a crash after enqueue is safe because the application job claims
  // queued -> running atomically, and the wallet settles once independently of queue delivery.
  const jobs = await query(
    `SELECT id FROM generation_jobs WHERE status='queued' AND NOT queue_dispatched ORDER BY created_at LIMIT 20`,
  );
  for (const j of jobs) {
    await boss.send(
      "avibe-generate",
      { jobId: j.id },
      { singletonKey: j.id, retryLimit: 0, expireInSeconds: 1800 },
    );
    await query(
      `UPDATE generation_jobs SET queue_dispatched=true WHERE id=$1`,
      [j.id],
    );
  }
  // A provider request with unknown outcome is never automatically reissued.
  const stale = await query(
    `SELECT id FROM generation_jobs WHERE ((status='running' AND updated_at<now()-interval '30 minutes') OR (status='queued' AND created_at<now()-interval '2 hours')) AND NOT credits_settled`,
  );
  for (const j of stale)
    await settleJob(
      j.id,
      false,
      "Worker interrupted. Credits released; any partial files remain private.",
    );
  const payments = await query(
    `SELECT * FROM payment_orders WHERE status='pending' AND created_at>now()-interval '24 hours' AND created_at<now()-interval '2 minutes' LIMIT 20`,
  );
  for (const o of payments)
    try {
      await reconcilePayment(o);
    } catch {
      console.warn("Payment reconciliation deferred for order", o.id);
    }
}
async function loop() {
  while (!stopping) {
    try {
      await dispatch();
    } catch (e) {
      console.error(
        "Dispatch error:",
        e instanceof Error ? e.message : "Unknown",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
process.on("SIGTERM", async () => {
  stopping = true;
  await boss.stop();
  process.exit(0);
});
process.on("SIGINT", async () => {
  stopping = true;
  await boss.stop();
  process.exit(0);
});
console.log("avibe generation worker ready");
await loop();
