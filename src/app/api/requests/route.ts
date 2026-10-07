import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/current-user";
import { ownerFilter } from "@/lib/modems";

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

  // A user sees only the requests assigned to them; the admin sees everything.
  if (user.role !== "admin") {
    query = query.eq("assigned_to", user.username);
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
  if (user.role !== "admin") {
    return NextResponse.json(
      { error: "إضافة الطلبات للأدمن فقط" },
      { status: 403 }
    );
  }

  const supabase = getSupabase();
  const form = await request.formData();

  const customer_name = String(form.get("customer_name") ?? "").trim();
  const beneficiary_number = String(form.get("beneficiary_number") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const phone2 = String(form.get("phone2") ?? "").trim();
  const national_id = String(form.get("national_id") ?? "").trim();
  const code1 = String(form.get("code1") ?? "").trim();
  const code2 = String(form.get("code2") ?? "").trim();
  const modem_code = String(form.get("modem_code") ?? "").trim();
  const assigned_to = String(form.get("assigned_to") ?? "").trim().toLowerCase();
  const region = String(form.get("region") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim();

  if (!customer_name || !beneficiary_number) {
    return NextResponse.json(
      { error: "اسم العميل ورقم المستفيد مطلوبان" },
      { status: 400 }
    );
  }

  if (assigned_to) {
    const { data: person } = await supabase
      .from("app_users")
      .select("username")
      .eq("username", assigned_to)
      .eq("active", true)
      .maybeSingle();
    if (!person) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 400 });
    }
  }

  // A modem may be chosen right away; it has to be one that is still unused.
  if (modem_code) {
    let freeQuery = supabase
      .from("modem_codes")
      .select("code")
      .eq("code", modem_code)
      .is("used_by_request", null);
    if (user.role !== "admin") {
      freeQuery = freeQuery.or(ownerFilter(user.username));
    }
    const { data: free } = await freeQuery.maybeSingle();
    if (!free) {
      return NextResponse.json(
        { error: "هذا المودم مستعمل أو غير موجود. اختر مودمًا آخر." },
        { status: 409 }
      );
    }
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

  const { data: inserted, error } = await supabase.from("wifi_requests").insert({
    id,
    customer_name,
    beneficiary_number,
    phone: phone || null,
    phone2: phone2 || null,
    national_id: national_id || null,
    code1: code1 || null,
    code2: code2 || null,
    modem_code: modem_code || null,
    assigned_to: assigned_to || null,
    region: region || null,
    notes: notes || null,
    attachments,
  }).select("request_number").single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let modemNote = "";
  if (modem_code) {
    let claimQuery = supabase
      .from("modem_codes")
      .update({
        used_by_request: id,
        used_request_number: inserted?.request_number ?? null,
        used_by_user: user.username,
        used_at: new Date().toISOString(),
      })
      .eq("code", modem_code)
      .is("used_by_request", null);
    if (user.role !== "admin") {
      claimQuery = claimQuery.or(ownerFilter(user.username));
    }
    const { data: claimed } = await claimQuery.select("code");

    if (!claimed || claimed.length === 0) {
      // Someone took it in the meantime: the request is kept, without a modem.
      await supabase.from("wifi_requests").update({ modem_code: null }).eq("id", id);
      modemNote = " (المودم استُعمل قبل الحفظ، اختر مودمًا للطلب)";
    }
  }

  await supabase.from("wifi_request_history").insert({
    request_id: id,
    status: "new",
    note: `تم إنشاء الطلب بواسطة ${user.username}${modemNote}`,
  });

  return NextResponse.json({ ok: true, id, warning: modemNote || undefined });
}
