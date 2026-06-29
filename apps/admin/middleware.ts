import { NextResponse, type NextRequest } from "next/server";

/**
 * App-level auth gate. Vercel Authentication / Deployment Protection only covers
 * the production domain on Pro+; on this plan it can't gate the production
 * `*.vercel.app` URL — which would otherwise expose the whole pipeline (the data
 * is server-rendered with a service-role key). So we gate at the app with HTTP
 * Basic auth over HTTPS: one shared credential, no login page, browser-native
 * prompt. Set ADMIN_PASSWORD (+ optional ADMIN_USER) as Vercel env vars.
 *
 * Runs on the Edge runtime — use atob, not Buffer.
 */
export const config = {
  // protect everything except Next's static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export function middleware(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  // Not configured (e.g. local dev) → don't lock the operator out.
  if (!password) return NextResponse.next();

  const user = process.env.ADMIN_USER || "revivo";
  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const i = decoded.indexOf(":");
      if (decoded.slice(0, i) === user && decoded.slice(i + 1) === password) {
        return NextResponse.next();
      }
    } catch {
      /* malformed header → fall through to challenge */
    }
  }
  return new NextResponse("Authenticatie vereist", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Revivo Operator", charset="UTF-8"' },
  });
}
