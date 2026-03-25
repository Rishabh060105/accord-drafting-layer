export type {
  ConditionWord,
  ContractBrief,
  ContractNoun,
  DraftField,
  DraftFieldSource,
  DraftFieldType,
  DraftTemplate,
  ExtractedContract,
  PartyRole,
  TimeReference,
  ValidationIssue,
  ValidationReport,
} from "./types";
export { extractContract } from "./extractor";
export { generateDraftTemplate } from "./generator";
export { validateDraftTemplate } from "./validator";

import { DraftTemplate, ExtractedContract, ValidationReport } from "./types";

export interface DraftingStrategy {
  extract(brief: string): ExtractedContract;
  generate(data: ExtractedContract): DraftTemplate;
  validate(draft: DraftTemplate): ValidationReport;
}

import { extractContract } from "./extractor";
import { generateDraftTemplate } from "./generator";
import { validateDraftTemplate } from "./validator";

export function createDraftFromBrief(brief: string) {
  const extracted = extractContract(brief);
  const draft = generateDraftTemplate(extracted);
  const validation = validateDraftTemplate(draft);

  return {
    extracted,
    draft,
    validation,
  };
}
