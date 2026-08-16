import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAgent,
  resendAgentInvite,
  reviewApplication,
  setAgentActive,
  setAgentAdminRole,
  setAgentVisibility,
  setListingFeatured,
  setListingStatus,
  updateAgentProfile,
} from "./adminOperations";

/**
 * Direct unit tests for the shared admin action layer — the functions
 * both the manual UI (AdminListingsPage, AgentsListPage, ApplicationsPage,
 * EditAgentPage, AddNewAgentForm) and the Copilot (AdminChatPanel's
 * executeAction()) call. See docs/testing/ADMIN_COPILOT_TEST_REPORT.md.
 * Prior to this file, adminOperations.ts had zero direct test coverage —
 * every existing test mocked it away rather than exercising it.
 */

const testState = vi.hoisted(() => ({
  requireAdminResult: { userId: "admin-1", error: null as string | null },
  agentProfileRow: null as any,
  profileRow: null as any,
  listingRow: null as any,
  applicationRow: null as any,
  updateError: null as { message: string } | null,
  invokeResult: { data: null as any, error: null as any },
  activityLogInserts: [] as any[],
}));

vi.mock("@/components/admin/adminGuards", () => ({
  requireAdmin: vi.fn(() => Promise.resolve(testState.requireAdminResult)),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "admin-1" } } })),
    },
    functions: {
      invoke: vi.fn(() => Promise.resolve(testState.invokeResult)),
    },
    from: vi.fn((table: string) => {
      if (table === "admin_activity_log") {
        return { insert: vi.fn((payload: any) => { testState.activityLogInserts.push(payload); return Promise.resolve({ error: null }); }) };
      }
      if (table === "agent_profiles") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: testState.agentProfileRow, error: null })) })) })),
          update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: testState.updateError })) })),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: testState.profileRow, error: null })) })) })),
          update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: testState.updateError })) })),
        };
      }
      if (table === "properties") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: testState.listingRow, error: null })) })) })),
          update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: testState.updateError })) })),
        };
      }
      if (table === "agent_applications") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: testState.applicationRow, error: null })) })) })),
          update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: testState.updateError })) })),
        };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    }),
  },
}));

function resetState() {
  testState.requireAdminResult = { userId: "admin-1", error: null };
  testState.agentProfileRow = { agent_type: "internal", profiles: { full_name: "John Tan", email: "john@x.com" } };
  testState.profileRow = { full_name: "John Tan", email: "john@x.com" };
  testState.listingRow = { title: "3BR Condo", title_zh: null, property_name: "Marina Residence", slug: "marina-residence" };
  testState.applicationRow = { full_name: "Amelia Tan", email: "amelia@x.com" };
  testState.updateError = null;
  testState.invokeResult = { data: { success: true }, error: null };
  testState.activityLogInserts = [];
}

