import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  createSessionToken,
  getDeskCredentials,
  verifySessionToken,
} from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isProtected =
    pathname.startsWith("/desk") ||
    pathname.startsWith("/api/attendance") ||
    pathname.startsWith("/api/export");

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/desk", request.url));
  }

  if (isProtected && !session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Soft check that credentials exist in production
  if (pathname === "/login") {
    const { password } = getDeskCredentials();
    if (!password && process.env.NODE_ENV === "production") {
      // still allow page to render; login will fail clearly
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/desk/:path*", "/login", "/api/attendance/:path*", "/api/export"],
};
