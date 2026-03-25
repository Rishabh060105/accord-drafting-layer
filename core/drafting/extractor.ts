import {
  ConditionWord,
  ContractBrief,
  ContractNoun,
  DraftField,
  ExtractedContract,
  PartyRole,
  TimeReference,
} from "./types";

const PARTY_PATTERNS: Array<{ role: PartyRole; patterns: RegExp[] }> = [
  { role: "buyer", patterns: [/\bbuyer\b/, /\bpurchaser\b/, /\bcustomer\b/] },
  { role: "seller", patterns: [/\bseller\b/, /\bvendor\b/, /\bsupplier\b/] },
  { role: "shipper", patterns: [/\bshipper\b/, /\bcarrier\b/] },
  { role: "receiver", patterns: [/\breceiver\b/, /\bconsignee\b/, /\brecipient\b/] },
];

const CONDITION_PATTERNS: Array<{ value: ConditionWord; pattern: RegExp }> = [
  { value: "passed", pattern: /\bpassed\b/ },
  { value: "failed", pattern: /\bfailed\b/ },
  { value: "accepted", pattern: /\baccepted\b/ },
  { value: "rejected", pattern: /\brejected\b/ },
];

const TIME_PATTERNS: Array<{ value: TimeReference; pattern: RegExp }> = [
  { value: "days", pattern: /\bdays?\b/ },
  { value: "hours", pattern: /\bhours?\b/ },
  { value: "due", pattern: /\bdue\b/ },
  { value: "deadline", pattern: /\bdeadline\b/ },
  { value: "after delivery", pattern: /\bafter delivery\b/ },
];

const NOUN_PATTERNS: Array<{ value: ContractNoun; pattern: RegExp }> = [
  { value: "goods", pattern: /\bgoods\b/ },
  { value: "delivery", pattern: /\bdelivery\b/ },
  { value: "payment", pattern: /\bpayment\b/ },
  { value: "penalty", pattern: /\bpenalt(?:y|ies)\b/ },
  { value: "inspection", pattern: /\binspection\b/ },
];

const DEFAULT_NAMESPACE_NAME = "ContractDraft";

function normalizeBrief(brief: string): string {
  return brief.toLowerCase().replace(/\s+/g, " ").trim();
}

function detectValues<T>(text: string, entries: Array<{ value: T; pattern: RegExp }>): T[] {
  return entries.filter((entry) => entry.pattern.test(text)).map((entry) => entry.value);
}

function detectParties(text: string): PartyRole[] {
  return PARTY_PATTERNS.filter(({ patterns }) => patterns.some((pattern) => pattern.test(text))).map(({ role }) => role);
}

function addField(fields: DraftField[], field: DraftField): void {
  if (!fields.some((existingField) => existingField.name === field.name)) {
    fields.push(field);
  }
}

function buildContractName(nouns: ContractNoun[]): string {
  const nameParts = nouns.slice(0, 2).map((noun) => noun.charAt(0).toUpperCase() + noun.slice(1));
  return `${nameParts.join("") || DEFAULT_NAMESPACE_NAME}`;
}

export function extractContract(brief: string): ExtractedContract {
  const normalizedText = normalizeBrief(brief);
  const contractBrief: ContractBrief = { rawText: brief };
  const parties = detectParties(normalizedText);
  const conditionWords = detectValues(normalizedText, CONDITION_PATTERNS);
  const timeReferences = detectValues(normalizedText, TIME_PATTERNS);
  const contractNouns = detectValues(normalizedText, NOUN_PATTERNS);
  const fields: DraftField[] = [];

  parties.forEach((party) => {
    addField(fields, {
      name: party,
      type: "String",
      source: "party",
      description: `${party.charAt(0).toUpperCase() + party.slice(1)} party name`,
      defaultValue: party.charAt(0).toUpperCase() + party.slice(1),
    });
  });

  if (contractNouns.includes("goods")) {
    addField(fields, {
      name: "goodsDescription",
      type: "String",
      source: "noun",
      description: "Description of the goods covered by the draft contract",
      defaultValue: "Example goods shipment",
    });
  }

  if (contractNouns.includes("delivery")) {
    addField(fields, {
      name: "deliveryDate",
      type: "String",
      source: "noun",
      description: "Planned delivery date or delivery milestone",
      defaultValue: "2026-04-01",
    });
  }

  if (contractNouns.includes("payment") || timeReferences.some((value) => value === "days" || value === "due" || value === "after delivery")) {
    addField(fields, {
      name: "paymentDueDays",
      type: "Integer",
      source: "time",
      description: "Number of days allowed before payment is due",
      defaultValue: 30,
    });
  }

  if (timeReferences.includes("hours")) {
    addField(fields, {
      name: "responseHours",
      type: "Integer",
      source: "time",
      description: "Number of hours allowed for a response or cure period",
      defaultValue: 48,
    });
  }

  if (timeReferences.includes("deadline") && !fields.some((field) => field.name === "deliveryDeadline")) {
    addField(fields, {
      name: "deliveryDeadline",
      type: "String",
      source: "time",
      description: "Named deadline for delivery or performance",
      defaultValue: "Promptly after notice",
    });
  }

  if (contractNouns.includes("penalty")) {
    addField(fields, {
      name: "penaltyDescription",
      type: "String",
      source: "noun",
      description: "Penalty wording or commercial consequence",
      defaultValue: "A reasonable late-delivery penalty applies",
    });
  }

  if (contractNouns.includes("inspection") || conditionWords.some((word) => word === "passed" || word === "failed")) {
    addField(fields, {
      name: "inspectionPassed",
      type: "Boolean",
      source: "condition",
      description: "Whether the inspection requirement has been passed",
      defaultValue: conditionWords.includes("failed") ? false : true,
    });
  }

  if (conditionWords.some((word) => word === "accepted" || word === "rejected")) {
    addField(fields, {
      name: "deliveryAccepted",
      type: "Boolean",
      source: "condition",
      description: "Whether the delivered goods have been accepted",
      defaultValue: conditionWords.includes("accepted"),
    });
  }

  if (fields.length === 0) {
    addField(fields, {
      name: "agreementSummary",
      type: "String",
      source: "derived",
      description: "Fallback summary when the brief is too generic to extract structured fields",
      defaultValue: brief.trim() || "Contract summary",
    });
  }

  return {
    brief: contractBrief,
    normalizedText,
    contractName: buildContractName(contractNouns),
    parties,
    conditionWords,
    timeReferences,
    contractNouns,
    fields,
  };
}
