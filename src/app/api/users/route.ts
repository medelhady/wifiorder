import { NextResponse } from "next/server";
import { getCurrentUser, listModemCodes } from "@/lib/current-user";
import { getSupabase } from "@/lib/supabase";
import { hashUserPassword } from "@/lib/password";

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
  // The restriction list is stored in the "moughataas" column and holds modem codes.
  const users = (data ?? []).map(({ moughataas, ...rest }) => ({
    ...rest,
    modem_codes: moughataas ?? [],
  }));
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  const body = await request.json();
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const modemCodes: string[] = Array.isArray(body.modem_codes)
    ? body.modem_codes.map(String)
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
  const known = await listModemCodes();
  if (!modemCodes.every((c) => known.includes(c))) {
    return NextResponse.json({ error: "كود مودم غير صحيح" }, { status: 400 });
  }

  const { error } = await getSupabase().from("app_users").insert({
    username,
    password_hash: hashUserPassword(password),
    moughataas: modemCodes,
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
