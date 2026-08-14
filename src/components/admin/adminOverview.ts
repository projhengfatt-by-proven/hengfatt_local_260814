import { supabase } from "@/integrations/supabase/client";

export type AdminApplication = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  current_agency: string | null;
  years_of_experience: number | null;
  specialisations: string[] | null;
  portfolio_url: string | null;
  resume_url: string | null;
  short_bio: string | null;
  message: string | null;
  cea_no: string | null;
  nric_last4: string | null;
  status: string | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
};

export type AdminListing = {
  id: string;
  title: string;
  title_zh: string | null;
  status: string;
  is_featured: boolean | null;
  view_count: number | null;
  price: number | null;
  monthly_rental: number | null;
  price_on_enquiry: boolean | null;
  slug: string | null;
  created_at: string;
  agent_profiles?: {
    profiles?: {
      full_name: string | null;
      email: string | null;
    } | null;
  } | null;
  property_images?: Array<{
    url: string | null;
    is_cover: boolean | null;
  }> | null;
};

export type AdminAgent = {
  id: string;
  cea_no: string;
  position: string | null;
  agent_type: string | null;
  is_published: boolean | null;
  is_featured: boolean | null;
  display_order: number | null;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
    phone: string | null;
    is_active: boolean | null;
    password_set_at: string | null;
  } | null;
};

export type AdminActivity = {
  id: string;
  action: string;
  target_type: string;
  target_name: string | null;
  created_at: string;
  changes: Record<string, unknown> | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
};

export type AdminCounts = {
  agentsTotal: number;
  agentsPublished: number;
  agentsFeatured: number;
  agentsPendingInvite: number;
  listingsTotal: number;
  listingsActive: number;
  listingsDraft: number;
  listingsFeatured: number;
  applicationsTotal: number;
  applicationsPending: number;
  applicationsApproved: number;
  applicationsReviewing: number;
  applicationsInterview: number;
  applicationsDeclined: number;
  activityTotal: number;
};

export type AdminOverview = {
  counts: AdminCounts;
  agents: AdminAgent[];
  listings: AdminListing[];
  applications: AdminApplication[];
  activity: AdminActivity[];
  pendingInvites: AdminAgent[];
};

function safeCount<T>(rows: T[] | null | undefined) {
  return rows?.length ?? 0;
}

