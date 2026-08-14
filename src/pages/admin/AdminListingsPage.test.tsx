import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminListingsPage from "./AdminListingsPage";

const testData = vi.hoisted(() => {
  const listing = {
    id: "listing-1",
    title: "Skyline Residences",
    title_zh: null,
    property_name: "Skyline Residences",
    type: "Condo",
    district: 9,
    price: 2500000,
    monthly_rental: null,
    price_on_enquiry: false,
    status: "active",
    is_featured: false,
    view_count: 128,
    slug: "skyline-residences",
    created_at: "2026-08-14T00:00:00Z",
    agent_profiles: {
      profiles: {
        full_name: "Amelia Tan",
      },
    },
    property_images: [
      {
        url: "https://example.com/cover.jpg",
        is_cover: true,
      },
    ],
  };

  const draft = {
    prefill: {
      title: "Skyline Residences",
      property_name: "Skyline Residences",
      price: 2500000,
      district: 9,
      property_type: "Condo",
    },
    sourceNotes: "Smoke test listing draft.",
    suggestedOwnerName: "Amelia Tan",
    suggestedOwnerEmail: "amelia@example.com",
    suggestedOwnerId: "agent-1",
  };

  const selectProperties = vi.fn(() => ({
    order: vi.fn().mockResolvedValue({ data: [listing], error: null }),
  }));

  return {
    listing,
    draft,
    selectProperties,
    navigate: vi.fn(),
    getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "listing-token" } } }),
    invoke: vi.fn(),
    setListingFeatured: vi.fn().mockResolvedValue({ error: null }),
    setListingStatus: vi.fn().mockResolvedValue({ error: null }),
    toast: vi.fn(),
    generateListingDraft: vi.fn().mockResolvedValue({
      data: draft,
      error: null,
      rawText: JSON.stringify(draft),
    }),
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => testData.navigate,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "properties") return { select: testData.selectProperties };
      return { select: vi.fn() };
    }),
    auth: {
      getSession: testData.getSession,
    },
    functions: {
      invoke: testData.invoke,
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: testData.toast,
}));

vi.mock("@/components/admin/adminOperations", () => ({
  setListingFeatured: testData.setListingFeatured,
  setListingStatus: testData.setListingStatus,
}));

vi.mock("@/lib/listingCopilot", async () => {
  const actual = await vi.importActual<typeof import("@/lib/listingCopilot")>("@/lib/listingCopilot");
  return {
    ...actual,
    generateListingDraft: testData.generateListingDraft,
  };
});

describe("AdminListingsPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("generates a listing draft, applies it to the create form, and updates listing controls", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/listings"]}>
        <AdminListingsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Skyline Residences")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/paste the property details/i), {
      target: { value: "Create a 3-bed condo listing in District 9 for Skyline Residences." },
    });

    fireEvent.click(screen.getByRole("button", { name: /generate draft/i }));
    expect(await screen.findByText("Draft ready")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /apply to form/i }));

    await waitFor(() => expect(testData.navigate).toHaveBeenCalledWith("/admin/listings/new?admin=1"));
    expect(sessionStorage.getItem("aria_prefill")).toContain("Skyline Residences");

    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(testData.setListingFeatured).toHaveBeenCalledWith("listing-1", true));
  });
});
