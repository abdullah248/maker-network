import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/messages", "/onboarding", "/requests"];

/**
 * Cheap cookie presence check so signed-out visitors get bounced to /signin
 * before a page render. Real authorization always happens again server-side in
 * the service layer — this is a UX optimisation, not a security boundary.
 */
function hasSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        (cookie.name === "authjs.session-token" ||
          cookie.name === "__Secure-authjs.session-token") &&
        cookie.value.length > 0,
    );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected || hasSessionCookie(request)) {
    return NextResponse.next();
  }

  const signInUrl = new URL("/signin", request.url);
  signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/messages/:path*", "/onboarding/:path*", "/requests/:path*"],
};
