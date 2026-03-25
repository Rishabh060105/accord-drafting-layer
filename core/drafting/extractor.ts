import {
  ConditionClause,
  DraftField,
  ExtractedContract,
  Obligation,
  TemporalConstraint,
} from "./types";

// ─── Party Detection ──────────────────────────────────────────────────────────

const PARTY_PATTERNS: Array<{ role: string; patterns: RegExp[] }> = [
  { role: "buyer", patterns: [/\bbuyer\b/, /\bpurchaser\b/, /\bcustomer\b/] },
  { role: "seller", patterns: [/\bseller\b/, /\bvendor\b/, /\bsupplier\b/] },
  { role: "shipper", patterns: [/\bshipper\b/, /\bcarrier\b/] },
  { role: "receiver", patterns: [/\breceiver\b/, /\bconsignee\b/, /\brecipient\b/] },
];

// ─── Concept / Noun Detection ─────────────────────────────────────────────────

const CONCEPT_PATTERNS: Array<{ value: string; pattern: RegExp }> = [
  { value: "goods", pattern: /\bgoods\b/ },
  { value: "delivery", pattern: /\bdelivery\b/ },
  { value: "payment", pattern: /\bpayment\b/ },
  { value: "penalty", pattern: /\bpenalt(?:y|ies)\b/ },
  { value: "inspection", pattern: /\binspection\b/ },
  { value: "invoice", pattern: /\binvoice\b/ },
  { value: "warranty", pattern: /\bwarranty\b/ },
  { value: "liability", pattern: /\bliabilit(?:y|ies)\b/ },
];

// ─── Condition Detection ──────────────────────────────────────────────────────

const CONDITION_PATTERNS: Array<{ type: ConditionClause["type"]; pattern: RegExp }> = [
  { type: "if", pattern: /\bif\b/ },
  { type: "unless", pattern: /\bunless\b/ },
  { type: "when", pattern: /\bwhen\b/ },
  { type: "in_case", pattern: /\bin case of\b|\bprovided that\b/ },
];

// ─── Obligation Detection ─────────────────────────────────────────────────────

/**
 * Matches patterns like:
 *   "buyer agrees to pay seller"
 *   "shipper shall deliver goods to receiver"
 *   "seller must replace defective goods"
 *   "buyer is required to notify seller"
 */
const OBLIGATION_REGEXES: RegExp[] = [
  /(\w+)\s+(?:agrees to|shall|must|is required to|is obligated to|will)\s+(\w+)(?:\s+\w+)*?\s+(?:to|for)\s+(\w+)/gi,
  /(\w+)\s+(?:agrees to|shall|must|will)\s+(\w+)/gi,
];

// ─── Temporal Extraction ──────────────────────────────────────────────────────

/**
 * Matches patterns like:
 *   "within 10 days after delivery"
 *   "due in 30 days"
 *   "before the deadline"
 *   "48 hours after notice"
 */
const TEMPORAL_REGEX =
  /\b(within|after|before|due|deadline)\b(?:\s+in)?\s*(\d+)?\s*(days?|hours?)?\s*(?:after|of|from)?\s*(delivery|payment|notice|invoice|inspection)?\b/gi;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function detectParties(text: string): string[] {
  return PARTY_PATTERNS.filter(({ patterns }) =>
    patterns.some((p) => p.test(text))
  ).map(({ role }) => role);
}

function detectConcepts(text: string): string[] {
  return CONCEPT_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ value }) => value);
}

function detectConditions(text: string, rawText: string): ConditionClause[] {
  const results: ConditionClause[] = [];

  for (const { type, pattern } of CONDITION_PATTERNS) {
    const regex = new RegExp(pattern.source, "gi");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(rawText)) !== null) {
      // Grab the rest of the sentence after the trigger word (up to 60 chars)
      const expression = rawText
        .slice(match.index + match[0].length)
        .split(/[.,;]/)[0]
        .trim()
        .slice(0, 60);

      if (expression.length > 2) {
        results.push({ type, expression });
      }
    }
  }

  return results;
}

function detectObligations(rawText: string, parties: string[]): Obligation[] {
  const obligations: Obligation[] = [];
  const knownParties = new Set(parties);

  // Pattern: <actor> (shall|must|agrees to|will) <action> [... to/for <target>]
  const regex =
    /(\b\w+\b)\s+(?:agrees to|shall|must|is required to|is obligated to|will)\s+(\w+)(?:[^,.]*?\s+(?:to|for)\s+(\w+))?/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(rawText)) !== null) {
    const actor = match[1].toLowerCase();
    const action = match[2].toLowerCase();
    const target = match[3]?.toLowerCase();

    // Only emit obligations where the actor is a known party or a plausible legal subject
    if (knownParties.has(actor) || /^(the|a|an)$/.test(actor)) {
      const ob: Obligation = { actor, action };
      if (target && target !== action) ob.target = target;
      obligations.push(ob);
    }
  }

  return obligations;
}

