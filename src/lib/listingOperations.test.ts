import { beforeEach, describe, expect, it, vi } from "vitest";
import { createListing, type ListingFormFields } from "./listingOperations";

const baseFields: ListingFormFields = {
  transaction_type: "sale",
  property_type: "Condo",
  property_name: "Test Residences",
  unit_number: "#08-01",
  address: "1 Test Road",
  postal_code: "123456",
  district: "9",
  mrt_nearest: "",
  mrt_distance_m: "",
  title: "Test Residences — Prime District 9",
  title_zh: "",
  size_sqft: "1200",
  floor_level: "",
  bedrooms: 3,
  bathrooms: 2,
  car_parks: 1,
  tenure: "Freehold",
  top_year: "",
  facing: "",
  furnishing: "",
  price: "2500000",
  monthly_rental: "",
  price_on_enquiry: false,
  description_en: "A lovely test listing.",
  description_zh: "",
  virtual_tour_url: "",
  cobroke_enabled: false,
  cobroke_commission: "",
  owner_bottom_price: "",
  reason_for_selling: "",
  owner_urgency: "",
  private_notes: "",
};

const testState = vi.hoisted(() => ({
  insertedTables: [] as string[],
  propertyInsertPayload: null as any,
  agentFilesUpdatePayload: null as any,
  privateNotesPayload: null as any,
}));

vi.mock("@/integrations/supabase/client", () => {
  const property = { id: "property-1" };

  const from = vi.fn((table: string) => {
    testState.insertedTables.push(table);

    if (table === "properties") {
      return {
        insert: vi.fn((payload: any) => {
          testState.propertyInsertPayload = payload;
          return {
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: property, error: null }),
            })),
          };
        }),
      };
    }

    if (table === "property_images" || table === "property_floor_plans") {
      return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
    }

    if (table === "property_private_notes") {
      return {
        insert: vi.fn((payload: any) => {
          testState.privateNotesPayload = payload;
          return Promise.resolve({ data: null, error: null });
        }),
      };
    }

    if (table === "agent_files") {
      return {
        update: vi.fn((payload: any) => {
          testState.agentFilesUpdatePayload = payload;
          return {
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          };
        }),
      };
    }

    return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
  });

  return {
    supabase: {
      from,
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/uploaded.jpg" } })),
        })),
      },
    },
  };
});

describe("createListing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.insertedTables = [];
    testState.propertyInsertPayload = null;
    testState.agentFilesUpdatePayload = null;
    testState.privateNotesPayload = null;
  });

  it("creates the property row scoped to the given owner, not the caller", async () => {
    const { data, error } = await createListing({
      ownerId: "owner-agent-id",
      createdByUserId: "admin-user-id",
      isDraft: false,
      fields: baseFields,
      photos: [{ url: "https://example.com/photo1.jpg", is_cover: true }],
      floorPlans: [],
    });

    expect(error).toBeNull();
    expect(data).toEqual({ id: "property-1" });
    expect(testState.propertyInsertPayload).toMatchObject({
      agent_id: "owner-agent-id",
      status: "active",
      title: "Test Residences — Prime District 9",
    });
  });

  it("saves as draft when isDraft is true", async () => {
    await createListing({
      ownerId: "owner-agent-id",
      createdByUserId: "admin-user-id",
      isDraft: true,
      fields: baseFields,
      photos: [],
      floorPlans: [],
    });

    expect(testState.propertyInsertPayload).toMatchObject({ status: "draft" });
  });

  it("inserts photo and floor plan rows against the newly created property", async () => {
    await createListing({
      ownerId: "owner-agent-id",
      createdByUserId: "admin-user-id",
      isDraft: false,
      fields: baseFields,
      photos: [
        { url: "https://example.com/photo1.jpg", is_cover: true },
        { url: "https://example.com/photo2.jpg", is_cover: false },
      ],
      floorPlans: [{ url: "https://example.com/plan1.jpg", label: "Level 1" }],
    });

    expect(testState.insertedTables).toContain("property_images");
    expect(testState.insertedTables).toContain("property_floor_plans");
  });

  it("only writes private notes when at least one note field is present", async () => {
    await createListing({
      ownerId: "owner-agent-id",
      createdByUserId: "admin-user-id",
      isDraft: false,
      fields: baseFields,
      photos: [],
      floorPlans: [],
    });
    expect(testState.privateNotesPayload).toBeNull();

    await createListing({
      ownerId: "owner-agent-id",
      createdByUserId: "admin-user-id",
      isDraft: false,
      fields: { ...baseFields, private_notes: "Owner is motivated to sell quickly." },
      photos: [],
      floorPlans: [],
    });
    expect(testState.privateNotesPayload).toMatchObject({
      agent_id: "admin-user-id",
      private_notes: "Owner is motivated to sell quickly.",
    });
  });

  it("links the pre-filled folder to the new listing when provided", async () => {
    await createListing({
      ownerId: "owner-agent-id",
      createdByUserId: "admin-user-id",
      isDraft: false,
      fields: baseFields,
      photos: [],
      floorPlans: [],
      linkFolderName: "123 Test Road",
    });

    expect(testState.agentFilesUpdatePayload).toEqual({ property_id: "property-1" });
  });

  it("does not touch agent_files when no folder is being linked", async () => {
    await createListing({
      ownerId: "owner-agent-id",
      createdByUserId: "admin-user-id",
      isDraft: false,
      fields: baseFields,
      photos: [],
      floorPlans: [],
    });

    expect(testState.insertedTables).not.toContain("agent_files");
  });
});
