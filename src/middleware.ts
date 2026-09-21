import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  getDeskCredentials,
  verifySessionToken,
} from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isDeskProtected =
    pathname.startsWith("/desk") ||
    pathname.startsWith("/api/attendance") ||
    pathname.startsWith("/api/export") ||
    pathname.startsWith("/api/import") ||
    pathname.startsWith("/api/session");

  const isAdminProtected =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (pathname === "/login" && session) {
    const home = session.role === "admin" ? "/admin" : "/desk";
    return NextResponse.redirect(new URL(home, request.url));
  }

  if ((isDeskProtected || isAdminProtected) && !session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminProtected && session && session.role !== "admin") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/desk", request.url));
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
  matcher: [
    "/desk/:path*",
    "/admin/:path*",
    "/login",
    "/api/attendance/:path*",
    "/api/export",
    "/api/import/:path*",
    "/api/admin/:path*",
    "/api/session/:path*",
  ],
};
