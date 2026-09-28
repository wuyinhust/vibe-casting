import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, generateKeyPairSync, createSign } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { query, one, transaction } from "../src/lib/db";
import { holdCredits, settleJob, creditPayment } from "../src/lib/billing";
import { parseIntent, matchesHard, searchCharacters } from "../src/lib/search";
import { authorizeCharacter, packageForUser } from "../src/lib/packages";
import { verifySignature } from "../src/lib/payments";
import { canReadAsset } from "../src/lib/storage";
import { submitGeneration, processGeneration } from "../src/lib/generation";
import { currentUser, hash } from "../src/lib/auth";
process.env.AVIBE_MODE = "demo";
process.env.AVIBE_DATA_DIR = await mkdtemp(
  path.join(tmpdir(), "avibe-core-test-"),
);
delete process.env.OPENAI_API_KEY;
const alice = {
    id: "alice",
    email: "alice@test.invalid",
    role: "creator" as const,
  },
  bob = { id: "bob", email: "bob@test.invalid", role: "creator" as const };
before(async () => {
  for (const u of [alice, bob]) {
    await query(`INSERT INTO users(id,email) VALUES($1,$2)`, [u.id, u.email]);
    await query(`INSERT INTO wallets(user_id,balance) VALUES($1,100)`, [u.id]);
  }
  await query(
    `INSERT INTO characters(id,owner_id,name,age,gender,personality,background,tags,status,license,commercial) VALUES('public','alice','{"zh":"父亲","en":"Father"}',45,'man','{"zh":"严肃","en":"serious"}','{}','["business","father","serious"]','published','commercial',true),('private','bob','{"zh":"隐藏","en":"Hidden"}',45,'man','{}','{}','[]','private','commercial',true)`,
  );
});
test("Chinese and English approximate ages produce equivalent strict bounds", () => {
  assert.deepEqual(
    parseIntent("约45岁，允许商业视频使用"),
    parseIntent("around 45 years old commercial video"),
  );
  assert.deepEqual(parseIntent("40到50岁"), parseIntent("40-50 years"));
});
test("Hard constraints are never overridden by semantic similarity", () => {
  const c = {
    age: 52,
    gender: "man",
    commercial: true,
    license: "commercial",
    tags: ["business"],
    package_count: 1,
  };
  assert.equal(
    matchesHard(c, { min_age: 40, max_age: 50, purpose: "commercial" }),
    false,
  );
  assert.equal(
    matchesHard(
      { ...c, age: 45, commercial: false },
      { min_age: 40, max_age: 50, purpose: "commercial" },
    ),
    false,
  );
  assert.equal(
    matchesHard(
      { ...c, age: 45 },
      { min_age: 40, max_age: 50, purpose: "commercial" },
    ),
    true,
  );
});
test("Private characters are excluded from public search and other owners", async () => {
  const publicResult = await searchCharacters({ q: "father" });
  assert.equal(
    publicResult.items.some((c) => c.id === "private"),
    false,
  );
  const aliceResult = await searchCharacters({ q: "father" }, alice.id);
  assert.equal(
    aliceResult.items.some((c) => c.id === "private"),
    false,
  );
  const ownerResult = await searchCharacters({}, bob.id);
  assert.equal(
    ownerResult.items.some((c) => c.id === "private"),
    true,
  );
});
test("Empty exact result contains an explicit relaxation suggestion", async () => {
  const result = await searchCharacters({ min_age: "90", max_age: "95" });
  assert.equal(result.items.length, 0);
  assert.equal(result.suggestions[0].requires_explicit_change, true);
});
test("Purpose-specific rights block brand use and unlicensed commercial use", async () => {
  const c = await one(`SELECT * FROM characters WHERE id='public'`);
  await authorizeCharacter(c, bob, "personal");
  await authorizeCharacter(c, bob, "commercial");
  await assert.rejects(() => authorizeCharacter(c, bob, "brand"), {
    code: "LICENSE_REQUIRED",
  });
  await assert.rejects(
    () =>
      authorizeCharacter(
        { ...c, license: "noncommercial", commercial: false },
        bob,
        "commercial",
      ),
    { code: "LICENSE_REQUIRED" },
  );
});
test("Private derived looks cannot be read through a public character", async () => {
  await query(
    `INSERT INTO looks(id,character_id,owner_id,name,description) VALUES('private-look','public','alice','{}','{}')`,
  );
  assert.equal(
    await canReadAsset(
      {
        owner_id: "alice",
        character_id: "public",
        look_id: "private-look",
        role: "front",
      },
      bob,
    ),
    false,
  );
});
test("Reservations serialize and cannot overdraw", async () => {
  const reserve = (id: string) =>
    transaction(async (db) => {
      await db.query(
        `INSERT INTO generation_jobs(id,user_id,idempotency_key,kind,input,quote,price_version) VALUES($1,'alice',$1,'views','{}',70,1)`,
        [id],
      );
      await holdCredits(db, "alice", id, 70);
    });
  const results = await Promise.allSettled([reserve("j1"), reserve("j2")]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const wallet = await one(`SELECT * FROM wallets WHERE user_id='alice'`);
  assert.equal(wallet.held, 70);
  assert.equal(wallet.balance, 100);
  const job = await one(`SELECT id FROM generation_jobs WHERE user_id='alice'`);
  await settleJob(job.id, false, "Test failure");
  await settleJob(job.id, false, "Duplicate failure");
  const released = await one(`SELECT * FROM wallets WHERE user_id='alice'`);
  assert.equal(released.held, 0);
  assert.equal(released.balance, 100);
});
test("Successful delivery charges exactly once", async () => {
  await transaction(async (db) => {
    await db.query(
      `INSERT INTO generation_jobs(id,user_id,idempotency_key,kind,input,quote,price_version) VALUES('success','bob','success','views','{}',25,1)`,
    );
    await holdCredits(db, "bob", "success", 25);
  });
  await settleJob("success", true);
  await settleJob("success", true);
  const w = await one(`SELECT * FROM wallets WHERE user_id='bob'`);
  assert.equal(w.balance, 75);
  assert.equal(w.held, 0);
});
test("Duplicate payment callbacks credit the wallet once", async () => {
  await query(
    `INSERT INTO payment_orders(id,user_id,provider,amount_fen,credits) VALUES('order1','bob','wechat',1000,50)`,
  );
  await creditPayment("order1", "wechat", "txn1", 1000);
  await creditPayment("order1", "wechat", "txn1", 1000);
  const wallet = await one(`SELECT * FROM wallets WHERE user_id='bob'`);
  assert.equal(wallet.balance, 125);
  assert.equal(
    (
      await query(
        `SELECT * FROM credit_ledger WHERE event_key='payment:order1'`,
      )
    ).length,
    1,
  );
});
test("Payment amount and provider mismatch never creates credit", async () => {
  await query(
    `INSERT INTO payment_orders(id,user_id,provider,amount_fen,credits) VALUES('order2','bob','alipay',1000,50)`,
  );
  await assert.rejects(() => creditPayment("order2", "alipay", "txn2", 999), {
    code: "PAYMENT_MISMATCH",
  });
  await assert.rejects(() => creditPayment("order2", "wechat", "txn2", 1000), {
    code: "PAYMENT_MISMATCH",
  });
  assert.equal(
    (await one(`SELECT * FROM payment_orders WHERE id='order2'`)).status,
    "pending",
  );
});
test("RSA signatures reject altered payment notification contents", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const body = "verified-order-1000";
  const signature = createSign("RSA-SHA256")
    .update(body)
    .sign(privateKey, "base64");
  const key = publicKey.export({ type: "spki", format: "pem" }).toString();
  assert.equal(verifySignature(body, signature, key), true);
  assert.equal(verifySignature("verified-order-100000", signature, key), false);
});
test("Unconfigured image provider never reserves credits", async () => {
  const before = await one(`SELECT * FROM wallets WHERE user_id='alice'`);
  await assert.rejects(
    () =>
      submitGeneration(alice, {
        kind: "candidates",
        character_id: "public",
        idempotency_key: "no-provider",
      }),
    { code: "GENERATION_NOT_CONFIGURED" },
  );
  const after = await one(`SELECT * FROM wallets WHERE user_id='alice'`);
  assert.deepEqual(after, before);
});
test("Revoked personal tokens cannot authenticate", async () => {
  await query(
    `INSERT INTO api_tokens(id,user_id,token_hash,name) VALUES('token1','alice',$1,'test')`,
    [hash("secret-test-token")],
  );
  const req = new Request("http://localhost:3217/api/v1/characters", {
    headers: { Authorization: "Bearer secret-test-token" },
  });
  assert.equal((await currentUser(req, "read"))?.id, "alice");
  await query(`UPDATE api_tokens SET revoked_at=now() WHERE id='token1'`);
  assert.equal(await currentUser(req, "read"), undefined);
});

