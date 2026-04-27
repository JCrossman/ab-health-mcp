import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware: rewrite static page routes to serve the original HTML files.
 *
 * The landing page, terms, and demo are the original myaihealth.ca HTML —
 * served pixel-perfect from public/. All other routes (/chat, /welcome,
 * /login, /api/*, etc.) pass through to Next.js React pages and API routes.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Serve static HTML pages at their clean URLs
  const staticPages: Record<string, string> = {
    "/": "/landing.html",
    "/terms": "/terms.html",
    "/demo": "/demo.html",
  };

  const rewriteTo = staticPages[pathname];
  if (rewriteTo) {
    return NextResponse.rewrite(new URL(rewriteTo, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/terms", "/demo"],
};