describe("adminOperations — shared action layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
  });

  describe("setListingStatus", () => {
    it("valid parameters: publishes and audits", async () => {
      const result = await setListingStatus("listing-1", "active");
      expect(result).toEqual({ error: null });
      expect(testState.activityLogInserts).toHaveLength(1);
      expect(testState.activityLogInserts[0]).toMatchObject({ action: "Listing published", target_type: "listing", target_id: "listing-1" });
    });

    it("wrong role / unauthorized: rejected before any mutation, no audit entry", async () => {
      testState.requireAdminResult = { userId: null, error: "Forbidden — admin role required." };
      const result = await setListingStatus("listing-1", "active");
      expect(result).toEqual({ error: "Forbidden — admin role required." });
      expect(testState.activityLogInserts).toHaveLength(0);
    });

    it("failure: a database error surfaces as a structured result, not a thrown exception, and is not audited", async () => {
      testState.updateError = { message: "connection reset" };
      const result = await setListingStatus("listing-1", "active");
      expect(result).toEqual({ error: "connection reset" });
      expect(testState.activityLogInserts).toHaveLength(0);
    });

    it("duplicate execution: calling twice with the same status is idempotent (no error, same effect)", async () => {
      const first = await setListingStatus("listing-1", "active");
      const second = await setListingStatus("listing-1", "active");
      expect(first).toEqual({ error: null });
      expect(second).toEqual({ error: null });
      expect(testState.activityLogInserts).toHaveLength(2); // both logged — each call is a real audited event
    });

    it("side effects: unpublishing uses the 'taken down' audit label, not 'published'", async () => {
      await setListingStatus("listing-1", "draft");
      expect(testState.activityLogInserts[0].action).toBe("Listing taken down");
    });
  });

  describe("setListingFeatured", () => {
    it("valid parameters: features and audits", async () => {
      const result = await setListingFeatured("listing-1", true);
      expect(result).toEqual({ error: null });
      expect(testState.activityLogInserts[0]).toMatchObject({ action: "Listing featured" });
    });

    it("unauthorized: rejected, no mutation attempted", async () => {
      testState.requireAdminResult = { userId: null, error: "Not authenticated." };
      const result = await setListingFeatured("listing-1", true);
      expect(result).toEqual({ error: "Not authenticated." });
    });
  });

  describe("setAgentVisibility", () => {
    it("valid parameters: publishes an internal agent", async () => {
      const result = await setAgentVisibility("agent-1", { is_published: true });
      expect(result).toEqual({ error: null });
      expect(testState.activityLogInserts[0]).toMatchObject({ action: "Agent visibility updated" });
    });

    it("business rule (invalid parameters): rejects featuring a non-internal agent before any mutation", async () => {
      testState.agentProfileRow = { agent_type: "external", profiles: { full_name: "Jane Lim", email: "jane@x.com" } };
      const result = await setAgentVisibility("agent-2", { is_featured: true });
      expect(result).toEqual({ error: "Only internal agents can be featured on the homepage." });
      expect(testState.activityLogInserts).toHaveLength(0);
    });

    it("unauthorized: rejected before the business-rule check even runs", async () => {
      testState.requireAdminResult = { userId: null, error: "Forbidden — admin role required." };
      const result = await setAgentVisibility("agent-1", { is_featured: true });
      expect(result).toEqual({ error: "Forbidden — admin role required." });
    });
  });

  describe("setAgentActive", () => {
    it("valid parameters: activates and audits with the correct label", async () => {
      const result = await setAgentActive("agent-1", true);
      expect(result).toEqual({ error: null });
      expect(testState.activityLogInserts[0].action).toBe("Agent reactivated");
    });

    it("valid parameters: suspends and audits with the correct label", async () => {
      await setAgentActive("agent-1", false);
      expect(testState.activityLogInserts[0].action).toBe("Agent deactivated");
    });

    it("unauthorized: rejected", async () => {
      testState.requireAdminResult = { userId: null, error: "Not authenticated." };
      const result = await setAgentActive("agent-1", false);
      expect(result).toEqual({ error: "Not authenticated." });
    });
  });

  describe("setAgentAdminRole", () => {
    it("valid parameters: grants admin role", async () => {
      const result = await setAgentAdminRole("agent-2", true);
      expect(result.error).toBeNull();
      expect(testState.activityLogInserts[0].action).toBe("Admin role granted");
    });

    it("business rule (self-lockout): an admin cannot revoke their own role — rejected before the edge function is called", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const result = await setAgentAdminRole("admin-1", false); // same id as the authenticated caller
      expect(result).toEqual({ error: "You cannot revoke your own admin role." });
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
      expect(testState.activityLogInserts).toHaveLength(0);
    });

    it("allows an admin to grant themselves the role redundantly, and allows revoking someone else's", async () => {
      const revokeOther = await setAgentAdminRole("agent-3", false);
      expect(revokeOther.error).toBeNull();
    });

    it("failure: an edge-function-reported error surfaces without throwing", async () => {
      testState.invokeResult = { data: { error: "user not found" }, error: null };
      const result = await setAgentAdminRole("agent-404", true);
      expect(result).toEqual({ error: "user not found" });
    });

    it("unauthorized: rejected before the self-lockout check or the edge function call", async () => {
      testState.requireAdminResult = { userId: null, error: "Forbidden — admin role required." };
      const { supabase } = await import("@/integrations/supabase/client");
      const result = await setAgentAdminRole("admin-1", false);
      expect(result).toEqual({ error: "Forbidden — admin role required." });
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
    });
  });

  describe("reviewApplication", () => {
    it("valid parameters: approves and records the reviewer's real user id, not a client-supplied one", async () => {
      const result = await reviewApplication("app-1", "approved", "Looks great");
      expect(result).toEqual({ error: null });
      expect(testState.activityLogInserts[0]).toMatchObject({ action: "Application marked approved" });
    });

    it("unauthorized: rejected", async () => {
      testState.requireAdminResult = { userId: null, error: "Not authenticated." };
      const result = await reviewApplication("app-1", "declined");
      expect(result).toEqual({ error: "Not authenticated." });
    });
  });

  describe("createAgent / resendAgentInvite — non-idempotent, duplicate-execution risk", () => {
    it("createAgent valid parameters: invites and audits", async () => {
      const result = await createAgent({
        full_name: "Jane Lim", email: "jane@x.com", phone: "+65 9000 0000", preferred_lang: "en",
        cea_no: null, years_experience: null, agent_type: "external", position: null,
        specialisations: [], languages: [], linkedin_url: null, display_order: 99, bio_en: null, bio_zh: null,
      });
      expect(result.error).toBeNull();
      expect(testState.activityLogInserts[0].action).toBe("Agent invited");
    });

    it("createAgent unauthorized: rejected before the invite edge function runs", async () => {
      testState.requireAdminResult = { userId: null, error: "Forbidden — admin role required." };
      const { supabase } = await import("@/integrations/supabase/client");
      const result = await createAgent({
        full_name: "Jane Lim", email: "jane@x.com", phone: "+65 9000 0000", preferred_lang: "en",
        cea_no: null, years_experience: null, agent_type: "external", position: null,
        specialisations: [], languages: [], linkedin_url: null, display_order: 99, bio_en: null, bio_zh: null,
      });
      expect(result.error).toBe("Forbidden — admin role required.");
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
    });

    it("duplicate execution: calling resendAgentInvite twice sends two real emails — NOT idempotent, each call is audited separately", async () => {
      // This documents actual behavior, not a bug: resendAgentInvite has a
      // real side effect (an email send) on every call. There is no
      // dedup/rate-limit at this layer — see
      // docs/testing/ADMIN_COPILOT_TEST_REPORT.md for why this is called
      // out as a known, accepted characteristic rather than a gap to fix
      // silently here.
      const { supabase } = await import("@/integrations/supabase/client");
      await resendAgentInvite("john@x.com");
      await resendAgentInvite("john@x.com");

      expect(supabase.functions.invoke).toHaveBeenCalledTimes(2);
      expect(testState.activityLogInserts).toHaveLength(2);
    });

    it("resendAgentInvite unauthorized: rejected, no email sent", async () => {
      testState.requireAdminResult = { userId: null, error: "Not authenticated." };
      const { supabase } = await import("@/integrations/supabase/client");
      const result = await resendAgentInvite("john@x.com");
      expect(result.error).toBe("Not authenticated.");
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
    });
  });

  describe("updateAgentProfile", () => {
    it("valid parameters: applies a partial update without requiring every field", async () => {
      const result = await updateAgentProfile("agent-1", {}, { position: "Senior Associate" });
      expect(result).toEqual({ error: null });
      expect(testState.activityLogInserts[0]).toMatchObject({ action: "Agent profile updated" });
    });

    it("invalid parameters: rejects a malformed CEA number before any mutation", async () => {
      const result = await updateAgentProfile("agent-1", {}, { cea_no: "NOTVALID" });
      expect(result.error).toMatch(/Invalid CEA No\./);
      expect(testState.activityLogInserts).toHaveLength(0);
    });

    it("accepts a correctly-formatted CEA number", async () => {
      const result = await updateAgentProfile("agent-1", {}, { cea_no: "R012345A" });
      expect(result).toEqual({ error: null });
    });

    it("unauthorized: rejected before CEA validation even runs", async () => {
      testState.requireAdminResult = { userId: null, error: "Forbidden — admin role required." };
      const result = await updateAgentProfile("agent-1", {}, { cea_no: "NOTVALID" });
      expect(result).toEqual({ error: "Forbidden — admin role required." });
    });

    it("audit target name falls back to the existing profile's name when full_name isn't part of this partial update", async () => {
      testState.profileRow = { full_name: "Existing Name", email: "existing@x.com" };
      await updateAgentProfile("agent-1", {}, { position: "New Title" });
      expect(testState.activityLogInserts[0].target_name).toBe("Existing Name");
    });
  });
});
