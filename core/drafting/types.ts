// ─── Primitive types ──────────────────────────────────────────────────────────

export type DraftFieldType = "String" | "Boolean" | "Integer";
export type DraftFieldSource = "party" | "condition" | "time" | "noun" | "obligation" | "derived";

// ─── Logic-Aware IR ───────────────────────────────────────────────────────────

/**
 * Represents a legal obligation extracted from the brief.
 * Example: "buyer agrees to pay seller"
 *   → { actor: "buyer", action: "pay", target: "seller" }
 */
export interface Obligation {
  actor: string;
  action: string;
  target?: string;
}

/**
 * Represents a conditional clause extracted from the brief.
 * Example: "if delivery fails" → { type: "if", expression: "delivery fails" }
 */
export interface ConditionClause {
  type: "if" | "unless" | "when" | "in_case";
  expression: string;
}

/**
 * Represents a temporal constraint extracted from the brief.
 * Example: "within 10 days after delivery"
 *   → { relation: "within", value: 10, unit: "days", event: "delivery", raw: "within 10 days after delivery" }
 */
export interface TemporalConstraint {
  relation: "within" | "after" | "before" | "due" | "deadline";
  value?: number;
  unit?: "days" | "hours";
  event?: string;
  raw: string;
}

// ─── Schema-level field ───────────────────────────────────────────────────────

export interface DraftField {
  name: string;
  type: DraftFieldType;
  source: DraftFieldSource;
  description: string;
  defaultValue: string | boolean | number;
  optional?: boolean;
}

// ─── Top-level IR ─────────────────────────────────────────────────────────────

export interface ExtractedContract {
  brief: string;
  parties: string[];
  concepts: string[];
  obligations: Obligation[];
  conditions: ConditionClause[];
  temporalConstraints: TemporalConstraint[];
  fields: DraftField[];
}

// ─── Generator output ─────────────────────────────────────────────────────────

export interface DraftTemplate {
  contractName: string;
  namespace: string;
  templateText: string;
  modelText: string;
  sampleData: Record<string, string | boolean | number>;
  fields: DraftField[];
}

// ─── Validator output ─────────────────────────────────────────────────────────

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  message: string;
  field?: string;
}

export interface ValidationReport {
  isValid: boolean;
  verdict: "Valid" | "Valid with warnings" | "Invalid";
  textVariables: string[];
  modelFields: string[];
  missingInModel: string[];
  unusedModelFields: string[];
  issues: ValidationIssue[];
}
