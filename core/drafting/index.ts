import { extractContract } from "./extractor";
import { generateDraftTemplate } from "./generator";
import { validateDraftTemplate } from "./validator";

export { extractContract } from "./extractor";
export { generateDraftTemplate } from "./generator";
export { validateDraftTemplate } from "./validator";
export * from "./types";

// ─── Strategy Interface ───────────────────────────────────────────────────────

/**
 * Extension point for future drafting implementations.
 * The default implementation uses deterministic rule-based extraction.
 * Future strategies (e.g. LLM-based) can conform to this interface.
 */
export interface DraftingStrategy {
  extract: typeof extractContract;
  generate: typeof generateDraftTemplate;
  validate: typeof validateDraftTemplate;
}

export const defaultStrategy: DraftingStrategy = {
  extract: extractContract,
  generate: generateDraftTemplate,
  validate: validateDraftTemplate,
};

// ─── Pipeline Entry Point ─────────────────────────────────────────────────────

export interface DraftResult {
  extracted: ReturnType<typeof extractContract>;
  draft: ReturnType<typeof generateDraftTemplate>;
  validation: ReturnType<typeof validateDraftTemplate>;
}

/**
 * End-to-end pipeline: brief → extracted IR → draft template → validation report.
 * Accepts an optional strategy to allow pluggable implementations.
 */
export function createDraftFromBrief(
  brief: string,
  strategy: DraftingStrategy = defaultStrategy
): DraftResult {
  const extracted = strategy.extract(brief);
  const draft = strategy.generate(extracted);
  const validation = strategy.validate(draft, extracted);

  return { extracted, draft, validation };
}