function detectTemporalConstraints(rawText: string): TemporalConstraint[] {
  const results: TemporalConstraint[] = [];
  const regex = new RegExp(TEMPORAL_REGEX.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(rawText)) !== null) {
    const relation = match[1].toLowerCase() as TemporalConstraint["relation"];
    const value = match[2] ? parseInt(match[2], 10) : undefined;
    const unit = match[3] ? (match[3].replace(/s$/, "") + "s") as "days" | "hours" : undefined;
    const event = match[4]?.toLowerCase();
    const raw = match[0].trim();

    results.push({ relation, value, unit, event, raw });
  }

  return results;
}

function addField(fields: DraftField[], field: DraftField): void {
  if (!fields.some((f) => f.name === field.name)) {
    fields.push(field);
  }
}

function buildFields(
  parties: string[],
  concepts: string[],
  conditions: ConditionClause[],
  temporalConstraints: TemporalConstraint[],
  obligations: Obligation[]
): DraftField[] {
  const fields: DraftField[] = [];

  // Parties
  for (const party of parties) {
    addField(fields, {
      name: party,
      type: "String",
      source: "party",
      description: `${party.charAt(0).toUpperCase() + party.slice(1)} party name`,
      defaultValue: party.charAt(0).toUpperCase() + party.slice(1),
    });
  }

  // Obligation actions — stored as optional metadata fields
  for (const ob of obligations) {
    const fieldName = `${ob.actor}Obligation`;
    addField(fields, {
      name: fieldName,
      type: "String",
      source: "obligation",
      description: `${ob.actor} is obligated to ${ob.action}${ob.target ? " " + ob.target : ""}`,
      defaultValue: ob.action,
      optional: true,
    });
  }

  // Concept fields
  if (concepts.includes("goods")) {
    addField(fields, {
      name: "goodsDescription",
      type: "String",
      source: "noun",
      description: "Description of the goods",
      defaultValue: "Example goods shipment",
    });
  }

  if (concepts.includes("delivery")) {
    addField(fields, {
      name: "deliveryDate",
      type: "String",
      source: "noun",
      description: "Planned delivery date or milestone",
      defaultValue: "2026-04-01",
    });
  }

  if (concepts.includes("penalty")) {
    addField(fields, {
      name: "penaltyDescription",
      type: "String",
      source: "noun",
      description: "Penalty wording or commercial consequence",
      defaultValue: "A reasonable late-delivery penalty applies",
    });
  }

  if (concepts.includes("inspection") || conditions.length > 0) {
    addField(fields, {
      name: "inspectionPassed",
      type: "Boolean",
      source: "condition",
      description: "Whether the inspection requirement has been passed",
      defaultValue: true,
    });
  }

  // Temporal fields
  for (const tc of temporalConstraints) {
    if (tc.value !== undefined && tc.unit) {
      if (tc.unit === "days") {
        addField(fields, {
          name: "timeAmount",
          type: "Integer",
          source: "time",
          description: `Number of ${tc.unit} for this temporal constraint`,
          defaultValue: tc.value,
        });
        addField(fields, {
          name: "timeUnit",
          type: "String",
          source: "time",
          description: "Unit of time (e.g., days, hours)",
          defaultValue: tc.unit,
        });
      } else if (tc.unit === "hours") {
        addField(fields, {
          name: "responseHours",
          type: "Integer",
          source: "time",
          description: "Number of hours for the response window",
          defaultValue: tc.value,
        });
      }
    }
    if (tc.event) {
      addField(fields, {
        name: "referenceEvent",
        type: "String",
        source: "time",
        description: "Reference event for the temporal constraint",
        defaultValue: tc.event,
      });
    }
  }

  // Condition expressions
  for (const cond of conditions) {
    addField(fields, {
      name: "conditionExpression",
      type: "String",
      source: "condition",
      description: `Condition clause: ${cond.type} ${cond.expression}`,
      defaultValue: cond.expression,
      optional: true,
    });
    break; // add once for the primary condition
  }

  // Fallback
  if (fields.length === 0) {
    addField(fields, {
      name: "agreementSummary",
      type: "String",
      source: "derived",
      description: "Fallback field when the brief is too generic for structured extraction",
      defaultValue: "General contract agreement",
    });
  }

  return fields;
}

function buildContractName(concepts: string[]): string {
  const parts = concepts
    .slice(0, 2)
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1));
  return parts.join("") || "DraftContract";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function extractContract(brief: string): ExtractedContract {
  const text = normalize(brief);

  const parties = detectParties(text);
  const concepts = detectConcepts(text);
  const conditions = detectConditions(text, brief);
  const obligations = detectObligations(brief, parties);
  const temporalConstraints = detectTemporalConstraints(brief);
  const fields = buildFields(parties, concepts, conditions, temporalConstraints, obligations);

  return {
    brief,
    parties,
    concepts,
    obligations,
    conditions,
    temporalConstraints,
    fields,
  };
}
