import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/current-user";
import { ownerFilter } from "@/lib/modems";

// اختيار مودم لطلب (ينقص الرصيد) أو إرجاعه (يعود للرصيد)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مسجّل" }, { status: 401 });
  }
  if (!user.can_edit) {
    return NextResponse.json(
      { error: "ليس لديك صلاحية التعديل" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json();
  const code = String(body.code ?? "").trim();
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("wifi_requests")
    .select("modem_code, request_number, status")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  const previous: string | null = existing.modem_code ?? null;

  if (code && code === previous) {
    return NextResponse.json({ ok: true });
  }

  // Claim the new modem first. Only an unused one can be taken, so two people can never get the same.
  if (code) {
    let claimQuery = supabase
      .from("modem_codes")
      .update({
        used_by_request: id,
        used_request_number: existing.request_number,
        used_by_user: user.username,
        used_at: new Date().toISOString(),
      })
      .eq("code", code)
      .is("used_by_request", null);
    // An ordinary user may only take a modem that is theirs or shared.
    if (user.role !== "admin") {
      claimQuery = claimQuery.or(ownerFilter(user.username));
    }
    const { data: claimed, error } = await claimQuery.select("code");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!claimed || claimed.length === 0) {
      return NextResponse.json(
        { error: "هذا المودم مستعمل أو غير متاح لك. اختر مودمًا آخر." },
        { status: 409 }
      );
    }
  }

  const { error: updateError } = await supabase
    .from("wifi_requests")
    .update({ modem_code: code || null, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    if (code) {
      await supabase
        .from("modem_codes")
        .update({
          used_by_request: null,
          used_request_number: null,
          used_by_user: null,
          used_at: null,
        })
        .eq("code", code)
        .eq("used_by_request", id);
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // The modem this request had before goes back to the stock.
  if (previous) {
    await supabase
      .from("modem_codes")
      .update({
        used_by_request: null,
        used_request_number: null,
        used_by_user: null,
        used_at: null,
      })
      .eq("code", previous)
      .eq("used_by_request", id);
  }

  await supabase.from("wifi_request_history").insert({
    request_id: id,
    status: existing.status,
    note: code
      ? `اختيار المودم ${code} بواسطة ${user.username}`
      : `إرجاع المودم ${previous ?? ""} بواسطة ${user.username}`,
  });

  return NextResponse.json({ ok: true });
}
