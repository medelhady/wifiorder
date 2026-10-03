import { cookies } from "next/headers";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { MOUGHATAAS } from "@/lib/moughataas";

export type CurrentUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  restricted: boolean;
  moughataas: string[];
  can_add: boolean;
  can_edit: boolean;
  can_change_status: boolean;
  can_add_note: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const session = await verifySessionToken(store.get(COOKIE_NAME)?.value);
  if (!session) return null;

  if (session.role === "admin") {
    return {
      id: "admin",
      username: "admin",
      role: "admin",
      restricted: false,
      moughataas: [...MOUGHATAAS],
      can_add: true,
      can_edit: true,
      can_change_status: true,
      can_add_note: true,
    };
  }

  const { data } = await getSupabase()
    .from("app_users")
    .select("*")
    .eq("id", session.u)
    .maybeSingle();

  if (!data || !data.active) return null;

  const list: string[] = data.moughataas ?? [];
  const restricted = list.length > 0;

  return {
    id: data.id,
    username: data.username,
    role: "user",
    restricted,
    moughataas: restricted ? list : [...MOUGHATAAS],
    can_add: !!data.can_add,
    can_edit: !!data.can_edit,
    can_change_status: !!data.can_change_status,
    can_add_note: !!data.can_add_note,
  };
}
