import { portalUnavailable } from "@/lib/availability";

export const maxDuration = 60;

export async function POST(req: Request) {
  const unavailable = portalUnavailable();
  if (unavailable) return unavailable;
  return (await import("./handler")).POST(req);
}
