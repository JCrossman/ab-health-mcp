/**
 * Retired shared-profile sign-in path. It must not become reachable merely
 * because the portal availability flag is enabled for a future deployment.
 */
export async function POST() {
  return Response.json({
    connected: false,
    error: "connection_flow_retired",
    message: "This web sign-in method is unavailable. Use the desktop extension.",
  }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
