import { DraftTemplate, ExtractedContract, ValidationIssue, ValidationReport } from "./types";

const TEXT_VARIABLE_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\b[^}]*\}\}/g;
const MODEL_FIELD_PATTERN = /^\s*o\s+[A-Za-z][A-Za-z0-9.[\]]*\s+([A-Za-z_][A-Za-z0-9_]*)\b/gm;

// Verbs that imply a payment obligation requiring a payee
const PAYMENT_VERBS = new Set(["pay", "remit", "transfer", "reimburse", "compensate"]);

function getUniqueMatches(pattern: RegExp, value: string): string[] {
  const matches = new Set<string>();
  for (const match of value.matchAll(pattern)) {
    if (match[1]) matches.add(match[1]);
  }
  return [...matches];
}

// ─── A: Variable Consistency ──────────────────────────────────────────────────

function checkVariableConsistency(
  textVariables: string[],
  modelFields: string[],
  issues: ValidationIssue[]
): { missingInModel: string[]; unusedModelFields: string[] } {
  const missingInModel = textVariables.filter((v) => !modelFields.includes(v));
  const unusedModelFields = modelFields.filter((f) => !textVariables.includes(f));

  if (textVariables.length === 0) {
    issues.push({ severity: "warning", message: "Template text contains no variable placeholders." });
  }

  for (const field of missingInModel) {
    issues.push({
      severity: "error",
      message: `Template variable "{{${field}}}" is missing from the Concerto model.`,
      field,
    });
  }

  for (const field of unusedModelFields) {
    issues.push({
      severity: "warning",
      message: `Unused model field: "${field}" is defined in the model but not referenced in the template.`,
      field,
    });
  }

  return { missingInModel, unusedModelFields };
}

// ─── B: Missing Obligation Target ────────────────────────────────────────────

function checkObligationTarget(
  extracted: ExtractedContract | undefined,
  templateText: string,
  issues: ValidationIssue[]
): void {
  if (!extracted) return;

  for (const ob of extracted.obligations) {
    if (PAYMENT_VERBS.has(ob.action)) {
      const hasTarget = !!ob.target;
      const targetInTemplate = ob.target
        ? templateText.includes(`{{${ob.target}}}`)
        : false;

      if (!hasTarget) {
        issues.push({
          severity: "warning",
          message: `Missing obligation target: "${ob.actor} shall ${ob.action}" has no identified payee. The recipient of payment should be specified.`,
        });
      } else if (!targetInTemplate) {
        issues.push({
          severity: "warning",
          message: `Obligation target "{{${ob.target}}}" is identified in the IR but missing from the generated template text.`,
          field: ob.target,
        });
      }
    }
  }
}

// ─── C: Logical Inversion Warning ─────────────────────────────────────────────

function checkLogicalInversion(templateText: string, issues: ValidationIssue[]): void {
  // Flag "Unless {{<booleanField>}}" patterns — these invert positive-semantics fields
  const unlessPattern = /\bUnless\s+\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;
  for (const match of templateText.matchAll(unlessPattern)) {
    issues.push({
      severity: "warning",
      message: `Possible logical inversion: "Unless {{${match[1]}}}" may reverse contract intent. ` +
        `If "${match[1]}" is named with positive semantics (e.g. inspectionPassed = true means it passed), ` +
        `prefer "If {{${match[1]}}}" instead.`,
      field: match[1],
    });
  }
}

// ─── D: Temporal Logic Consistency ───────────────────────────────────────────

function checkTemporalLogic(
  extracted: ExtractedContract | undefined,
  modelFields: string[],
  issues: ValidationIssue[]
): void {
  if (!extracted) return;

  if (extracted.temporalConstraints.length > 0) {
    const temporalFields = ["timeAmount", "timeUnit", "referenceEvent", "responseHours"];
    const hasTemporalField = temporalFields.some((f) => modelFields.includes(f));
    if (!hasTemporalField) {
      issues.push({
        severity: "warning",
        message: "Temporal constraints were detected in the brief but no temporal fields were added to the model.",
      });
    }
  }
}

// ─── E: Condition Alignment ───────────────────────────────────────────────────

function checkConditionAlignment(
  extracted: ExtractedContract | undefined,
  textVariables: string[],
  modelFields: string[],
  issues: ValidationIssue[]
): void {
  if (!extracted || extracted.conditions.length === 0) return;

  const booleanModelFields = modelFields.filter((f) => {
    const fieldDef = extracted.fields?.find((df) => df.name === f);
    return fieldDef?.type === "Boolean";
  });

  const booleanUsedInTemplate = booleanModelFields.some((f) => textVariables.includes(f));

  if (!booleanUsedInTemplate) {
    issues.push({
      severity: "warning",
      message:
        "Conditional phrases were detected in the brief but no boolean condition field (e.g. inspectionPassed) was rendered in the template.",
    });
  }

  if (modelFields.includes("conditionExpression")) {
    issues.push({
      severity: "warning",
      message:
        '"conditionExpression" (free-text) found in model — prefer a typed Boolean field for condition logic.',
    });
  }
}

// ─── F: Unnecessary Fields ────────────────────────────────────────────────────

function checkUnnecessaryFields(
  modelFields: string[],
  textVariables: string[],
  issues: ValidationIssue[]
): void {
  // Flag fields that look like obligation metadata (e.g. buyerObligation)
  for (const field of modelFields) {
    if (/Obligation$/.test(field) && !textVariables.includes(field)) {
      issues.push({
        severity: "warning",
        message: `Unnecessary field: "${field}" is an obligation metadata field that is not used in the template.`,
        field,
      });
    }
  }
}

// ─── Verdict ──────────────────────────────────────────────────────────────────

function computeVerdict(
  missingInModel: string[],
  issues: ValidationIssue[]
): ValidationReport["verdict"] {
  if (missingInModel.length > 0) return "Invalid";
  const hasWarnings = issues.some((i) => i.severity === "warning");
  return hasWarnings ? "Valid with warnings" : "Valid";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function validateDraftTemplate(
  draft: DraftTemplate,
  extracted?: ExtractedContract
): ValidationReport {
  const textVariables = getUniqueMatches(TEXT_VARIABLE_PATTERN, draft.templateText);
  const modelFields = getUniqueMatches(MODEL_FIELD_PATTERN, draft.modelText);
  const issues: ValidationIssue[] = [];

  const { missingInModel, unusedModelFields } = checkVariableConsistency(
    textVariables, modelFields, issues
  );

  checkObligationTarget(extracted, draft.templateText, issues);
  checkLogicalInversion(draft.templateText, issues);
  checkTemporalLogic(extracted, modelFields, issues);
  checkConditionAlignment(extracted, textVariables, modelFields, issues);
  checkUnnecessaryFields(modelFields, textVariables, issues);

  if (issues.length === 0) {
    issues.push({
      severity: "info",
      message: "Template and model are fully aligned — structurally and semantically.",
    });
  }

  const verdict = computeVerdict(missingInModel, issues);

  return {
    isValid: missingInModel.length === 0,
    verdict,
    textVariables,
    modelFields,
    missingInModel,
    unusedModelFields,
    issues,
  };
}
