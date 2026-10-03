import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getSupabase } from "@/lib/supabase";
import { hashUserPassword } from "@/lib/password";
import { MOUGHATAAS } from "@/lib/moughataas";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user && user.role === "admin" ? user : null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  const { data, error } = await getSupabase()
    .from("app_users")
    .select(
      "id, username, moughataas, can_add, can_edit, can_change_status, can_add_note, active, created_at"
    )
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ users: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  const body = await request.json();
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const moughataas: string[] = Array.isArray(body.moughataas)
    ? body.moughataas.map(String)
    : [];

  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    return NextResponse.json(
      { error: "اسم المستخدم: حروف إنجليزية صغيرة وأرقام فقط (3 إلى 30)" },
      { status: 400 }
    );
  }
  if (username === "admin") {
    return NextResponse.json(
      { error: "هذا الاسم محجوز للأدمن" },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "كلمة السر 6 أحرف على الأقل" },
      { status: 400 }
    );
  }
  if (!moughataas.every((m) => MOUGHATAAS.includes(m))) {
    return NextResponse.json({ error: "مقاطعة غير صحيحة" }, { status: 400 });
  }

  const { error } = await getSupabase().from("app_users").insert({
    username,
    password_hash: hashUserPassword(password),
    moughataas,
    can_add: !!body.can_add,
    can_edit: !!body.can_edit,
    can_change_status: !!body.can_change_status,
    can_add_note: !!body.can_add_note,
    active: true,
  });

  if (error) {
    const msg =
      error.code === "23505" ? "اسم المستخدم موجود مسبقًا" : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
