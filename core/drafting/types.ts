export type PartyRole = "buyer" | "seller" | "shipper" | "receiver";
export type ConditionWord = "passed" | "failed" | "accepted" | "rejected";
export type TimeReference = "days" | "hours" | "due" | "deadline" | "after delivery";
export type ContractNoun = "goods" | "delivery" | "payment" | "penalty" | "inspection";
export type DraftFieldType = "String" | "Boolean" | "Integer";
export type DraftFieldSource = "party" | "condition" | "time" | "noun" | "derived";

export interface ContractBrief {
  rawText: string;
}

export interface DraftField {
  name: string;
  type: DraftFieldType;
  source: DraftFieldSource;
  description: string;
  defaultValue: string | boolean | number;
}

export interface ExtractedContract {
  brief: ContractBrief;
  normalizedText: string;
  contractName: string;
  parties: PartyRole[];
  conditionWords: ConditionWord[];
  timeReferences: TimeReference[];
  contractNouns: ContractNoun[];
  fields: DraftField[];
}

export interface DraftTemplate {
  contractName: string;
  namespace: string;
  templateText: string;
  modelText: string;
  sampleData: Record<string, string | boolean | number>;
  fields: DraftField[];
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  message: string;
  field?: string;
}

export interface ValidationReport {
  isValid: boolean;
  textVariables: string[];
  modelFields: string[];
  missingInModel: string[];
  unusedModelFields: string[];
  issues: ValidationIssue[];
}
