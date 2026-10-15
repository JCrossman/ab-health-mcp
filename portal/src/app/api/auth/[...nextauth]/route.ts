import { portalUnavailable } from "@/lib/availability";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const unavailable = portalUnavailable();
  if (unavailable) return unavailable;
  return (await import("@/lib/auth")).handlers.GET(req);
}

export async function POST(req: NextRequest) {
  const unavailable = portalUnavailable();
  if (unavailable) return unavailable;
  return (await import("@/lib/auth")).handlers.POST(req);
}
