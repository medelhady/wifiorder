import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/current-user";

const BUCKET = "wifi-attachments";

// A serverless request body is capped at about 4.5MB, so a bigger file would be cut off before it
// reaches this code. The page shrinks photos first; this is the guard for anything that gets past it.
const MAX_BYTES = 4 * 1024 * 1024;

type StoredAttachment = { type: string; name: string; path: string };

/** Adds one picture or PDF to a request. The admin can on any request, a user on theirs. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مسجّل" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("wifi_requests")
    .select("attachments, assigned_to, status")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }
  if (user.role !== "admin" && existing.assigned_to !== user.username) {
    return NextResponse.json({ error: "هذا الطلب غير مسند إليك" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "تعذّر قراءة الملف" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "اختر ملفًا" }, { status: 400 });
  }
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    return NextResponse.json({ error: "المسموح: صور أو PDF فقط" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "الملف أكبر من 4 ميجابايت. صغّره ثم أعد المحاولة." },
      { status: 413 }
    );
  }

  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin"
    : file.type === "application/pdf"
      ? "pdf"
      : "jpg";
  const path = `${id}/extra-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const attachments = [
    ...((existing.attachments ?? []) as StoredAttachment[]),
    { type: "other", name: file.name, path },
  ];

  const { error } = await supabase
    .from("wifi_requests")
    .update({ attachments, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    // The file is useless without its row.
    await supabase.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("wifi_request_history").insert({
    request_id: id,
    status: existing.status,
    note: `إضافة مرفق (${file.name}) بواسطة ${user.username}`,
  });

  return NextResponse.json({ ok: true });
}
