import { createDraftFromBrief } from "./src/drafting";

const brief = "The buyer purchases goods from the seller. Delivery is 7 days after payment, with a late penalty of $500 per day.";

console.log("=== AGENTIC DRAFTING PIPELINE DEMO ===");
console.log("\n[INPUT BRIEF]");
console.log(brief);

const result = createDraftFromBrief(brief);

console.log("\n[EXTRACTED DATA]");
console.log(JSON.stringify(result.extracted.fields, null, 2));

console.log("\n[GENERATED TEMPLATE]");
console.log(result.draft.templateText);

console.log("\n[GENERATED MODEL]");
console.log(result.draft.modelText);

console.log("\n[VALIDATION REPORT]");
console.log(`IsValid: ${result.validation.isValid}`);
result.validation.issues.forEach(issue => {
  console.log(`- [${issue.severity.toUpperCase()}] ${issue.message}`);
});
console.log("======================================");
