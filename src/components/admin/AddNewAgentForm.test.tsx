import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AddNewAgentForm from "./AddNewAgentForm";

const testData = vi.hoisted(() => ({
  createAgent: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: testData.toast,
}));

vi.mock("@/components/admin/adminOperations", () => ({
  createAgent: testData.createAgent,
}));

describe("AddNewAgentForm", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("submits the form through the shared createAgent action, not a direct Supabase call", async () => {
    testData.createAgent.mockResolvedValue({ error: null, data: { agent_id: "new-agent-1" } });

    render(<AddNewAgentForm />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane Lim" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "Jane.Lim@Example.com" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "+65 9000 0000" } });

    fireEvent.click(screen.getByRole("button", { name: /create agent & send invite/i }));

    await waitFor(() => expect(testData.createAgent).toHaveBeenCalledTimes(1));

    expect(testData.createAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "Jane Lim",
        email: "jane.lim@example.com",
        phone: "+65 9000 0000",
        agent_type: "external",
        preferred_lang: "en",
      })
    );

    await waitFor(() =>
      expect(testData.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Agent invited!" })
      )
    );

    // Form resets after a successful submit.
    expect((screen.getByLabelText(/full name/i) as HTMLInputElement).value).toBe("");
  });

  it("surfaces an action-layer error without resetting the form", async () => {
    testData.createAgent.mockResolvedValue({ error: "Forbidden — admin role required." });

    render(<AddNewAgentForm />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane Lim" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane.lim@example.com" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "+65 9000 0000" } });

    fireEvent.click(screen.getByRole("button", { name: /create agent & send invite/i }));

    await waitFor(() =>
      expect(testData.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Error", description: "Forbidden — admin role required." })
      )
    );

    expect((screen.getByLabelText(/full name/i) as HTMLInputElement).value).toBe("Jane Lim");
  });

  it("rejects an invalid CEA number before calling createAgent", async () => {
    render(<AddNewAgentForm />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane Lim" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane.lim@example.com" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "+65 9000 0000" } });
    fireEvent.change(screen.getByLabelText(/cea registration/i), { target: { value: "BADCEA" } });

    fireEvent.click(screen.getByRole("button", { name: /create agent & send invite/i }));

    await waitFor(() =>
      expect(testData.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid CEA No." }))
    );
    expect(testData.createAgent).not.toHaveBeenCalled();
  });
});
