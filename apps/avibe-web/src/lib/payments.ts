import {
  createSign,
  createVerify,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { appOrigin, required, isDemo } from "./config";
import { assert } from "./errors";
import { creditPayment } from "./billing";
import { Row } from "./db";
const pem = (name: string) => required(name).replace(/\\n/g, "\n");
function sign(data: string, key: string) {
  return createSign("RSA-SHA256").update(data).sign(key, "base64");
}
export function verifySignature(data: string, sig: string, key: string) {
  return createVerify("RSA-SHA256").update(data).verify(key, sig, "base64");
}
async function wechatRequest(method: string, path: string, body?: Row) {
  const timestamp = String(Math.floor(Date.now() / 1000)),
    nonce = randomBytes(16).toString("hex"),
    payload = body ? JSON.stringify(body) : "";
  const signature = sign(
    `${method}\n${path}\n${timestamp}\n${nonce}\n${payload}\n`,
    pem("WECHAT_PRIVATE_KEY"),
  );
  const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${required("WECHAT_MERCHANT_ID")}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${required("WECHAT_SERIAL_NO")}",signature="${signature}"`;
  const r = await fetch(`https://api.mch.weixin.qq.com${path}`, {
    method,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? payload : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const raw = await r.text();
  assert(r.ok, 502, "PAYMENT_PROVIDER", "Payment provider rejected request");
  assert(
    r.headers.get("wechatpay-serial") === required("WECHAT_PLATFORM_SERIAL"),
    502,
    "PAYMENT_CERTIFICATE",
    "Unexpected payment certificate",
  );
  assert(
    verifySignature(
      `${r.headers.get("wechatpay-timestamp")}\n${r.headers.get("wechatpay-nonce")}\n${raw}\n`,
      r.headers.get("wechatpay-signature") || "",
      pem("WECHAT_PLATFORM_PUBLIC_KEY"),
    ),
    502,
    "PAYMENT_SIGNATURE",
    "Invalid payment response signature",
  );
  return JSON.parse(raw);
}
function alipayParams(method: string, biz: Row) {
  const params: Record<string, string> = {
    app_id: required("ALIPAY_APP_ID"),
    method,
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: new Date(Date.now() + 8 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " "),
    version: "1.0",
    notify_url: `${appOrigin()}/api/v1/billing/webhooks/alipay`,
    biz_content: JSON.stringify(biz),
  };
  const canonical = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  params.sign = sign(canonical, pem("ALIPAY_PRIVATE_KEY"));
  return params;
}
export async function createCheckout(order: Row) {
  assert(
    !isDemo() && process.env.PAYMENTS_ENABLED === "true",
    503,
    "PAYMENTS_DISABLED",
    "Payments are not configured",
  );
  if (order.provider === "wechat") {
    const r = await wechatRequest("POST", "/v3/pay/transactions/native", {
      appid: required("WECHAT_APP_ID"),
      mchid: required("WECHAT_MERCHANT_ID"),
      description: `avibe ${order.credits} credits`,
      out_trade_no: order.id,
      notify_url: `${appOrigin()}/api/v1/billing/webhooks/wechat`,
      amount: { total: order.amount_fen, currency: "CNY" },
    });
    return { type: "qr", url: r.code_url };
  }
  return {
    type: "redirect",
    url: `${process.env.ALIPAY_GATEWAY || "https://openapi.alipay.com/gateway.do"}?${new URLSearchParams(alipayParams("alipay.trade.page.pay", { out_trade_no: order.id, product_code: "FAST_INSTANT_TRADE_PAY", total_amount: (order.amount_fen / 100).toFixed(2), subject: `avibe ${order.credits} credits` }))}`,
  };
}
export async function wechatWebhook(req: Request) {
  const raw = await req.text(),
    time = req.headers.get("wechatpay-timestamp") || "",
    nonce = req.headers.get("wechatpay-nonce") || "",
    signature = req.headers.get("wechatpay-signature") || "";
  assert(
    Math.abs(Date.now() / 1000 - Number(time)) < 300,
    400,
    "STALE_PAYMENT",
    "Payment signature expired",
  );
  assert(
    req.headers.get("wechatpay-serial") === required("WECHAT_PLATFORM_SERIAL"),
    400,
    "PAYMENT_CERTIFICATE",
    "Unexpected certificate",
  );
  assert(
    verifySignature(
      `${time}\n${nonce}\n${raw}\n`,
      signature,
      pem("WECHAT_PLATFORM_PUBLIC_KEY"),
    ),
    400,
    "PAYMENT_SIGNATURE",
    "Invalid signature",
  );
  const event = JSON.parse(raw),
    r = event.resource;
  assert(
    r?.algorithm === "AEAD_AES_256_GCM",
    400,
    "PAYMENT_PAYLOAD",
    "Invalid encryption",
  );
  const ciphertext = Buffer.from(r.ciphertext, "base64"),
    decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(required("WECHAT_API_V3_KEY")),
      Buffer.from(r.nonce),
    );
  decipher.setAuthTag(ciphertext.subarray(-16));
  decipher.setAAD(Buffer.from(r.associated_data || ""));
  const payload = JSON.parse(
    Buffer.concat([
      decipher.update(ciphertext.subarray(0, -16)),
      decipher.final(),
    ]).toString(),
  );
  assert(
    payload.mchid === required("WECHAT_MERCHANT_ID") &&
      payload.appid === required("WECHAT_APP_ID") &&
      payload.amount?.currency === "CNY",
    400,
    "PAYMENT_MERCHANT",
    "Merchant mismatch",
  );
  if (payload.trade_state === "SUCCESS")
    await creditPayment(
      payload.out_trade_no,
      "wechat",
      payload.transaction_id,
      payload.amount.total,
    );
  return new Response(null, { status: 204 });
}
export async function alipayWebhook(req: Request) {
  const form = new URLSearchParams(await req.text());
  const params = Object.fromEntries(form);
  const data = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  assert(
    verifySignature(data, params.sign || "", pem("ALIPAY_PUBLIC_KEY")),
    400,
    "PAYMENT_SIGNATURE",
    "Invalid signature",
  );
  assert(
    params.app_id === required("ALIPAY_APP_ID"),
    400,
    "PAYMENT_MERCHANT",
    "Application mismatch",
  );
  if (["TRADE_SUCCESS", "TRADE_FINISHED"].includes(params.trade_status))
    await creditPayment(
      params.out_trade_no,
      "alipay",
      params.trade_no,
      amountInFen(params.total_amount),
    );
  return new Response("success");
}
export async function reconcileWechat(order: Row) {
  const r = await wechatRequest(
    "GET",
    `/v3/pay/transactions/out-trade-no/${encodeURIComponent(order.id)}?mchid=${encodeURIComponent(required("WECHAT_MERCHANT_ID"))}`,
  );
  assert(
    r.mchid === required("WECHAT_MERCHANT_ID") &&
      r.appid === required("WECHAT_APP_ID") &&
      r.amount?.currency === "CNY",
    502,
    "PAYMENT_MERCHANT",
    "Payment query merchant mismatch",
  );
  if (r.trade_state === "SUCCESS")
    await creditPayment(order.id, "wechat", r.transaction_id, r.amount.total);
  return r.trade_state;
}

export function amountInFen(value: string): number {
  assert(
    /^\d{1,10}(\.\d{1,2})?$/.test(value),
    400,
    "PAYMENT_AMOUNT",
    "Invalid payment amount",
  );
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
// Alipay signs the original JSON response object bytes, not reserialized JSON.
export function signedResponseBody(raw: string, key: string): string {
  const marker = JSON.stringify(key);
  const start = raw.indexOf("{", raw.indexOf(marker) + marker.length);
  assert(
    raw.includes(marker) && start >= 0,
    502,
    "PAYMENT_RESPONSE",
    "Missing signed response",
  );
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return raw.slice(start, i + 1);
  }
  throw new Error("Incomplete payment response");
}
export async function reconcileAlipay(order: Row) {
  const response = await fetch(
    process.env.ALIPAY_GATEWAY || "https://openapi.alipay.com/gateway.do",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(
        alipayParams("alipay.trade.query", { out_trade_no: order.id }),
      ),
      signal: AbortSignal.timeout(15000),
    },
  );
  const raw = await response.text();
  assert(response.ok, 502, "PAYMENT_PROVIDER", "Payment query failed");
  const envelope = JSON.parse(raw),
    body = signedResponseBody(raw, "alipay_trade_query_response");
  assert(
    verifySignature(body, envelope.sign || "", pem("ALIPAY_PUBLIC_KEY")),
    502,
    "PAYMENT_SIGNATURE",
    "Invalid payment query signature",
  );
  const data = JSON.parse(body);
  if (
    data.code === "10000" &&
    ["TRADE_SUCCESS", "TRADE_FINISHED"].includes(data.trade_status)
  ) {
    assert(
      data.out_trade_no === order.id,
      502,
      "PAYMENT_ORDER",
      "Payment order mismatch",
    );
    await creditPayment(
      order.id,
      "alipay",
      data.trade_no,
      amountInFen(data.total_amount),
    );
  }
  return data.trade_status || data.sub_code;
}
export const reconcilePayment = (order: Row) =>
  order.provider === "wechat" ? reconcileWechat(order) : reconcileAlipay(order);
