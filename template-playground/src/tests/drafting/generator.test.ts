import { describe, expect, it } from "vitest";
import { extractContract, generateDraftTemplate } from "../../drafting";

describe("generateDraftTemplate", () => {
  it("creates deterministic template, model, and sample data from extracted content", () => {
    const extracted = extractContract(
      "The buyer purchases goods from the seller. Payment is due 15 days after delivery and inspection must be passed."
    );
    const draft = generateDraftTemplate(extracted);

    expect(draft.contractName).toBe("GoodsDelivery");
    expect(draft.templateText).toContain("{{buyer}}");
    expect(draft.templateText).toContain("{{seller}}");
    expect(draft.templateText).toContain("{{goodsDescription}}");
    expect(draft.templateText).toContain("{{paymentDueDays}}");
    expect(draft.templateText).toContain("{{inspectionPassed}}");
    expect(draft.modelText).toContain("@template");
    expect(draft.modelText).toContain("concept GoodsDelivery");
    expect(draft.modelText).toContain("o String buyer");
    expect(draft.modelText).toContain("o Integer paymentDueDays");
    expect(draft.sampleData).toMatchObject({
      $class: "org.accordproject.agenticdrafting@0.0.1.GoodsDelivery",
      buyer: "Buyer",
      seller: "Seller",
      paymentDueDays: 30,
      inspectionPassed: true,
    });
  });
});
