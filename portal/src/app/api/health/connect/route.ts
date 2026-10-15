import { portalUnavailable } from "@/lib/availability";

export async function POST() {
  const unavailable = portalUnavailable();
  if (unavailable) return unavailable;
  return (await import("./handler")).POST();
}
