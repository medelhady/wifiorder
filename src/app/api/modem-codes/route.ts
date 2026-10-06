import { NextResponse } from "next/server";
import { getCurrentUser, listModemCodes } from "@/lib/current-user";
import { getSupabase } from "@/lib/supabase";

// قائمة أكواد المودم: القراءة لأي مستخدم مسجّل، والإضافة والحذف للأدمن فقط
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مسجّل" }, { status: 401 });
  }
  return NextResponse.json({ codes: await listModemCodes() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  const body = await request.json();
  const codes = Array.from(
    new Set(
      String(body.codes ?? "")
        .split(/[\n,،;]+/)
        .map((c) => c.trim())
        .filter((c) => c.length > 0 && c.length <= 60)
    )
  );

  if (codes.length === 0) {
    return NextResponse.json({ error: "لا توجد أكواد للإضافة" }, { status: 400 });
  }
  if (codes.length > 5000) {
    return NextResponse.json({ error: "الحد الأقصى 5000 كود في المرة" }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from("modem_codes")
    .upsert(
      codes.map((code) => ({ code })),
      { onConflict: "code", ignoreDuplicates: true }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, received: codes.length });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  const body = await request.json();
  const code = String(body.code ?? "");
  if (!code) {
    return NextResponse.json({ error: "الكود مطلوب" }, { status: 400 });
  }

  const { error } = await getSupabase().from("modem_codes").delete().eq("code", code);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
