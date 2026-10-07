import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/current-user";

const STATUSES = ["new", "review", "in_progress", "done", "rejected"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مسجّل" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("wifi_requests")
    .select("notes")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  // 0) إضافة ملاحظة
  if (body.add_note !== undefined) {
    if (!user.can_add_note) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية إضافة ملاحظة" },
        { status: 403 }
      );
    }

    const text = String(body.add_note).trim();
    if (!text) {
      return NextResponse.json({ error: "اكتب الملاحظة" }, { status: 400 });
    }

    const date = new Date().toISOString().slice(0, 10);
    const line = `${user.username} (${date}): ${text}`;
    const notes = existing.notes ? `${existing.notes}\n${line}` : line;

    const { data: cur, error } = await supabase
      .from("wifi_requests")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("status")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("wifi_request_history").insert({
      request_id: id,
      status: cur.status,
      note: `إضافة ملاحظة بواسطة ${user.username}`,
    });

    return NextResponse.json({ ok: true });
  }

  // 1) تغيير الحالة
  if (body.status !== undefined) {
    if (!user.can_change_status) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية تغيير الحالة" },
        { status: 403 }
      );
    }

    const status = String(body.status);
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: "حالة غير صحيحة" }, { status: 400 });
    }

    const { error } = await supabase
      .from("wifi_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("wifi_request_history").insert({
      request_id: id,
      status,
      note: `تغيير الحالة بواسطة ${user.username}`,
    });

    return NextResponse.json({ ok: true });
  }

  // 2) تعديل معلومات الطلب
  if (!user.can_edit) {
    return NextResponse.json(
      { error: "ليس لديك صلاحية التعديل" },
      { status: 403 }
    );
  }

  const customer_name = String(body.customer_name ?? "").trim();
  const beneficiary_number = String(body.beneficiary_number ?? "").trim();
  const national_id = String(body.national_id ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const phone2 = String(body.phone2 ?? "").trim();
  const code1 = String(body.code1 ?? "").trim();
  const code2 = String(body.code2 ?? "").trim();
  const region = String(body.region ?? "").trim();
  const notes = String(body.notes ?? "").trim();

  if (!customer_name) {
    return NextResponse.json({ error: "اسم العميل مطلوب" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("wifi_requests")
    .update({
      customer_name,
      beneficiary_number: beneficiary_number || null,
      national_id: national_id || null,
      phone: phone || null,
      phone2: phone2 || null,
      code1: code1 || null,
      code2: code2 || null,
      region: region || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("wifi_request_history").insert({
    request_id: id,
    status: data.status,
    note: `تم تعديل معلومات الطلب بواسطة ${user.username}`,
  });

  return NextResponse.json({ ok: true });
}
