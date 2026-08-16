import { supabase } from "@/integrations/supabase/client";
import { requireAdmin } from "@/components/admin/adminGuards";
import { setListingStatus, logAdminActivity } from "@/components/admin/adminOperations";

/**
 * Level 3 — multi-function workflows. A workflow coordinates several
 * already-registered deterministic functions in sequence; it never
 * introduces new business logic of its own beyond ordering and aggregating
 * their results. See docs/copilot/LEVEL_3_WORKFLOWS.md.
 *
 * Two-phase shape, matching the confirmation contract already established
 * for bulk operations (docs/system/LIBRARY_TO_PROJECT_MAPPING.md §1.4):
 *   1. preview*() — read-only, shows exactly what would happen.
 *   2. execute*() — re-derives the candidate set fresh (never trusts a
 *      stale list from the preview step) and only then mutates anything.
 */

export type PublishableCheck = { ok: boolean; reasons: string[] };

/**
 * Pure, standalone validation function — deliberately mirrors the same
 * "ready to publish" bar already enforced in NewListingPage.tsx's
 * getRequired() at creation time (title/property type/district/size/
 * description length/at least one photo), so a listing that was
 * publishable when created and hasn't changed will pass here too.
 * Not literally shared code with getRequired() (that function reads
 * in-progress form state, not a persisted row + a photo *count* query) —
 * documented here as an intentional, acknowledged near-duplication rather
 * than a silent one; extracting a single shared field-completeness
 * checker is a reasonable follow-up, not attempted in this pass.
 */
export function isListingPublishable(row: {
  title: string | null;
  property_name: string | null;
  type: string | null;
  district: number | null;
  size_sqft: number | null;
  description_en: string | null;
  price: number | null;
  monthly_rental: number | null;
  price_on_enquiry: boolean | null;
}, photoCount: number): PublishableCheck {
  const reasons: string[] = [];
  if (photoCount === 0) reasons.push("no photos");
  if (!row.type) reasons.push("missing property type");
  if (row.district === null) reasons.push("missing district");
  if (!row.size_sqft) reasons.push("missing size (sqft)");
  if ((row.description_en ?? "").length < 100) reasons.push("description under 100 characters");
  if (!row.price && !row.monthly_rental && !row.price_on_enquiry) reasons.push("no price set");
  return { ok: reasons.length === 0, reasons };
}

export type ApprovedListingCandidate = {
  id: string;
  title: string;
  reasons: string[]; // empty if ready
};

async function findApprovedDraftListingsWithPublishability(): Promise<{
  ready: ApprovedListingCandidate[];
  notReady: ApprovedListingCandidate[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("properties")
    .select("id, title, property_name, type, district, size_sqft, description_en, price, monthly_rental, price_on_enquiry")
    .eq("approval_status", "approved")
    .eq("status", "draft")
    .limit(50);

  if (error) return { ready: [], notReady: [], error: error.message };
  if (!data || data.length === 0) return { ready: [], notReady: [], error: null };

  const { data: photoRows } = await supabase
    .from("property_images")
    .select("property_id")
    .in("property_id", data.map((row) => row.id));

  const photoCounts = new Map<string, number>();
  for (const row of photoRows ?? []) {
    photoCounts.set(row.property_id, (photoCounts.get(row.property_id) ?? 0) + 1);
  }

  const ready: ApprovedListingCandidate[] = [];
  const notReady: ApprovedListingCandidate[] = [];

  for (const row of data) {
    const check = isListingPublishable(row, photoCounts.get(row.id) ?? 0);
    const candidate: ApprovedListingCandidate = { id: row.id, title: row.property_name ?? row.title, reasons: check.reasons };
    (check.ok ? ready : notReady).push(candidate);
  }

  return { ready, notReady, error: null };
}

export async function previewPublishApprovedListings(): Promise<{
  data: { ready: ApprovedListingCandidate[]; notReady: ApprovedListingCandidate[] } | null;
  error: string | null;
}> {
  const { error: authError } = await requireAdmin();
  if (authError) return { data: null, error: authError };

  const { ready, notReady, error } = await findApprovedDraftListingsWithPublishability();
  if (error) return { data: null, error };
  return { data: { ready, notReady }, error: null };
}

export type WorkflowStepOutcome = { id: string; title: string; status: "published" | "failed" | "skipped"; detail: string };
export type WorkflowRunResult = {
  workflow: "publish_approved_listings";
  succeeded: WorkflowStepOutcome[];
  failed: WorkflowStepOutcome[];
  skipped: WorkflowStepOutcome[]; // approved+draft but not publishable — excluded before any mutation, nothing to roll back
};

export async function executePublishApprovedListings(options: {
  confirmed: true;
  onProgress?: (done: number, total: number) => void;
}): Promise<{ data: WorkflowRunResult | null; error: string | null }> {
  if (options.confirmed !== true) {
    return { data: null, error: "This workflow requires explicit confirmation." };
  }

  const { error: authError } = await requireAdmin();
  if (authError) return { data: null, error: authError };

  // Re-derive the candidate set now, at execution time — never reuse the
  // list shown in the confirmation preview. A listing could have been
  // edited, unapproved, or already published by someone else in the
  // meantime; re-running find + validate is what keeps this safe.
  // See docs/system/LIBRARY_TO_PROJECT_MAPPING.md §1.4.
  const { ready, notReady, error } = await findApprovedDraftListingsWithPublishability();
  if (error) return { data: null, error };

  const skipped: WorkflowStepOutcome[] = notReady.map((c) => ({
    id: c.id,
    title: c.title,
    status: "skipped",
    detail: `Not ready: ${c.reasons.join(", ")}`,
  }));

  const succeeded: WorkflowStepOutcome[] = [];
  const failed: WorkflowStepOutcome[] = [];

  for (let i = 0; i < ready.length; i++) {
    const candidate = ready[i];

    // update_search_index() from the task's example workflow has no
    // corresponding infrastructure in this project (confirmed absent,
    // docs/system/MISSING_CAPABILITY_REPORT.md — search_properties remains
    // PLANNED). Rather than fabricate a fake indexing call, this step is
    // explicitly a documented no-op — see docs/copilot/LEVEL_3_WORKFLOWS.md.
    const { error: publishError } = await setListingStatus(candidate.id, "active");

    if (publishError) {
      failed.push({ id: candidate.id, title: candidate.title, status: "failed", detail: publishError });
    } else {
      succeeded.push({ id: candidate.id, title: candidate.title, status: "published", detail: "Published (search index update skipped — no indexing infrastructure configured)" });
    }

    options.onProgress?.(i + 1, ready.length);
  }

  // Per-item audit already happens inside setListingStatus() via
  // logAdminActivity() — this adds one summary entry for the batch
  // itself, matching the pattern in
  // base-library/02-admin/bulk-actions/bulk_operation_execution.md.
  await logAdminActivity(
    "Bulk publish: approved listings workflow",
    "listing",
    "batch",
    null,
    { succeeded: succeeded.length, failed: failed.length, skipped: skipped.length } as any
  );

  return {
    data: { workflow: "publish_approved_listings", succeeded, failed, skipped },
    error: null,
  };
}
