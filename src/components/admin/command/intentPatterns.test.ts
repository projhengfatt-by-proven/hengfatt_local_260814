import { describe, expect, it } from "vitest";
import { matchIntent } from "./intentPatterns";

describe("matchIntent", () => {
  it("matches the task's own worked example: 'Put Marina Residence live.'", () => {
    expect(matchIntent("Put Marina Residence live.")).toEqual({
      kind: "publish",
      entityText: "Marina Residence",
      targetValue: true,
    });
  });

  it("matches exact navigation commands case-insensitively", () => {
    expect(matchIntent("Dashboard")).toEqual({ kind: "navigate", screen: "dashboard" });
    expect(matchIntent("listings")).toEqual({ kind: "navigate", screen: "listings" });
    expect(matchIntent("Properties")).toEqual({ kind: "navigate", screen: "listings" });
    expect(matchIntent("market insights")).toEqual({ kind: "navigate", screen: "insights" });
  });

  it("matches publish aliases", () => {
    expect(matchIntent("publish Marina Residence")).toEqual({ kind: "publish", entityText: "Marina Residence", targetValue: true });
    expect(matchIntent("make Marina Residence live")).toEqual({ kind: "publish", entityText: "Marina Residence", targetValue: true });
    expect(matchIntent("go live with Marina Residence")).toEqual({ kind: "publish", entityText: "Marina Residence", targetValue: true });
  });

  it("matches unpublish aliases", () => {
    expect(matchIntent("unpublish Marina Residence")).toEqual({ kind: "publish", entityText: "Marina Residence", targetValue: false });
    expect(matchIntent("take down Marina Residence")).toEqual({ kind: "publish", entityText: "Marina Residence", targetValue: false });
    expect(matchIntent("move Marina Residence to draft")).toEqual({ kind: "publish", entityText: "Marina Residence", targetValue: false });
  });

  it("matches feature/unfeature aliases", () => {
    expect(matchIntent("feature Marina Residence")).toEqual({ kind: "feature", entityText: "Marina Residence", targetValue: true });
    expect(matchIntent("unfeature Marina Residence")).toEqual({ kind: "feature", entityText: "Marina Residence", targetValue: false });
  });

  it("matches agent activate/suspend aliases as agent_active, never publish", () => {
    expect(matchIntent("suspend John Tan")).toEqual({ kind: "agent_active", entityText: "John Tan", targetValue: false });
    expect(matchIntent("activate John Tan")).toEqual({ kind: "agent_active", entityText: "John Tan", targetValue: true });
    expect(matchIntent("reactivate John Tan")).toEqual({ kind: "agent_active", entityText: "John Tan", targetValue: true });
  });

  it("strips the leading role noun so 'Deactivate agent A102.' resolves against 'A102', not 'agent A102'", () => {
    expect(matchIntent("Deactivate agent A102.")).toEqual({ kind: "agent_active", entityText: "A102", targetValue: false });
  });

  it("strips leading 'the' and role nouns generally", () => {
    expect(matchIntent("publish the listing Marina Residence")).toEqual({ kind: "publish", entityText: "Marina Residence", targetValue: true });
    expect(matchIntent("suspend the agent John Tan")).toEqual({ kind: "agent_active", entityText: "John Tan", targetValue: false });
  });

  it("matches resend-invite only when the target is a syntactically valid email", () => {
    expect(matchIntent("resend invite to john@example.com")).toEqual({ kind: "resend_invite", email: "john@example.com" });
    expect(matchIntent("resend the invite for John Tan")).toBeNull();
  });

  it("returns null for messages with no deterministic match", () => {
    expect(matchIntent("Which applications need attention first?")).toBeNull();
    expect(matchIntent("Summarise today's dashboard")).toBeNull();
    expect(matchIntent("")).toBeNull();
    expect(matchIntent("   ")).toBeNull();
  });

  it("does not match a bare verb with no entity text", () => {
    expect(matchIntent("publish")).toBeNull();
    expect(matchIntent("suspend")).toBeNull();
  });

  it("prioritizes agent_active over publish/feature for the same message shape", () => {
    // "suspend" only ever means agent_active — never routed to the ambiguous publish/feature path.
    const result = matchIntent("suspend Marina Residence");
    expect(result?.kind).toBe("agent_active");
  });

  describe("Level 2: structured filter queries", () => {
    it("matches 'Show me all inactive agents.' (the task's own worked example)", () => {
      expect(matchIntent("Show me all inactive agents.")).toEqual({ kind: "query_agents_active", targetValue: false });
    });

    it("matches active/inactive agent queries with various phrasings", () => {
      expect(matchIntent("show active agents")).toEqual({ kind: "query_agents_active", targetValue: true });
      expect(matchIntent("list inactive agents")).toEqual({ kind: "query_agents_active", targetValue: false });
      expect(matchIntent("find all active agents")).toEqual({ kind: "query_agents_active", targetValue: true });
    });

    it("matches 'Show three-bedroom properties below $3M.' (the task's own worked example)", () => {
      expect(matchIntent("Show three-bedroom properties below $3M.")).toEqual({
        kind: "query_listings_bedrooms_price",
        bedrooms: 3,
        priceMax: 3_000_000,
      });
    });

    it("matches numeric bedroom counts and 'k' price units", () => {
      expect(matchIntent("show 2 bedroom listings under 800k")).toEqual({
        kind: "query_listings_bedrooms_price",
        bedrooms: 2,
        priceMax: 800_000,
      });
    });

    it("matches a plain dollar amount with no unit suffix", () => {
      expect(matchIntent("show 4-bedroom properties below $1500000")).toEqual({
        kind: "query_listings_bedrooms_price",
        bedrooms: 4,
        priceMax: 1_500_000,
      });
    });

    it("returns a query_not_supported result for 'Find properties expiring this month.' rather than fabricating a filter", () => {
      const result = matchIntent("Find properties expiring this month.");
      expect(result?.kind).toBe("query_not_supported");
      if (result?.kind === "query_not_supported") {
        expect(result.reason).toMatch(/expiry/i);
      }
    });
  });

  describe("Level 3: multi-function workflows", () => {
    it("matches 'Publish all approved properties that are ready.' (the task's own worked example)", () => {
      expect(matchIntent("Publish all approved properties that are ready.")).toEqual({
        kind: "workflow_publish_approved_listings",
      });
    });

    it("matches shorter phrasings of the same workflow", () => {
      expect(matchIntent("publish all approved listings")).toEqual({ kind: "workflow_publish_approved_listings" });
      expect(matchIntent("Publish all approved properties")).toEqual({ kind: "workflow_publish_approved_listings" });
    });

    it("returns workflow_not_supported for 'Prepare expiring listings for review.' rather than fabricating one", () => {
      const result = matchIntent("Prepare expiring listings for review.");
      expect(result?.kind).toBe("workflow_not_supported");
      if (result?.kind === "workflow_not_supported") {
        expect(result.reason).toMatch(/expiry/i);
      }
    });

    it("does not confuse a single-listing publish request with the bulk workflow", () => {
      expect(matchIntent("publish Marina Residence")).toEqual({ kind: "publish", entityText: "Marina Residence", targetValue: true });
    });
  });

  describe("Level 4: genuine AI reasoning", () => {
    it("matches 'Which properties should we feature this weekend?' (the task's own worked example)", () => {
      expect(matchIntent("Which properties should we feature this weekend?")).toEqual({ kind: "reasoning_recommend_featured" });
    });

    it("matches the 'what listings should I feature' phrasing variant", () => {
      expect(matchIntent("What listings should I feature")).toEqual({ kind: "reasoning_recommend_featured" });
    });

    it("does not confuse a single named listing's feature request with the reasoning trigger", () => {
      expect(matchIntent("feature Marina Residence")).toEqual({ kind: "feature", entityText: "Marina Residence", targetValue: true });
    });

    it("does not confuse a plain filtered query with the reasoning trigger", () => {
      expect(matchIntent("show three-bedroom properties below $3M")).toEqual({
        kind: "query_listings_bedrooms_price",
        bedrooms: 3,
        priceMax: 3_000_000,
      });
    });
  });
});
