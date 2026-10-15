import { portalUnavailable } from "@/lib/availability";

export async function GET() {
  const unavailable = portalUnavailable();
  if (unavailable) return unavailable;
  return (await import("./handler")).GET();
}