export async function fetchAdminOverview(): Promise<{ data: AdminOverview | null; error: string | null }> {
  const [agentsRes, listingsRes, applicationsRes, activityRes] = await Promise.all([
    supabase
      .from("agent_profiles")
      .select("id, cea_no, position, agent_type, is_published, is_featured, display_order, profiles(full_name, avatar_url, email, phone, is_active, password_set_at)")
      .order("display_order", { ascending: true }),
    supabase
      .from("properties")
      .select("id, title, title_zh, status, is_featured, view_count, price, monthly_rental, price_on_enquiry, slug, created_at, agent_profiles!properties_agent_id_fkey(profiles(full_name, email)), property_images(url, is_cover)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("agent_applications")
      .select("id, full_name, email, phone, current_agency, years_of_experience, specialisations, portfolio_url, resume_url, short_bio, message, cea_no, nric_last4, status, admin_notes, reviewed_at, reviewed_by, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("admin_activity_log")
      .select("id, action, target_type, target_name, created_at, changes, profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const error = agentsRes.error || listingsRes.error || applicationsRes.error || activityRes.error;
  if (error) {
    return { data: null, error: error.message };
  }

  const agents = (agentsRes.data ?? []) as AdminAgent[];
  const listings = (listingsRes.data ?? []) as AdminListing[];
  const applications = (applicationsRes.data ?? []) as AdminApplication[];
  const activity = (activityRes.data ?? []) as AdminActivity[];

  const counts: AdminCounts = {
    agentsTotal: safeCount(agents),
    agentsPublished: agents.filter((agent) => agent.is_published).length,
    agentsFeatured: agents.filter((agent) => agent.is_featured).length,
    agentsPendingInvite: agents.filter((agent) => !agent.profiles?.password_set_at).length,
    listingsTotal: safeCount(listings),
    listingsActive: listings.filter((listing) => listing.status === "active").length,
    listingsDraft: listings.filter((listing) => listing.status === "draft").length,
    listingsFeatured: listings.filter((listing) => listing.is_featured).length,
    applicationsTotal: safeCount(applications),
    applicationsPending: applications.filter((application) => application.status === "pending").length,
    applicationsApproved: applications.filter((application) => application.status === "approved").length,
    applicationsReviewing: applications.filter((application) => application.status === "reviewing").length,
    applicationsInterview: applications.filter((application) => application.status === "interview").length,
    applicationsDeclined: applications.filter((application) => application.status === "declined").length,
    activityTotal: safeCount(activity),
  };

  const pendingInvites = agents.filter((agent) => !agent.profiles?.password_set_at);

  return {
    data: {
      counts,
      agents,
      listings,
      applications,
      activity,
      pendingInvites,
    },
    error: null,
  };
}

export function buildAdminContext(overview: AdminOverview) {
  const urgentApplications = overview.applications
    .filter((application) => application.status === "pending" || application.status === "reviewing")
    .slice(0, 5)
    .map((application) => ({
      id: application.id,
      name: application.full_name,
      email: application.email,
      status: application.status,
      agency: application.current_agency,
    }));

  const draftListings = overview.listings
    .filter((listing) => listing.status === "draft")
    .slice(0, 5)
    .map((listing) => ({
      id: listing.id,
      title: listing.title,
      featured: !!listing.is_featured,
      views: listing.view_count ?? 0,
    }));

  return {
    counts: overview.counts,
    headline: {
      agents: `${overview.counts.agentsPublished}/${overview.counts.agentsTotal} published`,
      listings: `${overview.counts.listingsActive}/${overview.counts.listingsTotal} active`,
      applications: `${overview.counts.applicationsPending} pending, ${overview.counts.applicationsReviewing} reviewing`,
    },
    pendingInvites: overview.pendingInvites.slice(0, 5).map((agent) => ({
      id: agent.id,
      name: agent.profiles?.full_name ?? "",
      email: agent.profiles?.email ?? "",
      published: !!agent.is_published,
      featured: !!agent.is_featured,
    })),
    urgentApplications,
    draftListings,
    recentActivity: overview.activity.slice(0, 5).map((entry) => ({
      id: entry.id,
      action: entry.action,
      target: entry.target_name,
      targetType: entry.target_type,
      at: entry.created_at,
    })),
  };
}

export function formatAdminContext(overview: AdminOverview) {
  const context = buildAdminContext(overview);

  return [
    "ADMIN OVERVIEW",
    `- Agents: ${context.headline.agents}`,
    `- Listings: ${context.headline.listings}`,
    `- Applications: ${context.headline.applications}`,
    `- Featured agents: ${overview.counts.agentsFeatured}`,
    `- Featured listings: ${overview.counts.listingsFeatured}`,
    `- Pending invites: ${context.pendingInvites.length}`,
    "",
    "URGENT APPLICATIONS",
    ...(context.urgentApplications.length > 0
      ? context.urgentApplications.map((item) => `- ${item.name} (${item.status}) ${item.agency ? `from ${item.agency}` : ""}`.trim())
      : ["- None"]),
    "",
    "DRAFT LISTINGS",
    ...(context.draftListings.length > 0
      ? context.draftListings.map((item) => `- ${item.title} (${item.views} views, featured: ${item.featured ? "yes" : "no"})`)
      : ["- None"]),
    "",
    "RECENT ACTIVITY",
    ...(context.recentActivity.length > 0
      ? context.recentActivity.map((item) => `- ${item.action} on ${item.target ?? item.targetType} at ${item.at}`)
      : ["- None"]),
  ].join("\n");
}
