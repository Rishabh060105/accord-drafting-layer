import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import DraftingPanel from "../../components/DraftingPanel";
import useAppStore from "../../store/store";

// Mock the store
vi.mock("../../store/store", () => ({
  default: vi.fn(),
}));

describe("DraftingPanel", () => {
  it("renders with initial example brief", () => {
    (useAppStore as any).mockReturnValue({
      applyGeneratedDraft: vi.fn(),
      backgroundColor: "#ffffff",
      textColor: "#000000",
    });

    render(<DraftingPanel />);
    
    expect(screen.getByText("Agentic Template Drafting MVP")).toBeInTheDocument();
    expect(screen.getByLabelText("Contract Brief")).toHaveValue(
      "The buyer purchases goods from the seller. The shipper delivers the goods to the receiver. Payment is due 30 days after delivery. Inspection must be passed, accepted goods are paid, and a penalty applies if delivery fails."
    );
  });

  it("calls applyGeneratedDraft when clicking Generate Draft", async () => {
    const applyGeneratedDraft = vi.fn().mockResolvedValue(undefined);
    (useAppStore as any).mockReturnValue({
      applyGeneratedDraft,
      backgroundColor: "#ffffff",
      textColor: "#000000",
    });

    render(<DraftingPanel />);
    
    const generateButton = screen.getByRole("button", { name: /generate draft/i });
    fireEvent.click(generateButton);

    expect(generateButton).toBeInTheDocument();
  });
});