import { createRevision, identitySnapshot } from "../src/lib/versions";
import { amountInFen, signedResponseBody } from "../src/lib/payments";
test("Private identity revisions keep the published profile unchanged", async () => {
  const old = await one(`SELECT * FROM characters WHERE id='public'`);
  const revised = await createRevision("public", "alice", {
    ...old,
    name: { zh: "新的父亲设定", en: "Revised Father" },
    age: 48,
  });
  assert.equal(revised.identity_version, 2);
  const publicProfile = await one(`SELECT * FROM characters WHERE id='public'`);
  assert.equal(publicProfile.age, 45);
  assert.equal(publicProfile.name.en, "Father");
  const frozen = await identitySnapshot(publicProfile, 1);
  assert.equal(frozen.age, 45);
  assert.equal((await identitySnapshot(publicProfile, 2)).age, 48);
  await assert.rejects(() => createRevision("public", "bob", old), {
    code: "NOT_FOUND",
  });
});
test("Natural language commercial requirements cannot be weakened by a personal filter", async () => {
  const result = await searchCharacters({
    q: "commercial video around 45 years old",
    purpose: "personal",
  });
  assert.equal(result.parsed_filters.purpose, "commercial");
  assert.ok(result.items.every((c) => c.commercial));
});
test("Conflicting explicit and natural-language gender filters return no match", async () => {
  assert.equal(
    (await searchCharacters({ q: "female", gender: "man" })).items.length,
    0,
  );
});
test("A stale generation quote cannot reserve credits", async () => {
  process.env.OPENAI_API_KEY = "test-not-a-real-key";
  try {
    await query(
      `UPDATE pricing SET active=true,version=2 WHERE kind='candidates'`,
    );
    const initial = await one(`SELECT * FROM wallets WHERE user_id='alice'`);
    await assert.rejects(
      () =>
        submitGeneration(alice, {
          kind: "candidates",
          character_id: "public",
          idempotency_key: "stale-quote-test",
          expected_price_version: 1,
          expected_credits: 8,
        }),
      { code: "QUOTE_CHANGED" },
    );
    assert.deepEqual(
      await one(`SELECT * FROM wallets WHERE user_id='alice'`),
      initial,
    );
  } finally {
    delete process.env.OPENAI_API_KEY;
  }
});
test("Payment decimal conversion and signed JSON preserve exact bytes", () => {
  assert.equal(amountInFen("10.01"), 1001);
  assert.equal(amountInFen("0.5"), 50);
  assert.throws(() => amountInFen("1.001"));
  assert.throws(() => amountInFen("1e3"));
  const object = '{"trade_no":"abc}\\\"", "amount":"10.00"}';
  assert.equal(
    signedResponseBody(
      '{"alipay_trade_query_response":' + object + ',"sign":"abc"}',
      "alipay_trade_query_response",
    ),
    object,
  );
});

