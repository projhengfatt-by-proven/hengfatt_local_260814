import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

type AdminLogChanges = Json | null;

async function logAdminActivity(
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

export async function resendAgentInvite(email: string) {
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
  const { data: { user } } = await supabase.auth.getUser();
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
      reviewed_by: user?.id ?? null,
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
