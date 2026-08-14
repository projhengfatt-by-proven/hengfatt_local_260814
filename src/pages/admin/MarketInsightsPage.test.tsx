import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketInsightsPage from "./MarketInsightsPage";

const testData = vi.hoisted(() => {
  const insight = {
    id: "insight-1",
    title: "Singapore Luxury Property Market 2026",
    category: "MARKET OUTLOOK",
    description: "Prime property is regaining momentum in 2026.",
    body: "Initial draft body.",
    file_url: null,
    cover_url: null,
    is_featured: false,
    display_order: 1,
    period: "14 Aug 2026",
    read_time: "7 min read",
    published_at: null,
    created_at: "2026-08-14T00:00:00Z",
  };

  const draft = {
    title: "Singapore Luxury Property Market 2026",
    category: "MARKET OUTLOOK",
    description: "Singapore's prime market is regaining momentum.",
    body: "Full market insight article body.",
    file_url: "",
    cover_url: "",
    is_featured: true,
    display_order: 2,
    period: "14 Aug 2026",
    read_time: "7 min read",
    published: false,
    sourceNotes: "Smoke test insight draft.",
  };

  return {
    insight,
    draft,
    navigate: vi.fn(),
    getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "insight-token" } } }),
    fetchMarketInsights: vi.fn().mockResolvedValue({ data: [insight], error: null }),
    saveMarketInsight: vi.fn().mockResolvedValue({ data: insight, error: null }),
    toast: vi.fn(),
    generateMarketInsightDraft: vi.fn().mockResolvedValue({
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
    auth: {
      getSession: testData.getSession,
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: testData.toast,
}));

vi.mock("@/lib/marketInsights", async () => {
  const actual = await vi.importActual<typeof import("@/lib/marketInsights")>("@/lib/marketInsights");
  return {
    ...actual,
    fetchMarketInsights: testData.fetchMarketInsights,
    saveMarketInsight: testData.saveMarketInsight,
  };
});

vi.mock("@/lib/marketInsightCopilot", async () => {
  const actual = await vi.importActual<typeof import("@/lib/marketInsightCopilot")>("@/lib/marketInsightCopilot");
  return {
    ...actual,
    generateMarketInsightDraft: testData.generateMarketInsightDraft,
  };
});

describe("MarketInsightsPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("generates a market insight draft, applies it to the form, and updates list actions", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/insights"]}>
        <MarketInsightsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Singapore Luxury Property Market 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByText(testData.insight.title).closest("button") as HTMLButtonElement);
    await waitFor(() => expect(testData.navigate).toHaveBeenCalledWith("/admin/insights/insight-1"));

    fireEvent.change(screen.getByLabelText(/admin brief/i), {
      target: { value: "Write the 2026 luxury market insight article." },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate draft/i }));

    expect(await screen.findByText("Draft ready")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /apply to form/i }));

    await waitFor(() => expect(screen.getByLabelText(/title/i)).toHaveValue("Singapore Luxury Property Market 2026"));
    expect(screen.getByLabelText(/title/i)).toHaveValue("Singapore Luxury Property Market 2026");
    expect(sessionStorage.getItem("aria_prefill")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^publish$/i }));
    await waitFor(() => expect(testData.saveMarketInsight).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /^feature$/i }));
    await waitFor(() => expect(testData.saveMarketInsight).toHaveBeenCalledTimes(2));
  });
});
