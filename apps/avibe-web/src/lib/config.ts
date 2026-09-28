export const appOrigin = () =>
  process.env.APP_ORIGIN || "http://localhost:3217";
export function isDemo() {
  const demo =
    process.env.AVIBE_MODE === "demo" ||
    (!process.env.AVIBE_MODE && process.env.NODE_ENV !== "production");
  if (
    demo &&
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(appOrigin()).hostname)
  )
    throw new Error("Demo mode requires a loopback APP_ORIGIN");
  return demo;
}
export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing configuration: ${name}`);
  return value;
}
export function capabilities() {
  const demo = isDemo(),
    has = (names: string[]) => names.every((n) => !!process.env[n]);
  const providers: string[] = [];
  if (!demo && process.env.PAYMENTS_ENABLED === "true") {
    if (
      has([
        "WECHAT_APP_ID",
        "WECHAT_MERCHANT_ID",
        "WECHAT_SERIAL_NO",
        "WECHAT_PRIVATE_KEY",
        "WECHAT_PLATFORM_PUBLIC_KEY",
        "WECHAT_PLATFORM_SERIAL",
        "WECHAT_API_V3_KEY",
      ])
    )
      providers.push("wechat");
    if (has(["ALIPAY_APP_ID", "ALIPAY_PRIVATE_KEY", "ALIPAY_PUBLIC_KEY"]))
      providers.push("alipay");
  }
  return {
    demo,
    generation: !!process.env.OPENAI_API_KEY,
    auth:
      !demo &&
      has([
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
      ]),
    payments: providers.length > 0,
    payment_providers: providers,
    realtime:
      !demo &&
      has(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]),
  };
}
