import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryAgents, queryApplications, queryListings } from "./adminQueries";

const testState = vi.hoisted(() => ({
  requireAdminResult: { userId: "admin-1", error: null as string | null },
  agentRows: [] as any[],
  agentCount: 0,
  listingRows: [] as any[],
  listingCount: 0,
  applicationRows: [] as any[],
  applicationCount: 0,
  lastRange: null as { from: number; to: number } | null,
  ilikeCalls: [] as Array<{ column: string; pattern: string }>,
}));

vi.mock("@/components/admin/adminGuards", () => ({
  requireAdmin: vi.fn(() => Promise.resolve(testState.requireAdminResult)),
}));

function makeChainable(rows: any[], count: number) {
  const chain: any = {
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    or: vi.fn(() => chain),
    ilike: vi.fn((column: string, pattern: string) => {
      testState.ilikeCalls.push({ column, pattern });
      return chain;
    }),
    order: vi.fn(() => chain),
    range: vi.fn((from: number, to: number) => {
      testState.lastRange = { from, to };
      return Promise.resolve({ data: rows, error: null, count });
    }),
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "agent_profiles") {
        return { select: vi.fn(() => makeChainable(testState.agentRows, testState.agentCount)) };
      }
      if (table === "properties") {
        return { select: vi.fn(() => makeChainable(testState.listingRows, testState.listingCount)) };
      }
      if (table === "agent_applications") {
        return { select: vi.fn(() => makeChainable(testState.applicationRows, testState.applicationCount)) };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    }),
  },
}));

describe("adminQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.requireAdminResult = { userId: "admin-1", error: null };
    testState.agentRows = [];
    testState.agentCount = 0;
    testState.listingRows = [];
    testState.listingCount = 0;
    testState.applicationRows = [];
    testState.applicationCount = 0;
    testState.lastRange = null;
    testState.ilikeCalls = [];
  });

  describe("permission enforcement", () => {
    it("rejects queryAgents when the caller is not an admin, without touching the database", async () => {
      testState.requireAdminResult = { userId: null, error: "Forbidden — admin role required." };
      const result = await queryAgents({ isActive: false });
      expect(result).toEqual({ data: [], error: "Forbidden — admin role required.", total: null });
    });

    it("rejects queryListings and queryApplications the same way", async () => {
      testState.requireAdminResult = { userId: null, error: "Not authenticated." };
      expect(await queryListings({})).toEqual({ data: [], error: "Not authenticated.", total: null });
      expect(await queryApplications({})).toEqual({ data: [], error: "Not authenticated.", total: null });
    });
  });

  describe("queryAgents", () => {
    it("maps rows and filters isActive client-side (the joined-column constraint)", async () => {
      testState.agentRows = [
        { id: "a1", agent_type: "internal", is_published: true, is_featured: false, profiles: { full_name: "John Tan", email: "john@x.com", is_active: true } },
        { id: "a2", agent_type: "external", is_published: true, is_featured: false, profiles: { full_name: "Mary Lim", email: "mary@x.com", is_active: false } },
      ];
      testState.agentCount = 2;

      const result = await queryAgents({ isActive: false });
      expect(result.error).toBeNull();
      expect(result.data).toEqual([
        { id: "a2", fullName: "Mary Lim", email: "mary@x.com", isActive: false, isPublished: true, isFeatured: false, agentType: "external" },
      ]);
    });

    it("filters by nameContains case-insensitively", async () => {
      testState.agentRows = [
        { id: "a1", agent_type: "internal", is_published: true, is_featured: false, profiles: { full_name: "John Tan", email: null, is_active: true } },
        { id: "a2", agent_type: "internal", is_published: true, is_featured: false, profiles: { full_name: "Mary Lim", email: null, is_active: true } },
      ];
      testState.agentCount = 2;

      const result = await queryAgents({ nameContains: "john" });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].fullName).toBe("John Tan");
    });
  });

  describe("queryListings — titleContains injection safety", () => {
    it("passes titleContains through the typed .ilike() method, not a raw .or() filter string", async () => {
      // Regression test for docs/security/COPILOT_SECURITY_AUDIT.md — a raw
      // .or("title.ilike.%x%,property_name.ilike.%x%") string built by
      // interpolating user text lets a comma in that text inject an
      // unintended additional filter condition. .ilike(column, pattern)
      // passes the value as a proper query parameter instead, which is
      // not vulnerable to this class of injection.
      await queryListings({ titleContains: 'Marina%,status.eq.draft");--' });

      expect(testState.ilikeCalls).toEqual([{ column: "title", pattern: '%Marina%,status.eq.draft");--%' }]);
    });
  });

  describe("queryListings", () => {
    it("rejects priceMin greater than priceMax without querying the database", async () => {
      const result = await queryListings({ priceMin: 5_000_000, priceMax: 1_000_000 });
      expect(result).toEqual({ data: [], error: "priceMin cannot be greater than priceMax.", total: null });
    });

    it("maps rows, preferring property_name over title", async () => {
      testState.listingRows = [
        { id: "p1", title: "3BR Condo", property_name: "Marina Residence", status: "active", price: 2_500_000, monthly_rental: null, bedrooms: 3, is_featured: true },
      ];
      testState.listingCount = 1;

      const result = await queryListings({ status: "active", bedrooms: 3, priceMax: 3_000_000 });
      expect(result.error).toBeNull();
      expect(result.data).toEqual([
        { id: "p1", title: "Marina Residence", status: "active", price: 2_500_000, monthlyRental: null, bedrooms: 3, isFeatured: true },
      ]);
      expect(result.total).toBe(1);
    });
  });

  describe("queryApplications", () => {
    it("rejects dateFrom after dateTo without querying the database", async () => {
      const result = await queryApplications({ dateFrom: "2026-08-20", dateTo: "2026-08-01" });
      expect(result).toEqual({ data: [], error: "dateFrom cannot be after dateTo.", total: null });
    });

    it("maps application rows", async () => {
      testState.applicationRows = [
        { id: "app1", full_name: "Amelia Tan", email: "amelia@x.com", status: "pending", current_agency: null, created_at: "2026-08-01T00:00:00Z" },
      ];
      testState.applicationCount = 1;

      const result = await queryApplications({ status: "pending" });
      expect(result.data).toEqual([
        { id: "app1", fullName: "Amelia Tan", email: "amelia@x.com", status: "pending", currentAgency: null, createdAt: "2026-08-01T00:00:00Z" },
      ]);
    });
  });

  describe("pagination and limits", () => {
    it("defaults to a limit of 20 (range 0-19)", async () => {
      await queryListings({});
      expect(testState.lastRange).toEqual({ from: 0, to: 19 });
    });

    it("clamps an oversized limit to the maximum of 50", async () => {
      await queryListings({ limit: 500 });
      expect(testState.lastRange).toEqual({ from: 0, to: 49 });
    });

    it("applies offset for pagination", async () => {
      await queryListings({ limit: 10, offset: 20 });
      expect(testState.lastRange).toEqual({ from: 20, to: 29 });
    });

    it("ignores a negative offset", async () => {
      await queryListings({ limit: 10, offset: -5 });
      expect(testState.lastRange).toEqual({ from: 0, to: 9 });
    });
  });

  describe("error handling", () => {
    it("returns a structured error instead of throwing when the database call fails", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      (supabase.from as any).mockImplementationOnce(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn().mockResolvedValue({ data: null, error: { message: "connection reset" }, count: null }),
          })),
        })),
      }));

      const result = await queryListings({});
      expect(result).toEqual({ data: [], error: "connection reset", total: null });
    });
  });
});
