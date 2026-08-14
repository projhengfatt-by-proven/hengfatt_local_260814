import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export async function getUserRoles(userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  return {
    roles: ((data ?? []) as Array<{ role: AppRole }>).map((row) => row.role),
    error: error?.message ?? null,
  };
}

export async function userHasRole(userId: string, role: AppRole) {
  const { roles, error } = await getUserRoles(userId);
  return {
    hasRole: roles.includes(role),
    error,
  };
}
