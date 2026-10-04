import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/intake")
  ) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith("/api/");
  const session = await verifySessionToken(
    request.cookies.get(COOKIE_NAME)?.value
  );

  if (!session) {
    if (isApi) {
      return NextResponse.json({ error: "غير مسجّل" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const adminOnly =
    pathname.startsWith("/users") || pathname.startsWith("/api/users");
  if (adminOnly && session.role !== "admin") {
    if (isApi) {
      return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
