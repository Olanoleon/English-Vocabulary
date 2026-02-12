import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  const { pathname } = request.nextUrl;

  // Public routes
  if (pathname === "/" || pathname === "/login") {
    if (session.isLoggedIn) {
      const redirectUrl = session.role === "admin" ? "/admin" : "/learn";
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    return response;
  }

  // Protected routes
  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Admin routes
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/learn", request.url));
  }

  // Learner routes
  if (pathname.startsWith("/learn") && session.role !== "learner") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/learn/:path*"],
};
