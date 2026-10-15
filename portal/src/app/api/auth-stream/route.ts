import { portalUnavailable } from "@/lib/availability";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const unavailable = portalUnavailable();
  if (unavailable) return unavailable;
  return (await import("./handler")).GET(req);
}

export async function POST(req: Request) {
  const unavailable = portalUnavailable();
  if (unavailable) return unavailable;
  return (await import("./handler")).POST(req);
}
