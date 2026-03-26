import { DraftField, DraftTemplate, ExtractedContract } from "./types";

const DEFAULT_NAMESPACE = "org.accordproject.agenticdrafting@0.0.1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toHeadline(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}

function hasField(fields: DraftField[], name: string): boolean {
  return fields.some((f) => f.name === name);
}

/**
 * Maps condition concept keywords to the typed boolean field that represents them.
 * Always uses positive-semantics naming (inspectionPassed = true means it passed).
 */
const CONDITION_FIELD_MAP: Record<string, string> = {
  inspection: "inspectionPassed",
  delivery: "deliveryAccepted",
};

function resolveBooleanField(expression: string, fields: DraftField[]): string | undefined {
  for (const [concept, fieldName] of Object.entries(CONDITION_FIELD_MAP)) {
    if (expression.toLowerCase().includes(concept) && hasField(fields, fieldName)) {
      return fieldName;
    }
  }
  return fields.find((f) => f.type === "Boolean")?.name;
}

// ─── Template Text Generation ─────────────────────────────────────────────────

/**
 * Builds complete obligation clauses — with condition prefix merged in if present.
 *
 * Expected output (with condition):
 *   If {{inspectionPassed}}, the {{buyer}} shall pay {{seller}} within {{timeAmount}} {{timeUnit}} after {{referenceEvent}}.
 *
 * Expected output (without condition):
 *   The {{buyer}} shall pay {{seller}} within {{timeAmount}} {{timeUnit}} after {{referenceEvent}}.
 */
function buildObligationClauses(extracted: ExtractedContract): string[] {
  const { fields, obligations, conditions } = extracted;
  const lines: string[] = [];

  // Resolve primary condition boolean field once
  const conditionField =
    conditions.length > 0
      ? resolveBooleanField(conditions[0].expression, fields)
      : undefined;

  for (const ob of obligations) {
    // Payee: include target only if it maps to a known party field
    const targetRef =
      ob.target && hasField(fields, ob.target) ? ` {{${ob.target}}}` : "";

    // Temporal clause
    const timeClause = hasField(fields, "timeAmount")
      ? ` within {{timeAmount}} {{timeUnit}}`
      : "";

    // Event reference
    const eventClause = hasField(fields, "referenceEvent")
      ? ` after {{referenceEvent}}`
      : "";

    // Core obligation body (no leading article — added by wrapper below)
    const body = `{{${ob.actor}}} shall ${ob.action}${targetRef}${timeClause}${eventClause}.`;

    // Prefix with "If {{booleanField}}" when a condition exists.
    // Always use "If" — boolean fields have positive semantics
    // (inspectionPassed = true means it passed → payment should apply).
    if (conditionField) {
      lines.push(`If {{${conditionField}}}, the ${body}`);
    } else {
      lines.push(`The ${body}`);
    }
  }

  return lines;
}

function buildFallbackClauses(extracted: ExtractedContract): string[] {
  const { fields, obligations } = extracted;
  const lines: string[] = [];

  // Only emit fallback party intro when there are no obligations
  if (obligations.length === 0) {
    if (hasField(fields, "buyer") && hasField(fields, "seller")) {
      lines.push("This draft agreement is made between {{buyer}} and {{seller}}.");
    } else if (hasField(fields, "buyer")) {
      lines.push("This draft agreement names {{buyer}} as the buyer.");
    } else if (hasField(fields, "seller")) {
      lines.push("This draft agreement names {{seller}} as the seller.");
    }
  }

  if (hasField(fields, "shipper")) {
    lines.push("The shipper for this transaction is {{shipper}}.");
  }
  if (hasField(fields, "receiver")) {
    lines.push("The receiver for this transaction is {{receiver}}.");
  }

  return lines;
}

function buildOperationalClauses(extracted: ExtractedContract): string[] {
  const { fields, obligations, conditions } = extracted;
  const lines: string[] = [];

  if (hasField(fields, "goodsDescription")) {
    lines.push("The goods covered by this agreement are described as {{goodsDescription}}.");
  }
  if (hasField(fields, "deliveryDate")) {
    lines.push("Delivery is scheduled for {{deliveryDate}}.");
  }
  // Emit payment clause only if no obligation already covers it
  if (hasField(fields, "timeAmount") && obligations.length === 0) {
    lines.push("Payment is due within {{timeAmount}} {{timeUnit}} after {{referenceEvent}}.");
  }
  if (hasField(fields, "responseHours")) {
    lines.push("Any required response must be provided within {{responseHours}} hours.");
  }
  // Emit standalone inspectionPassed only when not already used in a condition clause
  if (hasField(fields, "inspectionPassed") && conditions.length === 0) {
    lines.push("Inspection passed: {{inspectionPassed}}.");
  }
  if (hasField(fields, "penaltyDescription")) {
    lines.push("Penalty terms: {{penaltyDescription}}.");
  }
  if (hasField(fields, "agreementSummary")) {
    lines.push("Agreement summary: {{agreementSummary}}.");
  }

  return lines;
}

function buildTemplateText(contractName: string, extracted: ExtractedContract): string {
  const sections = [
    `# ${toHeadline(contractName)}`,
    "",
    ...buildObligationClauses(extracted),
    ...buildFallbackClauses(extracted),
    ...buildOperationalClauses(extracted),
  ].filter((line, index, lines) => {
    if (line !== "") return true;
    return index > 0 && lines[index - 1] !== "";
  });

  return `${sections.join("\n")}\n`;
}

// ─── Model Generation ─────────────────────────────────────────────────────────

/**
 * Determines which fields are actually used in the template text,
 * then builds the model with only those fields (plus required party fields).
 * This prevents model / template misalignment.
 */
function buildModelText(
  contractName: string,
  namespace: string,
  fields: DraftField[],
  templateText: string
): string {
  const usedInTemplate = new Set(
    [...templateText.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)].map((m) => m[1])
  );

  // Include a field if it's referenced in the template OR if it's non-optional
  const modelFields = fields.filter(
    (f) => usedInTemplate.has(f.name) || !f.optional
  );

  const fieldLines = modelFields.map(
    (f) => `  o ${f.type} ${f.name}${f.optional ? " optional" : ""}`
  );

  return [
    `namespace ${namespace}`,
    "",
    "@template",
    `concept ${contractName} {`,
    ...fieldLines,
    "}",
    "",
  ].join("\n");
}

// ─── Sample Data ──────────────────────────────────────────────────────────────

function buildSampleData(
  contractName: string,
  namespace: string,
  fields: DraftField[],
  templateText: string
): Record<string, string | boolean | number> {
  const usedInTemplate = new Set(
    [...templateText.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)].map((m) => m[1])
  );

  const data: Record<string, string | boolean | number> = {
    $class: `${namespace}.${contractName}`,
  };

  for (const field of fields) {
    if (usedInTemplate.has(field.name)) {
      data[field.name] = field.defaultValue;
    }
  }

  return data;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateDraftTemplate(extracted: ExtractedContract): DraftTemplate {
  const concepts = extracted.concepts;
  const nameParts = concepts
    .slice(0, 2)
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1));
  const contractName = nameParts.join("") || "DraftContract";
  const namespace = DEFAULT_NAMESPACE;

  const templateText = buildTemplateText(contractName, extracted);
  // Model is built AFTER template so unused fields are automatically excluded
  const modelText = buildModelText(contractName, namespace, extracted.fields, templateText);
  const sampleData = buildSampleData(contractName, namespace, extracted.fields, templateText);

  return {
    contractName,
    namespace,
    templateText,
    modelText,
    sampleData,
    fields: extracted.fields,
  };
}
