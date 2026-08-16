import { supabase } from "@/integrations/supabase/client";
import { userHasRole } from "@/lib/userRoles";

/**
 * Explicit authentication + permission check for every admin action-layer
 * mutation, independent of the LLM and independent of RLS. RLS remains the
 * real security backstop, but callers (manual UI and Copilot alike) should
 * fail fast with a clear message rather than surface a raw Postgres error.
 */
export async function requireAdmin(): Promise<{ userId: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { userId: null, error: "Not authenticated." };

  const { hasRole, error } = await userHasRole(user.id, "admin");
  if (error) return { userId: null, error };
  if (!hasRole) return { userId: null, error: "Forbidden — admin role required." };

  return { userId: user.id, error: null };
}
