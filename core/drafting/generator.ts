import { DraftField, DraftTemplate, ExtractedContract } from "./types";

const DEFAULT_NAMESPACE = "org.accordproject.agenticdrafting@0.0.1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toHeadline(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}

function hasField(fields: DraftField[], name: string): boolean {
  return fields.some((f) => f.name === name);
}

// ─── Template Text Generation ─────────────────────────────────────────────────

function buildIntroduction(extracted: ExtractedContract): string[] {
  const { parties, fields, obligations } = extracted;
  const lines: string[] = [];

  const hasParty = (p: string) => parties.includes(p) && hasField(fields, p);

  // Derive intro from obligations if available, otherwise fall back to parties
  if (obligations.length > 0) {
    for (const ob of obligations) {
      const actor = `{{${ob.actor}}}`;
      const action = ob.action;
      // Reference target only if it's a known party field, otherwise omit
      const targetRef = ob.target && hasField(fields, ob.target) ? ` {{${ob.target}}}` : "";
      const timeClause = hasField(fields, "timeAmount")
        ? ` within {{timeAmount}} {{timeUnit}}`
        : "";
      const eventClause = hasField(fields, "referenceEvent")
        ? ` after {{referenceEvent}}`
        : "";

      lines.push(
        `The ${actor} shall ${action}${targetRef}${timeClause}${eventClause}.`
      );
    }
  } else {
    // Fallback to simple party intro
    if (hasParty("buyer") && hasParty("seller")) {
      lines.push("This draft agreement is made between {{buyer}} and {{seller}}.");
    } else if (hasParty("buyer")) {
      lines.push("This draft agreement names {{buyer}} as the buyer.");
    } else if (hasParty("seller")) {
      lines.push("This draft agreement names {{seller}} as the seller.");
    }
  }

  if (hasParty("shipper")) {
    lines.push("The shipper for this transaction is {{shipper}}.");
  }
  if (hasParty("receiver")) {
    lines.push("The receiver for this transaction is {{receiver}}.");
  }

  return lines;
}

/**
 * Resolves the primary boolean field that represents a condition.
 * Maps condition concepts to the most specific typed field available.
 */
const CONDITION_FIELD_MAP: Record<string, string> = {
  inspection: "inspectionPassed",
  delivery: "deliveryAccepted",
};

function resolveBooleanField(expression: string, fields: DraftField[]): string | undefined {
  // Try to find a matching concept in the expression and map it to a known field
  for (const [concept, fieldName] of Object.entries(CONDITION_FIELD_MAP)) {
    if (expression.toLowerCase().includes(concept) && hasField(fields, fieldName)) {
      return fieldName;
    }
  }
  // Fallback: return the first boolean field available
  return fields.find((f) => f.type === "Boolean")?.name;
}

function buildConditionClauses(extracted: ExtractedContract): string[] {
  const { conditions, fields } = extracted;
  const lines: string[] = [];

  if (conditions.length === 0) return lines;

  const firstCond = conditions[0];
  const booleanField = resolveBooleanField(firstCond.expression, fields);

  if (!booleanField) return lines;

  // Determine the correct keyword from the extracted condition type
  const keyword =
    firstCond.type === "in_case"
      ? "In the event that"
      : firstCond.type.charAt(0).toUpperCase() + firstCond.type.slice(1);

  // Use the typed boolean field directly — no free-text ambiguity
  lines.push(`${keyword} {{${booleanField}}}, the terms below shall apply.`);

  return lines;
}

function buildOperationalClauses(extracted: ExtractedContract): string[] {
  const { fields } = extracted;
  const lines: string[] = [];

  if (hasField(fields, "goodsDescription")) {
    lines.push("The goods covered by this agreement are described as {{goodsDescription}}.");
  }
  if (hasField(fields, "deliveryDate")) {
    lines.push("Delivery is scheduled for {{deliveryDate}}.");
  }
  if (hasField(fields, "timeAmount") && !extracted.obligations.length) {
    // Only emit a generic payment clause if no obligation already covered it
    lines.push("Payment is due within {{timeAmount}} {{timeUnit}} after {{referenceEvent}}.");
  }
  if (hasField(fields, "responseHours")) {
    lines.push("Any required response must be provided within {{responseHours}} hours.");
  }
  if (hasField(fields, "inspectionPassed") && !extracted.conditions.length) {
    // Only use as a standalone clause when there's no condition block already using it
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
    ...buildConditionClauses(extracted),
    ...buildIntroduction(extracted),
    ...buildOperationalClauses(extracted),
  ].filter((line, index, lines) => {
    if (line !== "") return true;
    return index > 0 && lines[index - 1] !== "";
  });

  return `${sections.join("\n")}\n`;
}

// ─── Model Generation ─────────────────────────────────────────────────────────

function buildModelText(
  contractName: string,
  namespace: string,
  fields: DraftField[]
): string {
  const fieldLines = fields.map(
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
  fields: DraftField[]
): Record<string, string | boolean | number> {
  const data: Record<string, string | boolean | number> = {
    $class: `${namespace}.${contractName}`,
  };
  for (const field of fields) {
    if (!field.optional) {
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
  const modelText = buildModelText(contractName, namespace, extracted.fields);
  const sampleData = buildSampleData(contractName, namespace, extracted.fields);

  return {
    contractName,
    namespace,
    templateText,
    modelText,
    sampleData,
    fields: extracted.fields,
  };
}
