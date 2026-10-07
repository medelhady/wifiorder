import { getSupabase } from "@/lib/supabase";

export type ModemRow = {
  seq: number;
  code: string;
  prod_id: string | null;
  sn: string | null;
  mac: string | null;
  owner: string | null;
  used_by_request: string | null;
  used_request_number: number | null;
  used_by_user: string | null;
  used_at: string | null;
};

const PAGE = 1000;

// Supabase returns at most 1000 rows per request, so a long list is read page by page.
// A username is only ever letters, digits and . _ - (enforced when the user is created); checked again
// here because it ends up inside a filter string.
const SAFE_NAME = /^[a-z0-9._-]+$/;

/** The filter that limits a query to modems a person may use: their own, or the shared ones. */
export function ownerFilter(username: string) {
  if (!SAFE_NAME.test(username)) {
    throw new Error("اسم مستخدم غير صالح");
  }
  return `owner.is.null,owner.eq.${username}`;
}

export async function fetchModems(
  filter: "all" | "unused",
  // Set for an ordinary user: only that person's modems and the shared ones are read.
  viewer?: string
): Promise<ModemRow[]> {
  const supabase = getSupabase();
  const rows: ModemRow[] = [];

  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from("modem_codes")
      .select("seq, code, prod_id, sn, mac, owner, used_by_request, used_request_number, used_by_user, used_at")
      .order("seq", { ascending: true })
      .range(from, from + PAGE - 1);

    if (filter === "unused") {
      query = query.is("used_by_request", null);
    }
    if (viewer) {
      query = query.or(ownerFilter(viewer));
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    rows.push(...((data ?? []) as ModemRow[]));
    if (!data || data.length < PAGE) break;
  }

  return rows;
}

export async function countModems(): Promise<{ total: number; used: number; remaining: number }> {
  const supabase = getSupabase();

  const total = await supabase
    .from("modem_codes")
    .select("code", { count: "exact", head: true });
  const remaining = await supabase
    .from("modem_codes")
    .select("code", { count: "exact", head: true })
    .is("used_by_request", null);

  const all = total.count ?? 0;
  const left = remaining.count ?? 0;

  return { total: all, used: all - left, remaining: left };
}
