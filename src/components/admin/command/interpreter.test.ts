import { beforeEach, describe, expect, it, vi } from "vitest";
import { interpretAdminMessage } from "./interpreter";

const testData = vi.hoisted(() => ({
  resolveListingByTitle: vi.fn(),
  resolveAgentByName: vi.fn(),
  queryAgents: vi.fn(),
  queryListings: vi.fn(),
  previewPublishApprovedListings: vi.fn(),
  gatherFeaturedListingCandidates: vi.fn(),
  buildFeaturedListingsGroundingPrompt: vi.fn(),
}));

vi.mock("./entityResolvers", () => ({
  resolveListingByTitle: testData.resolveListingByTitle,
  resolveAgentByName: testData.resolveAgentByName,
}));

vi.mock("./adminQueries", () => ({
  queryAgents: testData.queryAgents,
  queryListings: testData.queryListings,
}));

vi.mock("./workflows", () => ({
  previewPublishApprovedListings: testData.previewPublishApprovedListings,
}));

vi.mock("./reasoning", () => ({
  gatherFeaturedListingCandidates: testData.gatherFeaturedListingCandidates,
  buildFeaturedListingsGroundingPrompt: testData.buildFeaturedListingsGroundingPrompt,
}));

describe("interpretAdminMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testData.resolveListingByTitle.mockResolvedValue({ status: "none" });
    testData.resolveAgentByName.mockResolvedValue({ status: "none" });
    testData.queryAgents.mockResolvedValue({ data: [], error: null, total: 0 });
    testData.queryListings.mockResolvedValue({ data: [], error: null, total: 0 });
    testData.previewPublishApprovedListings.mockResolvedValue({ data: { ready: [], notReady: [] }, error: null });
    testData.gatherFeaturedListingCandidates.mockResolvedValue({ data: [], error: null });
    testData.buildFeaturedListingsGroundingPrompt.mockReturnValue("GROUNDED PROMPT");
  });

  describe("Level 4: genuine AI reasoning", () => {
    it("gathers data and builds a grounding prompt for 'Which properties should we feature this weekend?' without calling the LLM itself", async () => {
      const candidates = [{ id: "p1", title: "Marina Residence", price: 2_500_000, monthlyRental: null, bedrooms: 3, viewCount: 142, isFeatured: false, createdAt: "2026-06-01T00:00:00Z" }];
      testData.gatherFeaturedListingCandidates.mockResolvedValue({ data: candidates, error: null });

      const result = await interpretAdminMessage("Which properties should we feature this weekend?");

      expect(testData.gatherFeaturedListingCandidates).toHaveBeenCalledTimes(1);
      expect(testData.buildFeaturedListingsGroundingPrompt).toHaveBeenCalledWith(
        "Which properties should we feature this weekend?",
        candidates
      );
      expect(result).toEqual({ status: "needs_reasoning", groundingPrompt: "GROUNDED PROMPT" });
    });

    it("reports a data-gathering error as a query_result rather than proceeding to a model call", async () => {
      testData.gatherFeaturedListingCandidates.mockResolvedValue({ data: [], error: "Forbidden — admin role required." });

      const result = await interpretAdminMessage("Which properties should we feature this weekend?");

      expect(testData.buildFeaturedListingsGroundingPrompt).not.toHaveBeenCalled();
      expect(result).toEqual({ status: "query_result", message: "Couldn't gather listing data: Forbidden — admin role required." });
    });

    it("reports 'no active listings' as a query_result rather than calling the model with nothing to reason about", async () => {
      testData.gatherFeaturedListingCandidates.mockResolvedValue({ data: [], error: null });

      const result = await interpretAdminMessage("which listings should we feature");

      expect(testData.buildFeaturedListingsGroundingPrompt).not.toHaveBeenCalled();
      expect(result).toEqual({ status: "query_result", message: "No active listings found to recommend from." });
    });
  });

  describe("Level 3: multi-function workflows", () => {
    it("builds a confirmable pending action for 'Publish all approved properties that are ready.' with the preview counts in its description", async () => {
      testData.previewPublishApprovedListings.mockResolvedValue({
        data: {
          ready: [{ id: "p1", title: "Marina Residence", reasons: [] }],
          notReady: [{ id: "p2", title: "Studio Unit", reasons: ["no photos"] }],
        },
        error: null,
      });

      const result = await interpretAdminMessage("Publish all approved properties that are ready.");

      expect(result.status).toBe("resolved");
      if (result.status === "resolved") {
        expect(result.action.name).toBe("admin_workflow_publish_approved_listings");
        expect(result.action.description).toContain("Marina Residence");
        expect(result.action.description).toContain("Studio Unit");
        expect(result.action.description).toContain("no photos");
        // Nothing is mutated by resolving the intent — only a preview ran.
        expect(result.action.input).toEqual({});
      }
    });

    it("reports 'nothing to publish' as a query_result, not a confirmable action, when there are no candidates at all", async () => {
      testData.previewPublishApprovedListings.mockResolvedValue({ data: { ready: [], notReady: [] }, error: null });

      const result = await interpretAdminMessage("publish all approved listings");
      expect(result).toEqual({
        status: "query_result",
        message: "No approved, unpublished listings found — nothing to publish.",
      });
    });

    it("reports a query_result (not a confirmable action) when candidates exist but none are ready", async () => {
      testData.previewPublishApprovedListings.mockResolvedValue({
        data: { ready: [], notReady: [{ id: "p2", title: "Studio Unit", reasons: ["no photos"] }] },
        error: null,
      });

      const result = await interpretAdminMessage("publish all approved listings");
      expect(result.status).toBe("query_result");
      if (result.status === "query_result") {
        expect(result.message).toContain("Studio Unit");
        expect(result.message).toContain("no photos");
      }
    });

    it("returns query_result for 'Prepare expiring listings for review.' without calling the preview function at all", async () => {
      const result = await interpretAdminMessage("Prepare expiring listings for review.");

      expect(testData.previewPublishApprovedListings).not.toHaveBeenCalled();
      expect(result.status).toBe("query_result");
      if (result.status === "query_result") {
        expect(result.message).toMatch(/expiry/i);
      }
    });

    it("surfaces a preview error as a query_result rather than throwing", async () => {
      testData.previewPublishApprovedListings.mockResolvedValue({ data: null, error: "Forbidden — admin role required." });

      const result = await interpretAdminMessage("publish all approved listings");
      expect(result).toEqual({
        status: "query_result",
        message: "Couldn't check approved listings: Forbidden — admin role required.",
      });
    });
  });

  describe("Level 4 bypass check: AI recommendations cannot skip deterministic execution controls", () => {
    it("'needs_reasoning' results carry only a prompt string — never an executable action, never pending_actions", async () => {
      // This is the direct test for "can AI recommendations incorrectly
      // bypass deterministic execution controls" — the type itself proves
      // it structurally: { status: "needs_reasoning"; groundingPrompt: string }
      // has no `action` field, so there is nothing for AdminChatPanel.tsx
      // to dispatch to SET_PENDING_ACTIONS or executeAction() from this
      // result alone. Any real action still requires a SEPARATE, later
      // message that goes back through this same interpreter (or the LLM
      // tool-use path) and its own independent confirmation step.
      testData.gatherFeaturedListingCandidates.mockResolvedValue({
        data: [{ id: "p1", title: "Marina Residence", price: 1, monthlyRental: null, bedrooms: 1, viewCount: 1, isFeatured: false, createdAt: "2026-01-01" }],
        error: null,
      });

      const result = await interpretAdminMessage("Which properties should we feature this weekend?");

      expect(result.status).toBe("needs_reasoning");
      expect(result).not.toHaveProperty("action");
      expect(Object.keys(result)).toEqual(["status", "groundingPrompt"]);
    });

    it("the grounding prompt explicitly instructs the model not to propose a tool call for this request", async () => {
      testData.gatherFeaturedListingCandidates.mockResolvedValue({
        data: [{ id: "p1", title: "Marina Residence", price: 1, monthlyRental: null, bedrooms: 1, viewCount: 1, isFeatured: false, createdAt: "2026-01-01" }],
        error: null,
      });
      testData.buildFeaturedListingsGroundingPrompt.mockImplementation((text: string) => `${text} [do not propose a tool call]`);

      const result = await interpretAdminMessage("Which properties should we feature this weekend?");
      if (result.status === "needs_reasoning") {
        expect(result.groundingPrompt).toContain("do not propose a tool call");
      } else {
        throw new Error("expected needs_reasoning");
      }
    });
  });

  describe("Level 2: structured filter queries", () => {
    it("executes 'Show me all inactive agents.' immediately as a read — no pending action, no confirmation", async () => {
      testData.queryAgents.mockResolvedValue({
        data: [{ id: "a1", fullName: "Mary Lim", email: null, isActive: false, isPublished: true, isFeatured: false, agentType: "external" }],
        error: null,
        total: 1,
      });

      const result = await interpretAdminMessage("Show me all inactive agents.");

      expect(testData.queryAgents).toHaveBeenCalledWith({ isActive: false, limit: 20 });
      expect(result.status).toBe("query_result");
      if (result.status === "query_result") {
        expect(result.message).toContain("Mary Lim");
        expect(result.message).toContain("1 inactive agent");
      }
    });

    it("executes 'Show three-bedroom properties below $3M.' as a structured listings query", async () => {
      testData.queryListings.mockResolvedValue({
        data: [{ id: "p1", title: "Marina Residence", status: "active", price: 2_500_000, monthlyRental: null, bedrooms: 3, isFeatured: false }],
        error: null,
        total: 1,
      });

      const result = await interpretAdminMessage("Show three-bedroom properties below $3M.");

      expect(testData.queryListings).toHaveBeenCalledWith({ bedrooms: 3, priceMax: 3_000_000, limit: 20 });
      expect(result.status).toBe("query_result");
      if (result.status === "query_result") {
        expect(result.message).toContain("Marina Residence");
      }
    });

    it("reports 'Find properties expiring this month.' as an honest capability gap, without querying anything", async () => {
      const result = await interpretAdminMessage("Find properties expiring this month.");

      expect(testData.queryListings).not.toHaveBeenCalled();
      expect(testData.queryAgents).not.toHaveBeenCalled();
      expect(result.status).toBe("query_result");
      if (result.status === "query_result") {
        expect(result.message).toMatch(/expiry/i);
      }
    });

    it("surfaces a query error as a plain message rather than throwing", async () => {
      testData.queryAgents.mockResolvedValue({ data: [], error: "Forbidden — admin role required.", total: null });

      const result = await interpretAdminMessage("show inactive agents");
      expect(result).toEqual({ status: "query_result", message: "Couldn't load agents: Forbidden — admin role required." });
    });

    it("reports zero results in plain language rather than an empty list", async () => {
      const result = await interpretAdminMessage("show active agents");
      expect(result).toEqual({ status: "query_result", message: "No active agents found." });
    });
  });

  it("returns unmatched for open-ended requests without ever calling entity resolution", async () => {
    const result = await interpretAdminMessage("Which applications need attention first?");
    expect(result).toEqual({ status: "unmatched" });
    expect(testData.resolveListingByTitle).not.toHaveBeenCalled();
    expect(testData.resolveAgentByName).not.toHaveBeenCalled();
  });

  it("resolves navigation without touching entity resolution", async () => {
    const result = await interpretAdminMessage("listings");
    expect(result).toEqual({ status: "navigate", screen: "listings" });
    expect(testData.resolveListingByTitle).not.toHaveBeenCalled();
    expect(testData.resolveAgentByName).not.toHaveBeenCalled();
  });

  it("resolves resend-invite from a plain email address, skipping entity resolution entirely", async () => {
    const result = await interpretAdminMessage("resend invite to john@example.com");
    expect(result).toMatchObject({
      status: "resolved",
      action: { name: "admin_resend_agent_invite", input: { email: "john@example.com" } },
    });
    expect(testData.resolveListingByTitle).not.toHaveBeenCalled();
    expect(testData.resolveAgentByName).not.toHaveBeenCalled();
  });

  it("resolves 'Put Marina Residence live.' end-to-end to a listing publish action (the task's worked example)", async () => {
    testData.resolveListingByTitle.mockResolvedValue({
      status: "single",
      entity: { id: "P1024", title: "Marina Residence", status: "draft" },
    });

    const result = await interpretAdminMessage("Put Marina Residence live.");

    expect(testData.resolveListingByTitle).toHaveBeenCalledWith("Marina Residence");
    expect(result).toMatchObject({
      status: "resolved",
      action: {
        name: "admin_set_listing_status",
        input: { listing_id: "P1024", status: "active" },
      },
    });
  });

  it("falls back to agent resolution when publish doesn't match any listing", async () => {
    testData.resolveListingByTitle.mockResolvedValue({ status: "none" });
    testData.resolveAgentByName.mockResolvedValue({
      status: "single",
      entity: { id: "agent-1", fullName: "John Tan", isActive: true },
    });

    const result = await interpretAdminMessage("publish John Tan");

    expect(testData.resolveListingByTitle).toHaveBeenCalledWith("John Tan");
    expect(testData.resolveAgentByName).toHaveBeenCalledWith("John Tan");
    expect(result).toMatchObject({
      status: "resolved",
      action: {
        name: "admin_set_agent_visibility",
        input: { agent_id: "agent-1", is_published: true },
      },
    });
  });

  it("returns not_found when neither a listing nor an agent matches", async () => {
    const result = await interpretAdminMessage("feature Nonexistent Thing");
    expect(result).toEqual({
      status: "not_found",
      message: "I couldn't find a listing or agent matching \"Nonexistent Thing\".",
    });
  });

  it("returns ambiguous with candidate names when multiple listings match, without checking agents", async () => {
    testData.resolveListingByTitle.mockResolvedValue({
      status: "ambiguous",
      candidates: [
        { id: "p1", title: "Marina Residence Tower A", status: "active" },
        { id: "p2", title: "Marina Residence Tower B", status: "draft" },
      ],
    });

    const result = await interpretAdminMessage("feature Marina Residence");

    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.message).toContain("Marina Residence Tower A");
      expect(result.message).toContain("Marina Residence Tower B");
    }
    expect(testData.resolveAgentByName).not.toHaveBeenCalled();
  });

  it("resolves agent activate/suspend directly, never trying listing resolution", async () => {
    testData.resolveAgentByName.mockResolvedValue({
      status: "single",
      entity: { id: "agent-2", fullName: "Mary Lim", isActive: false },
    });

    const result = await interpretAdminMessage("suspend Mary Lim");

    expect(testData.resolveListingByTitle).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "resolved",
      action: { name: "admin_set_agent_active", input: { agent_id: "agent-2", is_active: false } },
    });
  });

  it("returns ambiguous for agent activate/suspend when multiple agents match", async () => {
    testData.resolveAgentByName.mockResolvedValue({
      status: "ambiguous",
      candidates: [
        { id: "a1", fullName: "John Tan", isActive: true },
        { id: "a2", fullName: "Johnny Tanaka", isActive: true },
      ],
    });

    const result = await interpretAdminMessage("suspend John");
    expect(result.status).toBe("ambiguous");
  });
});
