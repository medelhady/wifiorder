import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getSupabase } from "@/lib/supabase";
import { countModems, fetchModems } from "@/lib/modems";

export const maxDuration = 60;

// المودمات: الأدمن يرى الكل (المستعمل وغير المستعمل)، والمستخدم يرى غير المستعمل وعدد المتبقي فقط
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مسجّل" }, { status: 401 });
  }

  const all = new URL(request.url).searchParams.get("all") === "1";

  try {
    if (all) {
      if (user.role !== "admin") {
        return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
      }
      const modems = await fetchModems("all");

      // The balance of each person: how many modems are theirs, used and left.
      const byOwner = new Map<string, { owner: string | null; total: number; used: number }>();
      for (const m of modems) {
        const key = m.owner ?? "";
        const row = byOwner.get(key) ?? { owner: m.owner, total: 0, used: 0 };
        row.total += 1;
        if (m.used_by_request) row.used += 1;
        byOwner.set(key, row);
      }
      const owners = Array.from(byOwner.values()).map((row) => ({
        ...row,
        remaining: row.total - row.used,
      }));

      return NextResponse.json({ ...(await countModems()), owners, modems });
    }

    // Unused modems: everything for the admin, only the person's own (and the shared ones) for a user.
    const unused = await fetchModems(
      "unused",
      user.role === "admin" ? undefined : user.username
    );
    const modems = unused.map((m) => ({
      seq: m.seq,
      code: m.code,
      prod_id: m.prod_id,
      sn: m.sn,
      mac: m.mac,
      owner: m.owner,
    }));

    if (user.role === "admin") {
      return NextResponse.json({ ...(await countModems()), modems });
    }
    return NextResponse.json({ remaining: modems.length, modems });
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// إضافة قائمة مودمات (الأدمن فقط). المكرر يُتجاهل، والجديد يأخذ رقمًا تسلسليًا بالترتيب.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  const body = await request.json();

  // Whose modems these are: a user, or nobody in particular (shared by everyone).
  const owner = String(body.owner ?? "").trim().toLowerCase() || null;
  if (owner) {
    const { data: person } = await getSupabase()
      .from("app_users")
      .select("username")
      .eq("username", owner)
      .maybeSingle();
    if (!person) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 400 });
    }
  }

  type Incoming = { code?: unknown; prod_id?: unknown; sn?: unknown; mac?: unknown };
  const incoming: Incoming[] = Array.isArray(body.items)
    ? body.items
    : (Array.isArray(body.codes)
        ? body.codes.map(String)
        : String(body.codes ?? "").split(/[\n\r]+/)
      ).map((code: string) => ({ code }));

  const text = (value: unknown) => String(value ?? "").trim();
  const seen = new Set<string>();
  const items: { code: string; prod_id: string; sn: string; mac: string }[] = [];

  for (const item of incoming) {
    const prod_id = text(item.prod_id);
    const sn = text(item.sn);
    const mac = text(item.mac);
    // The serial number is what identifies a modem; the other columns are the fallback.
    const code = text(item.code) || sn || prod_id || mac;

    if (
      code &&
      code.length <= 80 &&
      prod_id.length <= 80 &&
      sn.length <= 80 &&
      mac.length <= 80 &&
      !seen.has(code)
    ) {
      seen.add(code);
      items.push({ code, prod_id, sn, mac });
    }
  }
  const codes = items.map((item) => item.code);

  if (codes.length === 0) {
    return NextResponse.json({ error: "لا توجد أكواد للإضافة" }, { status: 400 });
  }
  if (codes.length > 10000) {
    return NextResponse.json(
      { error: "الحد الأقصى 10000 كود في المرة الواحدة" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  // Existing ones are skipped before inserting, so the numbering has no holes.
  const existing = new Set<string>();
  for (let i = 0; i < codes.length; i += 80) {
    const chunk = codes.slice(i, i + 80);
    const { data, error } = await supabase
      .from("modem_codes")
      .select("code")
      .in("code", chunk);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    (data ?? []).forEach((row) => existing.add(row.code as string));
  }

  const fresh = items.filter((item) => !existing.has(item.code));

  for (let i = 0; i < fresh.length; i += 500) {
    const { error } = await supabase
      .from("modem_codes")
      .insert(
        fresh.slice(i, i + 500).map((item) => ({
          code: item.code,
          prod_id: item.prod_id || null,
          sn: item.sn || null,
          mac: item.mac || null,
          owner,
        }))
      );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    added: fresh.length,
    skipped: codes.length - fresh.length,
  });
}

// حذف مودم غير مستعمل (الأدمن فقط)
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

  const { data, error } = await getSupabase()
    .from("modem_codes")
    .delete()
    .eq("code", code)
    .is("used_by_request", null)
    .select("code");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "لا يمكن حذف مودم مستعمل في طلب" },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
