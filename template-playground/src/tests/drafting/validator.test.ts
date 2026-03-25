import { describe, expect, it } from "vitest";
import { extractContract, generateDraftTemplate, validateDraftTemplate } from "../../drafting";

describe("validateDraftTemplate", () => {
  it("marks a matching generated draft as valid", () => {
    const draft = generateDraftTemplate(
      extractContract(
        "The buyer purchases goods from the seller. Payment is due 30 days after delivery and inspection must be passed."
      )
    );

    const report = validateDraftTemplate(draft);

    expect(report.isValid).toBe(true);
    expect(report.missingInModel).toEqual([]);
    expect(report.unusedModelFields).toEqual([]);
    expect(report.issues).toEqual([
      {
        severity: "info",
        message: "The generated template and model are structurally aligned.",
      },
    ]);
  });

  it("reports missing and unused fields for an explainably invalid draft", () => {
    const draft = generateDraftTemplate(
      extractContract("The buyer purchases goods from the seller and payment is due 30 days after delivery.")
    );

    const invalidDraft = {
      ...draft,
      modelText: draft.modelText.replace("  o String goodsDescription\n", "  o String orphanedField\n"),
    };

    const report = validateDraftTemplate(invalidDraft);

    expect(report.isValid).toBe(false);
    expect(report.missingInModel).toContain("goodsDescription");
    expect(report.unusedModelFields).toContain("orphanedField");
    expect(report.issues.some((issue) => issue.severity === "error")).toBe(true);
    expect(report.issues.some((issue) => issue.severity === "warning")).toBe(true);
  });
});
