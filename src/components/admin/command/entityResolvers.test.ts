import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAgentByName, resolveListingByTitle } from "./entityResolvers";

const testState = vi.hoisted(() => ({
  listings: [] as Array<{ id: string; title: string; property_name: string | null; status: string }>,
  agents: [] as Array<{ id: string; profiles: { full_name: string | null; is_active: boolean | null } | null }>,
  listingById: null as { id: string; title: string; property_name: string | null; status: string } | null,
  agentById: null as { id: string; profiles: { full_name: string | null; is_active: boolean | null } | null } | null,
}));

function ilikeMatch(rows: any[], column: string, pattern: string) {
  const needle = pattern.replace(/^%/, "").replace(/%$/, "").toLowerCase();
  return rows.filter((row) => String(row[column] ?? "").toLowerCase().includes(needle));
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "properties") {
        return {
          select: vi.fn(() => ({
            ilike: vi.fn((column: string, pattern: string) => ({
              limit: vi.fn().mockImplementation(() =>
                Promise.resolve({ data: ilikeMatch(testState.listings, column, pattern), error: null })
              ),
            })),
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: testState.listingById, error: null })),
            })),
          })),
        };
      }
      if (table === "agent_profiles") {
        return {
          select: vi.fn(() => ({
            limit: vi.fn().mockImplementation(() => Promise.resolve({ data: testState.agents, error: null })),
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: testState.agentById, error: null })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    }),
  },
}));

describe("resolveListingByTitle", () => {
  beforeEach(() => {
    testState.listings = [];
    testState.listingById = null;
  });

  it("resolves a UUID query directly by ID, skipping the title search", async () => {
    const uuid = "11111111-2222-4333-8444-555555555555";
    testState.listingById = { id: uuid, title: "Some Listing", property_name: "Marina Residence", status: "draft" };

    const result = await resolveListingByTitle(uuid);
    expect(result).toEqual({ status: "single", entity: { id: uuid, title: "Marina Residence", status: "draft" } });
  });

  it("falls back to title search when a UUID-looking query has no direct row", async () => {
    const uuid = "11111111-2222-4333-8444-555555555555";
    testState.listingById = null;
    testState.listings = [{ id: "p1", title: uuid, property_name: null, status: "active" }];

    const result = await resolveListingByTitle(uuid);
    expect(result).toEqual({ status: "single", entity: { id: "p1", title: uuid, status: "active" } });
  });

  it("returns none for an empty query", async () => {
    expect(await resolveListingByTitle("")).toEqual({ status: "none" });
    expect(await resolveListingByTitle("   ")).toEqual({ status: "none" });
  });

  it("returns a single match, preferring property_name over title", async () => {
    testState.listings = [{ id: "p1", title: "P1024 — 3 Bed Condo", property_name: "Marina Residence", status: "draft" }];

    const result = await resolveListingByTitle("Marina Residence");
    expect(result).toEqual({ status: "single", entity: { id: "p1", title: "Marina Residence", status: "draft" } });
  });

  it("falls back to title when property_name is null", async () => {
    testState.listings = [{ id: "p2", title: "Marina Residence Penthouse", property_name: null, status: "active" }];

    const result = await resolveListingByTitle("Marina Residence");
    expect(result).toEqual({ status: "single", entity: { id: "p2", title: "Marina Residence Penthouse", status: "active" } });
  });

  it("returns ambiguous candidates when multiple rows match", async () => {
    testState.listings = [
      { id: "p1", title: "Marina Residence Tower A", property_name: null, status: "active" },
      { id: "p2", title: "Marina Residence Tower B", property_name: null, status: "draft" },
    ];

    const result = await resolveListingByTitle("Marina Residence");
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates).toHaveLength(2);
    }
  });

  it("returns none when no rows match", async () => {
    testState.listings = [];
    expect(await resolveListingByTitle("Nonexistent Tower")).toEqual({ status: "none" });
  });

  it("treats a comma in the query as a literal character, not a filter-injection delimiter", async () => {
    // Regression test for docs/security/COPILOT_SECURITY_AUDIT.md — a raw
    // .or() filter string would let a comma in the query text inject an
    // unintended second filter condition. The current implementation uses
    // .ilike(column, pattern), which passes the value as a proper query
    // parameter — a comma is just a character to match against, not DSL
    // syntax, so a query containing one legitimately matches nothing here
    // rather than unexpectedly broadening or erroring.
    testState.listings = [{ id: "p1", title: "Marina Residence", property_name: null, status: "active" }];
    const result = await resolveListingByTitle('Marina%,status.eq.draft");--');
    expect(result).toEqual({ status: "none" });
  });
});

describe("resolveAgentByName", () => {
  beforeEach(() => {
    testState.agents = [];
    testState.agentById = null;
  });

  it("resolves a UUID query directly by ID, skipping the name search", async () => {
    const uuid = "11111111-2222-4333-8444-555555555555";
    testState.agentById = { id: uuid, profiles: { full_name: "John Tan", is_active: true } };

    const result = await resolveAgentByName(uuid);
    expect(result).toEqual({ status: "single", entity: { id: uuid, fullName: "John Tan", isActive: true } });
  });

  it("returns none for an empty query", async () => {
    expect(await resolveAgentByName("")).toEqual({ status: "none" });
  });

  it("matches case-insensitively against the full name", async () => {
    testState.agents = [{ id: "a1", profiles: { full_name: "John Tan", is_active: true } }];

    const result = await resolveAgentByName("john tan");
    expect(result).toEqual({ status: "single", entity: { id: "a1", fullName: "John Tan", isActive: true } });
  });

  it("returns ambiguous when multiple agents share a substring", async () => {
    testState.agents = [
      { id: "a1", profiles: { full_name: "John Tan", is_active: true } },
      { id: "a2", profiles: { full_name: "Johnny Tanaka", is_active: false } },
    ];

    const result = await resolveAgentByName("john");
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates.map((c) => c.fullName)).toEqual(["John Tan", "Johnny Tanaka"]);
    }
  });

  it("returns none when nothing matches", async () => {
    testState.agents = [{ id: "a1", profiles: { full_name: "John Tan", is_active: true } }];
    expect(await resolveAgentByName("Mary Lim")).toEqual({ status: "none" });
  });

  it("skips agents with no linked profile row instead of throwing", async () => {
    testState.agents = [{ id: "a1", profiles: null }];
    expect(await resolveAgentByName("John")).toEqual({ status: "none" });
  });
});
