import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware: static page rewrites + CSRF protection on API routes.
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

  // CSRF protection: validate Origin header on mutation API requests
  if (pathname.startsWith("/api/") && request.method !== "GET") {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return new NextResponse("Forbidden — cross-origin request", { status: 403 });
        }
      } catch {
        return new NextResponse("Forbidden — invalid origin", { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/terms", "/demo", "/api/:path*"],
};