import sharp from "sharp";
test("Interrupted generation releases the whole stage and never creates a package", async () => {
  process.env.OPENAI_API_KEY = "test-not-a-real-key";
  process.env.AVIBE_ASSET_DIR = await mkdtemp(
    path.join(tmpdir(), "avibe-test-assets-"),
  );
  try {
    const initial = await one(`SELECT * FROM wallets WHERE user_id='alice'`);
    const job = await submitGeneration(alice, {
      kind: "candidates",
      character_id: "public",
      identity_version: 2,
      idempotency_key: "provider-failure-fixture",
      expected_price_version: 2,
      expected_credits: 8,
    });
    const repeated = await submitGeneration(alice, {
      kind: "candidates",
      character_id: "public",
      identity_version: 2,
      idempotency_key: "provider-failure-fixture",
      expected_price_version: 2,
      expected_credits: 8,
    });
    assert.equal(repeated.id, job.id);
    await assert.rejects(
      () =>
        submitGeneration(alice, {
          kind: "candidates",
          character_id: "public",
          identity_version: 1,
          idempotency_key: "provider-failure-fixture",
          expected_price_version: 2,
          expected_credits: 8,
        }),
      { code: "IDEMPOTENCY_CONFLICT" },
    );
    const png = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#888888" },
    })
      .png()
      .toBuffer();
    let calls = 0;
    const fake = {
      generate: async () => {
        if (++calls === 2) throw new Error("Simulated provider interruption");
        return {
          data: [{ b64_json: png.toString("base64") }],
          usage: { input_tokens: 1 },
        };
      },
    };
    await processGeneration(job.id, fake as any);
    const settled = await one(`SELECT * FROM generation_jobs WHERE id=$1`, [
      job.id,
    ]);
    assert.equal(settled.status, "failed");
    assert.equal(settled.credits_settled, true);
    assert.deepEqual(
      await one(`SELECT * FROM wallets WHERE user_id='alice'`),
      initial,
    );
    const asset = await one(
      `SELECT * FROM assets WHERE metadata->>'job_id'=$1`,
      [job.id],
    );
    assert.ok(asset);
    assert.equal(asset.owner_id, "alice");
    assert.equal(await canReadAsset(asset, bob), false);
    assert.equal(
      (await query(`SELECT * FROM packages WHERE character_id='public'`))
        .length,
      0,
    );
  } finally {
    delete process.env.OPENAI_API_KEY;
  }
});

