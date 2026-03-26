import { DraftTemplate, ExtractedContract, ValidationIssue, ValidationReport } from "./types";

const TEXT_VARIABLE_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\b[^}]*\}\}/g;
const MODEL_FIELD_PATTERN = /^\s*o\s+[A-Za-z][A-Za-z0-9.[\]]*\s+([A-Za-z_][A-Za-z0-9_]*)\b/gm;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUniqueMatches(pattern: RegExp, value: string): string[] {
  const matches = new Set<string>();
  for (const match of value.matchAll(pattern)) {
    if (match[1]) matches.add(match[1]);
  }
  return [...matches];
}

// ─── Variable Consistency ─────────────────────────────────────────────────────

function checkVariableConsistency(
  draft: DraftTemplate,
  textVariables: string[],
  modelFields: string[],
  issues: ValidationIssue[]
): { missingInModel: string[]; unusedModelFields: string[] } {
  const missingInModel = textVariables.filter((v) => !modelFields.includes(v));
  const unusedModelFields = modelFields.filter((f) => !textVariables.includes(f));

  if (textVariables.length === 0) {
    issues.push({
      severity: "warning",
      message: "The generated template text does not reference any variables.",
    });
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
      message: `Concerto field "${field}" is defined in the model but not referenced in the template text.`,
      field,
    });
  }

  return { missingInModel, unusedModelFields };
}

// ─── Logic Consistency ────────────────────────────────────────────────────────

function checkLogicConsistency(
  extracted: ExtractedContract | undefined,
  draft: DraftTemplate,
  textVariables: string[],
  modelFields: string[],
  issues: ValidationIssue[]
): void {
  if (!extracted) return;

  // Rule 1: If temporal constraints were extracted, the model should have timeAmount/timeUnit or referenceEvent
  if (extracted.temporalConstraints.length > 0) {
    const temporalFields = ["timeAmount", "timeUnit", "referenceEvent", "responseHours"];
    const hasTemporalField = temporalFields.some((f) => modelFields.includes(f));
    if (!hasTemporalField) {
      issues.push({
        severity: "warning",
        message:
          "Temporal constraints were detected in the brief, but no temporal fields (timeAmount, timeUnit, referenceEvent) were added to the model.",
      });
    }
  }

  // Rule 2: If conditions were extracted, a boolean field must be used in the template
  if (extracted.conditions.length > 0) {
    // Look for any boolean field that's used in the template (e.g. inspectionPassed, deliveryAccepted)
    const booleanFields = modelFields.filter((f) => {
      const fieldDef = extracted.fields?.find((df) => df.name === f);
      return fieldDef?.type === "Boolean";
    });
    const booleanFieldUsedInTemplate = booleanFields.some((f) => textVariables.includes(f));

    if (!booleanFieldUsedInTemplate) {
      issues.push({
        severity: "warning",
        message:
          'Conditional phrases were detected but no boolean condition field (e.g. "inspectionPassed") was rendered in the template.',
      });
    }
    // Warn if free-text conditionExpression is still in the model (should have been removed)
    if (modelFields.includes("conditionExpression")) {
      issues.push({
        severity: "warning",
        message:
          '"conditionExpression" (free-text) found in model — prefer a typed Boolean field for condition logic.',
      });
    }
  }

  // Rule 3: If obligations were extracted, check that the actors actually appear as model fields
  for (const ob of extracted.obligations) {
    const obligationField = `${ob.actor}Obligation`;
    if (!modelFields.includes(obligationField) && !modelFields.includes(ob.actor)) {
      issues.push({
        severity: "info",
        message: `Obligation detected for "${ob.actor}" but no corresponding model field was found.`,
      });
    }
  }

  // Rule 4: Unused optional logic-aware fields
  const logicFields = ["timeAmount", "timeUnit", "referenceEvent", "conditionExpression"];
  for (const f of logicFields) {
    if (modelFields.includes(f) && !textVariables.includes(f)) {
      issues.push({
        severity: "warning",
        message: `Logic field "${f}" is in the model but not referenced in the template text.`,
        field: f,
      });
    }
  }
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
    draft,
    textVariables,
    modelFields,
    issues
  );

  checkLogicConsistency(extracted, draft, textVariables, modelFields, issues);

  if (issues.length === 0) {
    issues.push({
      severity: "info",
      message: "The generated template and model are fully aligned with the extracted logic.",
    });
  }

  return {
    isValid: missingInModel.length === 0,
    textVariables,
    modelFields,
    missingInModel,
    unusedModelFields,
    issues,
  };
}
