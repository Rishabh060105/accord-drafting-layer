import { DraftTemplate, ValidationIssue, ValidationReport } from "./types";

const TEXT_VARIABLE_PATTERN = /{{\s*([A-Za-z_][A-Za-z0-9_]*)\b[^}]*}}/g;
const MODEL_FIELD_PATTERN = /^\s*o\s+[A-Za-z][A-Za-z0-9.[\]]*\s+([A-Za-z_][A-Za-z0-9_]*)\b/gm;

function getUniqueMatches(pattern: RegExp, value: string): string[] {
  const matches = new Set<string>();

  for (const match of value.matchAll(pattern)) {
    if (match[1]) {
      matches.add(match[1]);
    }
  }

  return [...matches];
}

export function validateDraftTemplate(draft: DraftTemplate): ValidationReport {
  const textVariables = getUniqueMatches(TEXT_VARIABLE_PATTERN, draft.templateText);
  const modelFields = getUniqueMatches(MODEL_FIELD_PATTERN, draft.modelText);
  const missingInModel = textVariables.filter((variable) => !modelFields.includes(variable));
  const unusedModelFields = modelFields.filter((field) => !textVariables.includes(field));
  const issues: ValidationIssue[] = [];

  if (textVariables.length === 0) {
    issues.push({
      severity: "warning",
      message: "The generated template text does not reference any variables.",
    });
  }

  missingInModel.forEach((field) => {
    issues.push({
      severity: "error",
      message: `Template variable "${field}" is missing from the Concerto model.`,
      field,
    });
  });

  unusedModelFields.forEach((field) => {
    issues.push({
      severity: "warning",
      message: `Concerto field "${field}" is not referenced in the template text.`,
      field,
    });
  });

  if (issues.length === 0) {
    issues.push({
      severity: "info",
      message: "The generated template and model are structurally aligned.",
    });
  }

  return {
    isValid: missingInModel.length === 0 && unusedModelFields.length === 0,
    textVariables,
    modelFields,
    missingInModel,
    unusedModelFields,
    issues,
  };
}
