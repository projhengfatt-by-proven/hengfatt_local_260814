import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgentsListPage from "./AgentsListPage";

const testData = vi.hoisted(() => {
  const mockAgent = {
    id: "agent-1",
    cea_no: "R123456A",
    position: "Senior Property Consultant",
    agent_type: "internal",
    is_published: true,
    is_featured: true,
    display_order: 1,
    profiles: {
      full_name: "Existing Agent",
      avatar_url: null,
      email: "agent@example.com",
      phone: "+65 8888 8888",
      is_active: true,
      password_set_at: "2026-08-01T00:00:00Z",
    },
  };

  const mockDraft = {
    fullName: "Amelia Tan",
    email: "amelia@example.com",
    phone: "+65 9123 4567",
    preferredLang: "en" as const,
    ceaNo: "R654321B",
    yearsExperience: 8,
    agentType: "external" as const,
    position: "Senior Residential Specialist",
    specialisations: ["Condo", "Landed"],
    languages: ["English", "Mandarin"],
    linkedinUrl: "",
    displayOrder: 12,
    bioEn: "Experienced residential specialist.",
    bioZh: "",
    sourceNotes: "Fake draft for smoke test.",
  };

  const selectAgentProfiles = vi.fn(() => ({
    order: vi.fn().mockResolvedValue({ data: [mockAgent], error: null }),
  }));

  const selectUserRoles = vi.fn(() => ({
    in: vi.fn().mockResolvedValue({ data: [{ user_id: mockAgent.id, role: "admin" }], error: null }),
  }));

  return { mockAgent, mockDraft, selectAgentProfiles, selectUserRoles };
});

vi.mock("@/integrations/supabase/client", () => ({
    supabase: {
      from: vi.fn((table: string) => {
      if (table === "agent_profiles") return { select: testData.selectAgentProfiles };
      if (table === "user_roles") return { select: testData.selectUserRoles };
      return { select: vi.fn() };
      }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "test-token" } } }),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/components/admin/adminOperations", () => ({
  resendAgentInvite: vi.fn().mockResolvedValue({ error: null }),
  setAgentActive: vi.fn().mockResolvedValue({ error: null }),
  setAgentVisibility: vi.fn().mockResolvedValue({ error: null }),
  setAgentAdminRole: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/agentInviteCopilot", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agentInviteCopilot")>("@/lib/agentInviteCopilot");
  return {
    ...actual,
    generateAgentInviteDraft: vi.fn().mockResolvedValue({
      data: testData.mockDraft,
      error: null,
      rawText: JSON.stringify(testData.mockDraft),
    }),
  };
});

describe("AgentsListPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.body.innerHTML = "";
    vi.clearAllMocks();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("builds an invite draft and pre-fills the create form", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/agents"]}>
        <AgentsListPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(testData.mockAgent.profiles.full_name)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/example: create an external agent invite/i), {
      target: { value: "Create an external agent invite for Amelia Tan" },
    });

    fireEvent.click(screen.getByRole("button", { name: /generate draft/i }));

    expect(await screen.findByText(testData.mockDraft.fullName)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /apply to form/i }));

    expect(await screen.findByText(/apply this draft to the invite form/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /apply draft/i }));

    await waitFor(() => expect(screen.getByDisplayValue(testData.mockDraft.fullName)).toBeInTheDocument());

    const fullNameInput = screen.getByLabelText(/full name/i) as HTMLInputElement;
    expect(fullNameInput.value).toBe(testData.mockDraft.fullName);
    await waitFor(() => expect(fullNameInput).toHaveFocus());
    expect(sessionStorage.getItem("agent_invite_prefill")).toBe(null);
  });
});
