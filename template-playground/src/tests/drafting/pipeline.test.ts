import { describe, it, expect } from "vitest";
import { extractContract, generateDraftTemplate, validateDraftTemplate } from "../../drafting";

describe("Drafting Pipeline Integration", () => {
  it("processes a simple brief into a valid draft template", () => {
    const brief = "Buyer pays seller within 10 days after delivery";

    const extracted = extractContract(brief);
    const draft = generateDraftTemplate(extracted);
    const report = validateDraftTemplate(draft);

    // The current implementation is deterministic and should be valid
    expect(report.isValid).toBe(true);
    expect(report.issues.some(issue => issue.severity === "info")).toBe(true);
    
    // Check key fields were extracted
    expect(extracted.parties).toContain("buyer");
    expect(extracted.parties).toContain("seller");
    expect(extracted.timeReferences).toContain("days");
    expect(extracted.timeReferences).toContain("after delivery");
  });
});
