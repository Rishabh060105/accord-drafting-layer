import { DraftField, DraftTemplate, ExtractedContract } from "./types";

const DEFAULT_NAMESPACE = "org.accordproject.agenticdrafting@0.0.1";

function toHeadline(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}

function buildIntroduction(fields: DraftField[]): string[] {
  const lines: string[] = [];

  if (fields.some((field) => field.name === "buyer") && fields.some((field) => field.name === "seller")) {
    lines.push("This draft agreement is made between {{buyer}} and {{seller}}.");
  } else if (fields.some((field) => field.name === "buyer")) {
    lines.push("This draft agreement names {{buyer}} as the buyer.");
  } else if (fields.some((field) => field.name === "seller")) {
    lines.push("This draft agreement names {{seller}} as the seller.");
  }

  if (fields.some((field) => field.name === "shipper")) {
    lines.push("The shipper for this transaction is {{shipper}}.");
  }

  if (fields.some((field) => field.name === "receiver")) {
    lines.push("The receiver for this transaction is {{receiver}}.");
  }

  return lines;
}

function buildOperationalClauses(fields: DraftField[]): string[] {
  const lines: string[] = [];

  if (fields.some((field) => field.name === "goodsDescription")) {
    lines.push("The goods covered by this agreement are described as {{goodsDescription}}.");
  }

  if (fields.some((field) => field.name === "deliveryDate")) {
    lines.push("Delivery is scheduled for {{deliveryDate}}.");
  }

  if (fields.some((field) => field.name === "deliveryDeadline")) {
    lines.push("The applicable delivery deadline is {{deliveryDeadline}}.");
  }

  if (fields.some((field) => field.name === "paymentDueDays")) {
    lines.push("Payment is due within {{paymentDueDays}} days after delivery.");
  }

  if (fields.some((field) => field.name === "responseHours")) {
    lines.push("Any required response must be provided within {{responseHours}} hours.");
  }

  if (fields.some((field) => field.name === "inspectionPassed")) {
    lines.push("Inspection passed: {{inspectionPassed}}.");
  }

  if (fields.some((field) => field.name === "deliveryAccepted")) {
    lines.push("Delivery accepted: {{deliveryAccepted}}.");
  }

  if (fields.some((field) => field.name === "penaltyDescription")) {
    lines.push("Penalty terms: {{penaltyDescription}}.");
  }

  if (fields.some((field) => field.name === "agreementSummary")) {
    lines.push("Agreement summary: {{agreementSummary}}.");
  }

  return lines;
}

function buildTemplateText(contractName: string, fields: DraftField[]): string {
  const sections = [
    `# ${toHeadline(contractName)}`,
    "",
    ...buildIntroduction(fields),
    ...buildOperationalClauses(fields),
  ].filter((line, index, lines) => {
    if (line !== "") {
      return true;
    }

    return index > 0 && lines[index - 1] !== "";
  });

  return `${sections.join("\n")}\n`;
}

function buildModelText(contractName: string, namespace: string, fields: DraftField[]): string {
  const fieldLines = fields.map((field) => `  o ${field.type} ${field.name}`);

  return `${[
    `namespace ${namespace}`,
    "",
    "@template",
    `concept ${contractName} {`,
    ...fieldLines,
    "}",
    "",
  ].join("\n")}`;
}

function buildSampleData(contractName: string, namespace: string, fields: DraftField[]): Record<string, string | boolean | number> {
  const data: Record<string, string | boolean | number> = {
    $class: `${namespace}.${contractName}`,
  };

  fields.forEach((field) => {
    data[field.name] = field.defaultValue;
  });

  return data;
}

export function generateDraftTemplate(extracted: ExtractedContract): DraftTemplate {
  const contractName = extracted.contractName;
  const namespace = DEFAULT_NAMESPACE;
  const templateText = buildTemplateText(contractName, extracted.fields);
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
