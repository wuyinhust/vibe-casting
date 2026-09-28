import QRCode from "qrcode";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    const value = request.nextUrl.searchParams.get("value") || "";
    if (!value.startsWith("weixin://wxpay/") || value.length > 2048) {
      return new Response("Invalid payment QR value", { status: 400 });
    }
    return new Response(
      await QRCode.toString(value, { type: "svg", width: 280, margin: 2 }),
      {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch {
    return new Response("Sign in required", { status: 401 });
  }
}
