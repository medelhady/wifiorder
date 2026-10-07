import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/current-user";

export const maxDuration = 60;

const BUCKET = "wifi-attachments";

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// إسناد طلبات لمستخدم أو حذفها (الأدمن فقط)، لطلب واحد أو لمجموعة
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  const body = await request.json();
  const action = String(body.action ?? "");
  const ids: string[] = Array.isArray(body.ids)
    ? Array.from(new Set<string>(body.ids.map(String)))
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "لم تحدد أي طلب" }, { status: 400 });
  }
  if (ids.length > 1000) {
    return NextResponse.json(
      { error: "الحد الأقصى 1000 طلب في المرة الواحدة" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  if (action === "assign") {
    // An empty name takes the requests back from whoever had them.
    const username = String(body.username ?? "").trim().toLowerCase();

    if (username) {
      const { data: person } = await supabase
        .from("app_users")
        .select("username")
        .eq("username", username)
        .eq("active", true)
        .maybeSingle();
      if (!person) {
        return NextResponse.json({ error: "المستخدم غير موجود أو موقوف" }, { status: 400 });
      }
    }

    let count = 0;
    for (const part of chunks(ids, 100)) {
      const { data, error } = await supabase
        .from("wifi_requests")
        .update({
          assigned_to: username || null,
          updated_at: new Date().toISOString(),
        })
        .in("id", part)
        .select("id, status");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      count += data?.length ?? 0;

      await supabase.from("wifi_request_history").insert(
        (data ?? []).map((row) => ({
          request_id: row.id,
          status: row.status,
          note: username
            ? `إسناد الطلب إلى ${username} (بواسطة ${user.username})`
            : `إلغاء إسناد الطلب (بواسطة ${user.username})`,
        }))
      );
    }

    return NextResponse.json({ ok: true, count });
  }

  if (action === "delete") {
    let count = 0;

    for (const part of chunks(ids, 100)) {
      const { data: rows, error } = await supabase
        .from("wifi_requests")
        .select("id, attachments")
        .in("id", part);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!rows || rows.length === 0) continue;

      // The modems these requests were holding go back to the stock.
      await supabase
        .from("modem_codes")
        .update({
          used_by_request: null,
          used_request_number: null,
          used_by_user: null,
          used_at: null,
        })
        .in("used_by_request", rows.map((row) => row.id));

      // Their files go too.
      const paths: string[] = [];
      for (const row of rows) {
        for (const item of (row.attachments ?? []) as { path?: string }[]) {
          if (item?.path) paths.push(item.path);
        }
      }
      if (paths.length > 0) {
        await supabase.storage.from(BUCKET).remove(paths);
      }

      const { error: deleteError } = await supabase
        .from("wifi_requests")
        .delete()
        .in("id", rows.map((row) => row.id));

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
      count += rows.length;
    }

    return NextResponse.json({ ok: true, count });
  }

  return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
}
