import { beforeEach, describe, expect, it, vi } from "vitest";
import { executePublishApprovedListings, isListingPublishable, previewPublishApprovedListings } from "./workflows";

const testState = vi.hoisted(() => ({
  requireAdminResult: { userId: "admin-1", error: null as string | null },
  propertyRows: [] as any[],
  photoRows: [] as any[],
  setListingStatusResults: new Map<string, { error: string | null }>(),
  activityLogInserts: [] as any[],
}));

vi.mock("@/components/admin/adminGuards", () => ({
  requireAdmin: vi.fn(() => Promise.resolve(testState.requireAdminResult)),
}));

vi.mock("@/components/admin/adminOperations", () => ({
  setListingStatus: vi.fn((id: string) =>
    Promise.resolve(testState.setListingStatusResults.get(id) ?? { error: null })
  ),
  logAdminActivity: vi.fn((...args: any[]) => {
    testState.activityLogInserts.push(args);
    return Promise.resolve();
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "properties") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn().mockImplementation(() => Promise.resolve({ data: testState.propertyRows, error: null })),
              })),
            })),
          })),
        };
      }
      if (table === "property_images") {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockImplementation(() => Promise.resolve({ data: testState.photoRows, error: null })),
          })),
        };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    }),
  },
}));

const readyRow = {
  id: "p1",
  title: "3BR Condo",
  property_name: "Marina Residence",
  type: "Condo",
  district: 9,
  size_sqft: 1200,
  description_en: "A".repeat(120),
  price: 2_500_000,
  monthly_rental: null,
  price_on_enquiry: false,
};

const notReadyRow = {
  id: "p2",
  title: "Studio",
  property_name: null,
  type: "Condo",
  district: 5,
  size_sqft: null, // missing -> not ready
  description_en: "Too short.",
  price: null,
  monthly_rental: null,
  price_on_enquiry: false,
};

describe("isListingPublishable", () => {
  it("passes a fully complete listing with at least one photo", () => {
    expect(isListingPublishable(readyRow, 1)).toEqual({ ok: true, reasons: [] });
  });

  it("reports every missing requirement, not just the first", () => {
    const result = isListingPublishable(notReadyRow, 0);
    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining(["no photos", "missing size (sqft)", "description under 100 characters", "no price set"])
    );
  });

  it("accepts price_on_enquiry as satisfying the price requirement", () => {
    const result = isListingPublishable({ ...readyRow, price: null, price_on_enquiry: true }, 1);
    expect(result.ok).toBe(true);
  });
});

describe("previewPublishApprovedListings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.requireAdminResult = { userId: "admin-1", error: null };
    testState.propertyRows = [];
    testState.photoRows = [];
  });

  it("requires admin permission before querying anything", async () => {
    testState.requireAdminResult = { userId: null, error: "Forbidden — admin role required." };
    const result = await previewPublishApprovedListings();
    expect(result).toEqual({ data: null, error: "Forbidden — admin role required." });
  });

  it("splits candidates into ready and notReady based on isListingPublishable", async () => {
    testState.propertyRows = [readyRow, notReadyRow];
    testState.photoRows = [{ property_id: "p1" }];

    const result = await previewPublishApprovedListings();
    expect(result.error).toBeNull();
    expect(result.data?.ready.map((c) => c.id)).toEqual(["p1"]);
    expect(result.data?.notReady.map((c) => c.id)).toEqual(["p2"]);
    expect(result.data?.notReady[0].reasons).toContain("no photos");
  });

  it("returns empty lists, not an error, when nothing is approved and unpublished", async () => {
    testState.propertyRows = [];
    const result = await previewPublishApprovedListings();
    expect(result).toEqual({ data: { ready: [], notReady: [] }, error: null });
  });
});

describe("executePublishApprovedListings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.requireAdminResult = { userId: "admin-1", error: null };
    testState.propertyRows = [];
    testState.photoRows = [];
    testState.setListingStatusResults = new Map();
    testState.activityLogInserts = [];
  });

  it("refuses to run without explicit confirmation", async () => {
    // @ts-expect-error deliberately testing the runtime guard against a bad caller
    const result = await executePublishApprovedListings({ confirmed: false });
    expect(result.error).toMatch(/confirmation/i);
  });

  it("re-derives the candidate set at execution time rather than trusting a stale list", async () => {
    testState.propertyRows = [readyRow];
    testState.photoRows = [{ property_id: "p1" }];

    await executePublishApprovedListings({ confirmed: true });

    const { supabase } = await import("@/integrations/supabase/client");
    expect(supabase.from).toHaveBeenCalledWith("properties");
  });

  it("publishes ready listings, skips not-ready ones, and reports both", async () => {
    testState.propertyRows = [readyRow, notReadyRow];
    testState.photoRows = [{ property_id: "p1" }];

    const result = await executePublishApprovedListings({ confirmed: true });

    expect(result.error).toBeNull();
    expect(result.data?.succeeded.map((s) => s.id)).toEqual(["p1"]);
    expect(result.data?.skipped.map((s) => s.id)).toEqual(["p2"]);
    expect(result.data?.failed).toEqual([]);
  });

  it("reports per-item failures without aborting the rest of the batch", async () => {
    const readyRow2 = { ...readyRow, id: "p3", title: "Another", property_name: "Sunset Towers" };
    testState.propertyRows = [readyRow, readyRow2];
    testState.photoRows = [{ property_id: "p1" }, { property_id: "p3" }];
    testState.setListingStatusResults.set("p1", { error: "connection reset" });

    const result = await executePublishApprovedListings({ confirmed: true });

    expect(result.data?.failed.map((f) => f.id)).toEqual(["p1"]);
    expect(result.data?.succeeded.map((s) => s.id)).toEqual(["p3"]);
  });

  it("calls onProgress once per ready listing, in order", async () => {
    const readyRow2 = { ...readyRow, id: "p3", title: "Another", property_name: "Sunset Towers" };
    testState.propertyRows = [readyRow, readyRow2];
    testState.photoRows = [{ property_id: "p1" }, { property_id: "p3" }];

    const progressCalls: Array<[number, number]> = [];
    await executePublishApprovedListings({ confirmed: true, onProgress: (done, total) => progressCalls.push([done, total]) });

    expect(progressCalls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it("writes one batch-summary audit entry in addition to setListingStatus's own per-item logging", async () => {
    testState.propertyRows = [readyRow];
    testState.photoRows = [{ property_id: "p1" }];

    await executePublishApprovedListings({ confirmed: true });

    expect(testState.activityLogInserts).toHaveLength(1);
    expect(testState.activityLogInserts[0][0]).toMatch(/Bulk publish/i);
  });

  it("requires admin permission before running", async () => {
    testState.requireAdminResult = { userId: null, error: "Not authenticated." };
    const result = await executePublishApprovedListings({ confirmed: true });
    expect(result).toEqual({ data: null, error: "Not authenticated." });
  });
});