test("Outfit and complete-package requirements must match the same visible look", () => {
  const c = {
    age: 45,
    gender: "man",
    tags: ["business"],
    package_count: 1,
    search_looks: [
      { tags: ["business"], package_id: null },
      { tags: ["casual"], package_id: "casual-package" },
    ],
  };
  assert.equal(matchesHard(c, { garment: "business", ready: "true" }), false);
  assert.equal(matchesHard(c, { garment: "business" }), true);
});
import { publishIdentity } from "../src/lib/versions";
test("A new identity cannot be published under the old identity showcase", async () => {
  await assert.rejects(
    () => transaction((db) => publishIdentity(db, "public", 2)),
    { code: "SHOWCASE_REQUIRED" },
  );
  assert.equal(
    (await one(`SELECT identity_version FROM characters WHERE id='public'`))
      .identity_version,
    1,
  );
});

import { capabilities, isDemo } from "../src/lib/config";
test("Incomplete merchant configuration and public demo origins fail closed", () => {
  const names = [
    "AVIBE_MODE",
    "APP_ORIGIN",
    "PAYMENTS_ENABLED",
    "WECHAT_PRIVATE_KEY",
    "ALIPAY_PRIVATE_KEY",
  ];
  const saved = Object.fromEntries(names.map((k) => [k, process.env[k]]));
  try {
    process.env.AVIBE_MODE = "live";
    process.env.PAYMENTS_ENABLED = "true";
    delete process.env.WECHAT_PRIVATE_KEY;
    delete process.env.ALIPAY_PRIVATE_KEY;
    assert.equal(capabilities().payments, false);
    assert.deepEqual(capabilities().payment_providers, []);
    process.env.AVIBE_MODE = "demo";
    process.env.APP_ORIGIN = "https://public.invalid";
    assert.throws(() => isDemo(), /loopback/);
  } finally {
    for (const k of names) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});
