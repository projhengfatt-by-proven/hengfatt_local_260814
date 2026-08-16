import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { requireAdmin } from "@/components/admin/adminGuards";

type AdminLogChanges = Json | null;

export async function logAdminActivity(
  action: string,
  targetType: string,
  targetId: string,
  targetName: string | null,
  changes: AdminLogChanges
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("admin_activity_log").insert({
    admin_id: user.id,
    action,
    target_type: targetType,
    target_id: targetId,
    target_name: targetName,
    changes,
  });
}

export async function setAgentVisibility(
  agentId: string,
  updates: { is_published?: boolean; is_featured?: boolean }
) {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data: agentInfo } = await supabase
    .from("agent_profiles")
    .select("profiles(full_name, email)")
    .eq("id", agentId)
    .maybeSingle();

  if (updates.is_featured === true) {
    const { data: agent } = await supabase
      .from("agent_profiles")
      .select("agent_type")
      .eq("id", agentId)
      .maybeSingle();

    if (agent?.agent_type !== "internal") {
      return { error: "Only internal agents can be featured on the homepage." };
    }
  }

  const { error } = await supabase
    .from("agent_profiles")
    .update(updates)
    .eq("id", agentId);

  if (!error) {
    await logAdminActivity(
      "Agent visibility updated",
      "agent",
      agentId,
      agentInfo?.profiles?.full_name ?? agentInfo?.profiles?.email ?? null,
      updates as Json
    );
  }

  return { error: error?.message ?? null };
}

export async function setAgentActive(agentId: string, isActive: boolean) {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data: agentInfo } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", agentId)
    .maybeSingle();

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", agentId);

  if (!error) {
    await logAdminActivity(
      `Agent ${isActive ? "reactivated" : "deactivated"}`,
      "agent",
      agentId,
      agentInfo?.full_name ?? agentInfo?.email ?? null,
      { is_active: isActive } as Json
    );
  }

  return { error: error?.message ?? null };
}

export type NewAgentInput = {
  full_name: string;
  email: string;
  phone: string;
  preferred_lang: "en" | "zh";
  cea_no: string | null;
  years_experience: number | null;
  agent_type: "internal" | "external";
  position: string | null;
  specialisations: string[];
  languages: string[];
  linkedin_url: string | null;
  display_order: number;
  bio_en: string | null;
  bio_zh: string | null;
};

export async function createAgent(input: NewAgentInput) {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data, error } = await supabase.functions.invoke("send-agent-invite", { body: input });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error as string };

  await logAdminActivity(
    "Agent invited",
    "agent",
    data?.agent_id ?? input.email,
    input.full_name,
    input as unknown as Json
  );

  return { error: null, data };
}

export async function resendAgentInvite(email: string) {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data, error } = await supabase.functions.invoke("resend-agent-invite", {
    body: { email },
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error as string };

  await logAdminActivity(
    "Agent invite resent",
    "agent",
    email,
    email,
    { email, method: data?.method ?? null } as Json
  );

  return { error: null, data };
}

export async function setListingStatus(listingId: string, status: "active" | "draft") {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data: listingInfo } = await supabase
    .from("properties")
    .select("title, title_zh, property_name, slug")
    .eq("id", listingId)
    .maybeSingle();

  const { error } = await supabase.from("properties").update({ status }).eq("id", listingId);

  if (!error) {
    await logAdminActivity(
      `Listing ${status === "active" ? "published" : "taken down"}`,
      "listing",
      listingId,
      listingInfo?.property_name ?? listingInfo?.title ?? listingInfo?.slug ?? null,
      { status } as Json
    );
  }

  return { error: error?.message ?? null };
}

export async function setListingFeatured(listingId: string, value: boolean) {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data: listingInfo } = await supabase
    .from("properties")
    .select("title, title_zh, property_name, slug")
    .eq("id", listingId)
    .maybeSingle();

  const { error } = await supabase.from("properties").update({ is_featured: value }).eq("id", listingId);

  if (!error) {
    await logAdminActivity(
      `Listing ${value ? "featured" : "unfeatured"}`,
      "listing",
      listingId,
      listingInfo?.property_name ?? listingInfo?.title ?? listingInfo?.slug ?? null,
      { is_featured: value } as Json
    );
  }

  return { error: error?.message ?? null };
}

export async function reviewApplication(
  applicationId: string,
  status: "pending" | "reviewing" | "interview" | "approved" | "declined",
  adminNotes?: string
) {
  const { userId, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data: applicationInfo } = await supabase
    .from("agent_applications")
    .select("full_name, email")
    .eq("id", applicationId)
    .maybeSingle();

  const { error } = await supabase
    .from("agent_applications")
    .update({
      status,
      admin_notes: adminNotes || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
    })
    .eq("id", applicationId);

  if (!error) {
    await logAdminActivity(
      `Application marked ${status}`,
      "application",
      applicationId,
      applicationInfo?.full_name ?? applicationInfo?.email ?? null,
      { status, admin_notes: adminNotes || null } as Json
    );
  }

  return { error: error?.message ?? null };
}

export async function setAgentAdminRole(agentId: string, enabled: boolean) {
  const { userId, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  if (!enabled && agentId === userId) {
    return { error: "You cannot revoke your own admin role." };
  }

  const { data, error } = await supabase.functions.invoke("admin-set-user-role", {
    body: { agent_id: agentId, enabled },
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error as string };

  const { data: agentInfo } = await supabase
    .from("agent_profiles")
    .select("profiles(full_name, email)")
    .eq("id", agentId)
    .maybeSingle();

  await logAdminActivity(
    enabled ? "Admin role granted" : "Admin role revoked",
    "agent",
    agentId,
    agentInfo?.profiles?.full_name ?? agentInfo?.profiles?.email ?? null,
    { is_admin: enabled } as Json
  );

  return { error: null, data };
}

export type ProfileFieldsUpdate = {
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
};

export type AgentFieldsUpdate = {
  cea_no: string;
  position: string | null;
  agent_type: "internal" | "external";
  years_experience: number;
  specialisations: string[];
  languages: string[];
  whatsapp_no: string | null;
  email_display: string | null;
  linkedin_url: string | null;
  bio_en: string | null;
  bio_zh: string | null;
  is_published: boolean;
  is_featured: boolean;
  display_order: number;
};

const CEA_REGEX = /^R\d{6}[A-Z]$/;

export async function updateAgentProfile(
  agentId: string,
  profileUpdate: Partial<ProfileFieldsUpdate>,
  agentUpdate: Partial<AgentFieldsUpdate>
) {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  if (agentUpdate.cea_no !== undefined && agentUpdate.cea_no && !CEA_REGEX.test(agentUpdate.cea_no)) {
    return { error: "Invalid CEA No. Format: R followed by 6 digits and 1 letter (e.g. R012345A)." };
  }

  if (Object.keys(profileUpdate).length > 0) {
    const { error: profileError } = await supabase.from("profiles").update(profileUpdate).eq("id", agentId);
    if (profileError) return { error: profileError.message };
  }

  if (Object.keys(agentUpdate).length > 0) {
    const { error: agentError } = await supabase.from("agent_profiles").update(agentUpdate).eq("id", agentId);
    if (agentError) return { error: agentError.message };
  }

  let targetName = profileUpdate.full_name ?? null;
  if (!targetName) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", agentId)
      .maybeSingle();
    targetName = existing?.full_name ?? existing?.email ?? null;
  }

  await logAdminActivity(
    "Agent profile updated",
    "agent",
    agentId,
    targetName,
    { ...profileUpdate, ...agentUpdate } as Json
  );

  return { error: null };
}
