import { describe, expect, it } from "vitest";
import { extractContract } from "../../drafting";

describe("extractContract", () => {
  it("detects parties, conditions, time references, nouns, and derived fields from a brief", () => {
    const extracted = extractContract(
      "The buyer purchases goods from the seller. The shipper delivers to the receiver. Payment is due 30 days after delivery. Inspection must be passed and accepted or rejected before any penalty applies."
    );

    expect(extracted.parties).toEqual(["buyer", "seller", "shipper", "receiver"]);
    expect(extracted.conditionWords).toEqual(["passed", "accepted", "rejected"]);
    expect(extracted.timeReferences).toEqual(["days", "due", "after delivery"]);
    expect(extracted.contractNouns).toEqual(["goods", "delivery", "payment", "penalty", "inspection"]);
    expect(extracted.fields.map((field) => field.name)).toEqual([
      "buyer",
      "seller",
      "shipper",
      "receiver",
      "goodsDescription",
      "deliveryDate",
      "paymentDueDays",
      "penaltyDescription",
      "inspectionPassed",
      "deliveryAccepted",
    ]);
  });

  it("falls back to a summary field for a generic brief", () => {
    const extracted = extractContract("This is a very simple agreement.");

    expect(extracted.fields).toHaveLength(1);
    expect(extracted.fields[0].name).toBe("agreementSummary");
  });
});
