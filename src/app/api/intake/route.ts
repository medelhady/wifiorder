import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabase } from "@/lib/supabase";
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

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

// استقبال طلب جديد من بوت واتساب
export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const form = await request.formData();

  const customer_name = text(form, "customer_name");
  const national_id = text(form, "national_id");
  const phone = text(form, "phone");
  const phone2 = text(form, "phone2");
  const code1 = text(form, "code1");
  const code2 = text(form, "code2");
  const region = text(form, "region");
  const whatsapp_number = digits(text(form, "whatsapp_number"));

  const missing = [
    !customer_name && "الاسم",
    !national_id && "الرقم الوطني",
    !phone && "رقم الهاتف",
    !code1 && "الكود الأول",
    !code2 && "الكود الثاني",
    !region && "المنطقة",
  ].filter(Boolean);

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `بيانات ناقصة: ${missing.join("، ")}` },
      { status: 400 }
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
    const ext =
      f.type === "application/pdf"
        ? "pdf"
        : f.type.split("/")[1]?.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "jpg";
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
      // The beneficiary number of a WhatsApp request is the customer's WhatsApp number.
      beneficiary_number: whatsapp_number || null,
      national_id,
      phone,
      phone2: phone2 || null,
      code1,
      code2,
      region,
      whatsapp_number: whatsapp_number || null,
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

  const params = new URL(request.url).searchParams;

  // طلب واحد برقمه، مع روابط مؤقتة لمرفقاته: GET /api/intake?number=10
  if (params.has("number")) {
    const number = Number(params.get("number"));
    if (!Number.isInteger(number) || number <= 0) {
      return NextResponse.json({ error: "رقم الطلب غير صحيح" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("wifi_requests")
      .select(
        "request_number, status, customer_name, national_id, phone, phone2, code1, code2, region, attachments"
      )
      .eq("request_number", number)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ request: null });
    }

    const attachments = await Promise.all(
      ((data.attachments ?? []) as StoredAttachment[]).map(async (a) => {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(a.path, 3600);
        return { type: a.type, name: a.name, url: signed?.signedUrl ?? null };
      })
    );

    return NextResponse.json({ request: { ...data, attachments } });
  }

  const phone = digits(params.get("phone") ?? "");
  if (!phone) {
    return NextResponse.json({ error: "phone مطلوب" }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("wifi_requests")
    .select("request_number, status, created_at")
    .eq("whatsapp_number", phone)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ requests: data ?? [] });
}
