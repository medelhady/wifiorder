import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getSupabase } from "@/lib/supabase";
import { hashUserPassword } from "@/lib/password";
import { MOUGHATAAS } from "@/lib/moughataas";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user && user.role === "admin" ? user : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const update: Record<string, unknown> = {};

  if (body.moughataas !== undefined) {
    const list: string[] = Array.isArray(body.moughataas)
      ? body.moughataas.map(String)
      : [];
    if (!list.every((m) => MOUGHATAAS.includes(m))) {
      return NextResponse.json({ error: "مقاطعة غير صحيحة" }, { status: 400 });
    }
    update.moughataas = list;
  }
  if (body.can_add !== undefined) update.can_add = !!body.can_add;
  if (body.can_edit !== undefined) update.can_edit = !!body.can_edit;
  if (body.can_change_status !== undefined)
    update.can_change_status = !!body.can_change_status;
  if (body.can_add_note !== undefined) update.can_add_note = !!body.can_add_note;
  if (body.active !== undefined) update.active = !!body.active;

  if (body.password) {
    const password = String(body.password);
    if (password.length < 6) {
      return NextResponse.json(
        { error: "كلمة السر 6 أحرف على الأقل" },
        { status: 400 }
      );
    }
    update.password_hash = hashUserPassword(password);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "لا يوجد تغيير" }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from("app_users")
    .update(update)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  const { id } = await params;
  const { error } = await getSupabase().from("app_users").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
