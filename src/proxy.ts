import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  const { pathname } = request.nextUrl;
  const isAdminRole =
    session.role === "admin" ||
    session.role === "super_admin" ||
    session.role === "org_admin";

  // Public routes
  if (pathname === "/" || pathname === "/login") {
    if (session.isLoggedIn) {
      const redirectUrl = isAdminRole ? "/admin" : "/learn";
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    return response;
  }

  // Protected routes
  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Admin routes
  if (pathname.startsWith("/admin") && !isAdminRole) {
    return NextResponse.redirect(new URL("/learn", request.url));
  }

  // Learner routes
  if (pathname.startsWith("/learn") && isAdminRole) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/learn/:path*"],
};
