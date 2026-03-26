import { createDraftFromBrief } from "./core/drafting/index";

function run(label: string, brief: string) {
  const { extracted, draft, validation } = createDraftFromBrief(brief);

  console.log(`\n${"─".repeat(60)}`);
  console.log(`TEST: ${label}`);
  console.log(`BRIEF: ${brief}`);
  console.log(`${"─".repeat(60)}`);

  console.log("[OBLIGATIONS]");
  extracted.obligations.forEach(o =>
    console.log(`  • ${o.actor} → ${o.action}${o.target ? " → " + o.target : " (no target)"}`)
  );

  console.log("[CONDITIONS]");
  extracted.conditions.forEach(c =>
    console.log(`  • [${c.type}] ${c.expression}`)
  );

  console.log("\n[TEMPLATE]");
  console.log(draft.templateText.trim());

  console.log("\n[MODEL]");
  console.log(draft.modelText.trim());

  console.log("\n[VERDICT]", validation.verdict);
  validation.issues.forEach(i =>
    console.log(`  • [${i.severity.toUpperCase()}] ${i.message}`)
  );
}

// Test 1: Correct logic — should produce clean "If {{inspectionPassed}}, {{buyer}} pays {{seller}}"
run(
  "1 — Correct logic",
  "If inspection passes, buyer pays seller within 5 days after delivery."
);

// Test 2: Unless inversion — validator should warn about logical inversion
// (Note: our generator always emits "If", so this tests the validator on a hand-crafted case)
run(
  "2 — Payment with unless phrasing (inversion risk)",
  "Unless inspection passes, buyer shall pay seller within 10 days."
);

// Test 3: Missing payee — buyer pays but no seller mentioned
run(
  "3 — Missing payee",
  "Buyer shall pay within 5 days after delivery."
);

// Test 4: Unused field — penalty noun triggers a field but obligation doesn't reference it
run(
  "4 — Correct multi-party",
  "Buyer agrees to pay seller within 10 days after delivery. Shipper shall deliver goods to receiver."
);
