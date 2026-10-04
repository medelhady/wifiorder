import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabase } from "@/lib/supabase";
import { MOUGHATAAS } from "@/lib/moughataas";
import { safeEqual } from "@/lib/password";

const BUCKET = "wifi-attachments";
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const REQUIRED_FILES = [
  { field: "id_card", label: "بطاقة التعريف" },
  { field: "mauritel_copy", label: "صورة من داية موريتل" },
];

type StoredAttachment = { type: string; name: string; path: string };

function authorized(request: Request): boolean {
  const key = process.env.INTAKE_API_KEY;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return !!key && !!token && safeEqual(token, key);
}

function digits(v: string): string {
  return v.replace(/\D/g, "");
}

// استقبال طلب جديد من بوت واتساب
export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const form = await request.formData();

  const customer_name = String(form.get("customer_name") ?? "").trim();
  const beneficiary_number = String(form.get("beneficiary_number") ?? "").trim();
  const whatsapp_number = digits(String(form.get("whatsapp_number") ?? ""));
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
    return NextResponse.json({ error: "مقاطعة غير صحيحة" }, { status: 400 });
  }

  for (const r of REQUIRED_FILES) {
    const f = form.get(r.field);
    if (!(f instanceof File) || f.size === 0) {
      return NextResponse.json(
        { error: `مرفق "${r.label}" مطلوب` },
        { status: 400 }
      );
    }
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `مرفق "${r.label}" كبير جدًا` },
        { status: 400 }
      );
    }
    if (!f.type.startsWith("image/") && f.type !== "application/pdf") {
      return NextResponse.json(
        { error: `مرفق "${r.label}" يجب أن يكون صورة أو PDF` },
        { status: 400 }
      );
    }
  }

  const id = randomUUID();
  const attachments: StoredAttachment[] = [];

  for (const r of REQUIRED_FILES) {
    const f = form.get(r.field) as File;
    const ext = f.type === "application/pdf" ? "pdf" : f.type.split("/")[1]?.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "jpg";
    const name = f.name && f.name !== "blob" ? f.name : `${r.field}.${ext}`;
    const path = `${id}/${r.field}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, f, { contentType: f.type || undefined });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    attachments.push({ type: r.field, name, path });
  }

  const { data, error } = await supabase
    .from("wifi_requests")
    .insert({
      id,
      customer_name,
      beneficiary_number,
      phone: whatsapp_number || null,
      moughataa,
      region: region || null,
      notes: notes || null,
      attachments,
      source: "whatsapp",
    })
    .select("request_number")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("wifi_request_history").insert({
    request_id: id,
    status: "new",
    note: "تم إنشاء الطلب عبر واتساب",
  });

  return NextResponse.json({ ok: true, request_number: data.request_number });
}

// استعلام العميل عن حالة طلباته برقم الواتساب: GET /api/intake?phone=222XXXXXXXX
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const phone = digits(new URL(request.url).searchParams.get("phone") ?? "");
  if (!phone) {
    return NextResponse.json({ error: "phone مطلوب" }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("wifi_requests")
    .select("request_number, status, created_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ requests: data ?? [] });
}
