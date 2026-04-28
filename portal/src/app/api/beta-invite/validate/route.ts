import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function POST(req: NextRequest) {
  const secret = process.env.BETA_INVITE_SECRET;
  if (!secret) {
    return NextResponse.json({ valid: false }, { status: 503 });
  }

  let token: string | undefined;
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token : undefined;
  } catch {
    return NextResponse.json({ valid: false, error: "Invalid request body." }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ valid: false, error: "Token is required." }, { status: 400 });
  }

  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) {
    return NextResponse.json({ valid: false });
  }

  const payload = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);

  const expectedSig = createHmac("sha256", secret).update(payload).digest("hex");

  // Constant-time comparison to prevent timing attacks
  const sigBuf = Buffer.from(sig, "hex");
  const expectedBuf = Buffer.from(expectedSig, "hex");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return NextResponse.json({ valid: false });
  }

  let parsed: { email?: string; issuedAt?: number; channel?: string };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return NextResponse.json({ valid: false });
  }

  if (parsed.channel !== "portal-beta" || typeof parsed.email !== "string" || typeof parsed.issuedAt !== "number") {
    return NextResponse.json({ valid: false });
  }

  const expiresAt = parsed.issuedAt + INVITE_TTL_MS;
  if (Date.now() > expiresAt) {
    return NextResponse.json({ valid: false, error: "Invite link has expired." });
  }

  return NextResponse.json({ valid: true, expiresAt });
}
