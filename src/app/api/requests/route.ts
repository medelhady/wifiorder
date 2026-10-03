import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/current-user";
import { MOUGHATAAS } from "@/lib/moughataas";

const BUCKET = "wifi-attachments";

const REQUIRED_FILES = [
  { field: "id_card", label: "بطاقة التعريف" },
  { field: "mauritel_copy", label: "صورة من داية موريتل" },
];

type StoredAttachment = { type: string; name: string; path: string };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مسجّل" }, { status: 401 });
  }

  const supabase = getSupabase();
  let query = supabase
    .from("wifi_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (user.restricted) {
    query = query.in("moughataa", user.moughataas);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const requests = await Promise.all(
    (data ?? []).map(async (r) => {
      const files = await Promise.all(
        (r.attachments ?? []).map(async (a: StoredAttachment) => {
          const { data: signed } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(a.path, 3600);
          return {
            type: a.type ?? "other",
            name: a.name,
            url: signed?.signedUrl ?? null,
          };
        })
      );
      return { ...r, attachments: files };
    })
  );

  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مسجّل" }, { status: 401 });
  }
  if (!user.can_add) {
    return NextResponse.json(
      { error: "ليس لديك صلاحية إضافة طلبات" },
      { status: 403 }
    );
  }

  const supabase = getSupabase();
  const form = await request.formData();

  const customer_name = String(form.get("customer_name") ?? "").trim();
  const beneficiary_number = String(form.get("beneficiary_number") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const moughataa = String(form.get("moughataa") ?? "").trim();
  const region = String(form.get("region") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim();

  if (!customer_name || !beneficiary_number) {
    return NextResponse.json(
      { error: "اسم العميل ورقم المستفيد مطلوبان" },
      { status: 400 }
    );
  }

  if (!MOUGHATAAS.includes(moughataa)) {
    return NextResponse.json({ error: "اختر المقاطعة" }, { status: 400 });
  }
  if (!user.moughataas.includes(moughataa)) {
    return NextResponse.json(
      { error: "ليس لديك صلاحية على هذه المقاطعة" },
      { status: 403 }
    );
  }

  for (const r of REQUIRED_FILES) {
    const f = form.get(r.field);
    if (!(f instanceof File) || f.size === 0) {
      return NextResponse.json(
        { error: `مرفق "${r.label}" مطلوب` },
        { status: 400 }
      );
    }
  }

  const id = randomUUID();
  const attachments: StoredAttachment[] = [];

  for (const r of REQUIRED_FILES) {
    const f = form.get(r.field) as File;
    const ext = f.name.includes(".")
      ? f.name.split(".").pop()!.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)
      : "bin";
    const path = `${id}/${r.field}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, f, { contentType: f.type || undefined });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    attachments.push({ type: r.field, name: f.name, path });
  }

  const { error } = await supabase.from("wifi_requests").insert({
    id,
    customer_name,
    beneficiary_number,
    phone: phone || null,
    moughataa,
    region: region || null,
    notes: notes || null,
    attachments,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("wifi_request_history").insert({
    request_id: id,
    status: "new",
    note: `تم إنشاء الطلب بواسطة ${user.username}`,
  });

  return NextResponse.json({ ok: true, id });
}
