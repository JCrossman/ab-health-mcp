/** Server-only deployment decision. Never use a NEXT_PUBLIC flag for access control. */
export function isPortalEnabled(): boolean {
  return process.env.PORTAL_DEPLOY_ENABLED === "true";
}

export function portalUnavailable(): Response | null {
  if (isPortalEnabled()) return null;
  return Response.json(
    { error: "portal_unavailable", message: "Web chat is unavailable. The desktop download is still available." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
