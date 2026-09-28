import { randomUUID } from "node:crypto";
import { DB, one, query, transaction } from "./db";
import { assert } from "./errors";
export async function holdCredits(
  db: DB,
  userId: string,
  jobId: string,
  amount: number,
) {
  const wallet = (
    await db.query(
      `UPDATE wallets SET held=held+$2 WHERE user_id=$1 AND balance-held>=$2 RETURNING *`,
      [userId, amount],
    )
  ).rows[0];
  assert(
    wallet,
    402,
    "INSUFFICIENT_CREDITS",
    "Not enough credits / 可用积分不足",
  );
  await db.query(
    `INSERT INTO credit_ledger(id,user_id,event_key,kind,amount,description) VALUES($1,$2,$3,'hold',$4,'Generation credits reserved')`,
    [randomUUID(), userId, `hold:${jobId}`, amount],
  );
}
export async function settleJob(
  jobId: string,
  success: boolean,
  error?: string,
) {
  return transaction(async (db) => {
    const j = (
      await db.query(`SELECT * FROM generation_jobs WHERE id=$1 FOR UPDATE`, [
        jobId,
      ])
    ).rows[0];
    assert(j, 404, "NOT_FOUND", "Job not found");
    if (j.credits_settled) return j;
    await db.query(
      `UPDATE wallets SET held=held-$2,balance=balance-$3 WHERE user_id=$1`,
      [j.user_id, j.quote, success ? j.quote : 0],
    );
    await db.query(
      `INSERT INTO credit_ledger(id,user_id,event_key,kind,amount,description) VALUES($1,$2,$3,$4,$5,$6)`,
      [
        randomUUID(),
        j.user_id,
        `settle:${jobId}`,
        success ? "spend" : "release",
        success ? -j.quote : j.quote,
        success
          ? "Generation delivered"
          : "Generation failed; reservation released",
      ],
    );
    return (
      await db.query(
        `UPDATE generation_jobs SET credits_settled=true,status=$2,error=$3,updated_at=now() WHERE id=$1 RETURNING *`,
        [jobId, success ? "review" : "failed", error || null],
      )
    ).rows[0];
  });
}
export async function creditPayment(
  orderId: string,
  provider: string,
  transactionId: string,
  amountFen: number,
) {
  return transaction(async (db) => {
    const o = (
      await db.query(`SELECT * FROM payment_orders WHERE id=$1 FOR UPDATE`, [
        orderId,
      ])
    ).rows[0];
    assert(
      o && o.provider === provider && o.amount_fen === amountFen,
      400,
      "PAYMENT_MISMATCH",
      "Payment details do not match the order",
    );
    if (o.status === "paid") {
      assert(
        o.provider_transaction === `${provider}:${transactionId}`,
        400,
        "PAYMENT_MISMATCH",
        "Transaction mismatch",
      );
      return o;
    }
    assert(
      o.status === "pending",
      409,
      "ORDER_STATE",
      "Order cannot be credited",
    );
    await db.query(
      `UPDATE payment_orders SET status='paid',provider_transaction=$2,paid_at=now() WHERE id=$1`,
      [orderId, `${provider}:${transactionId}`],
    );
    await db.query(
      `INSERT INTO wallets(user_id,balance) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET balance=wallets.balance+EXCLUDED.balance`,
      [o.user_id, o.credits],
    );
    await db.query(
      `INSERT INTO credit_ledger(id,user_id,event_key,kind,amount,description) VALUES($1,$2,$3,'topup',$4,'Verified payment')`,
      [randomUUID(), o.user_id, `payment:${orderId}`, o.credits],
    );
    return o;
  });
}
