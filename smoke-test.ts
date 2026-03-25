// Smoke test for core/drafting logic-aware pipeline
import { createDraftFromBrief } from "./core/drafting/index";

const brief = "Buyer agrees to pay seller within 10 days after delivery. Unless inspection is passed, no payment shall be made.";

const result = createDraftFromBrief(brief);

console.log("=== LOGIC-AWARE PIPELINE SMOKE TEST ===\n");

console.log("[EXTRACTED OBLIGATIONS]");
result.extracted.obligations.forEach(o =>
  console.log(`  • ${o.actor} → ${o.action}${o.target ? " → " + o.target : ""}`)
);

console.log("\n[EXTRACTED CONDITIONS]");
result.extracted.conditions.forEach(c =>
  console.log(`  • [${c.type}] ${c.expression}`)
);

console.log("\n[TEMPORAL CONSTRAINTS]");
result.extracted.temporalConstraints.forEach(t =>
  console.log(`  • ${t.relation} ${t.value ?? ""}${t.unit ? " " + t.unit : ""} ${t.event ? "after " + t.event : ""} (raw: "${t.raw}")`)
);

console.log("\n[GENERATED TEMPLATE]\n" + result.draft.templateText);
console.log("[GENERATED MODEL]\n" + result.draft.modelText);

console.log("[VALIDATION REPORT]");
console.log(`  isValid: ${result.validation.isValid}`);
result.validation.issues.forEach(i =>
  console.log(`  • [${i.severity.toUpperCase()}] ${i.message}`)
);
