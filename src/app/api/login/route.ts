import { NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_MAX_AGE, createSessionToken } from "@/lib/auth";
import { safeEqual, verifyUserPassword } from "@/lib/password";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  const fail = () =>
    NextResponse.redirect(new URL("/login?error=1", request.url), 303);

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || !password) return fail();

  let token: string | null = null;

  if (username === "" || username === "admin") {
    if (safeEqual(password, adminPassword)) {
      token = await createSessionToken("admin", "admin");
    }
  } else {
    const { data } = await getSupabase()
      .from("app_users")
      .select("id, password_hash, active")
      .eq("username", username)
      .maybeSingle();

    if (data && data.active && verifyUserPassword(password, data.password_hash)) {
      token = await createSessionToken(data.id, "user");
    }
  }

  if (!token) return fail();

  const res = NextResponse.redirect(new URL("/", request.url), 303);
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
