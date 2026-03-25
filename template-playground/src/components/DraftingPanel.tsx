import { Button } from "antd";
import { useMemo, useState } from "react";
import { createDraftFromBrief } from "../drafting";
import type { DraftTemplate, ExtractedContract, ValidationReport } from "../drafting";
import useAppStore from "../store/store";

interface DraftingResult {
  extracted: ExtractedContract;
  draft: DraftTemplate;
  validation: ValidationReport;
}

const EXAMPLE_BRIEF =
  "The buyer purchases goods from the seller. The shipper delivers the goods to the receiver. Payment is due 30 days after delivery. Inspection must be passed, accepted goods are paid, and a penalty applies if delivery fails.";

function renderValidationSummary(validation: ValidationReport): string {
  if (validation.isValid) {
    return "Aligned";
  }

  return `${validation.missingInModel.length} missing / ${validation.unusedModelFields.length} unused`;
}

export default function DraftingPanel() {
  const applyGeneratedDraft = useAppStore((state) => state.applyGeneratedDraft);
  const backgroundColor = useAppStore((state) => state.backgroundColor);
  const textColor = useAppStore((state) => state.textColor);
  const [brief, setBrief] = useState(EXAMPLE_BRIEF);
  const [result, setResult] = useState<DraftingResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const surfaceColor = backgroundColor === "#ffffff" ? "#f8fafc" : "#111827";
  const borderColor = backgroundColor === "#ffffff" ? "#cbd5e1" : "#374151";
  const mutedTextColor = backgroundColor === "#ffffff" ? "#475569" : "#cbd5e1";
  const codeBackground = backgroundColor === "#ffffff" ? "#e2e8f0" : "#0f172a";

  const extractedPreview = useMemo(() => {
    if (!result) {
      return "";
    }

    return JSON.stringify(result.extracted, null, 2);
  }, [result]);

  const validationSummary = useMemo(() => {
    if (!result) {
      return "No draft generated yet";
    }

    return renderValidationSummary(result.validation);
  }, [result]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      const nextResult = createDraftFromBrief(brief);
      setResult(nextResult);

      await applyGeneratedDraft({
        templateMarkdown: nextResult.draft.templateText,
        modelCto: nextResult.draft.modelText,
        data: JSON.stringify(nextResult.draft.sampleData, null, 2),
      });
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section
      className="main-container-drafting-panel"
      style={{ backgroundColor: surfaceColor, borderColor, color: textColor }}
    >
      <div className="main-container-drafting-header">
        <div>
          <h2 className="main-container-drafting-title">Agentic Template Drafting MVP</h2>
          <p className="main-container-drafting-subtitle" style={{ color: mutedTextColor }}>
            Paste a plain-English contract brief to generate a deterministic draft into the editors below.
          </p>
        </div>
        <Button type="primary" onClick={() => void handleGenerate()} loading={isGenerating} disabled={!brief.trim()}>
          Generate Draft
        </Button>
      </div>

      <label className="main-container-drafting-label" htmlFor="contract-brief">
        Contract Brief
      </label>
      <textarea
        id="contract-brief"
        className="main-container-drafting-textarea"
        value={brief}
        onChange={(event) => setBrief(event.target.value)}
        placeholder="Describe the contract, parties, timing, conditions, payment, and penalties."
        style={{ backgroundColor, color: textColor, borderColor }}
      />

      <div className="main-container-drafting-meta" style={{ color: mutedTextColor }}>
        <span>Validation: {validationSummary}</span>
        {generationError && <span className="main-container-drafting-error">{generationError}</span>}
      </div>

      {result && (
        <div className="main-container-drafting-results">
          <details open>
            <summary>Structured intermediate representation</summary>
            <pre style={{ backgroundColor: codeBackground }}>{extractedPreview}</pre>
          </details>

          <details>
            <summary>Draft template text</summary>
            <pre style={{ backgroundColor: codeBackground }}>{result.draft.templateText}</pre>
          </details>

          <details>
            <summary>Draft Concerto model</summary>
            <pre style={{ backgroundColor: codeBackground }}>{result.draft.modelText}</pre>
          </details>

          <details open>
            <summary>Validation report</summary>
            <div className="main-container-drafting-validation">
              <div>Text variables: {result.validation.textVariables.join(", ") || "None"}</div>
              <div>Model fields: {result.validation.modelFields.join(", ") || "None"}</div>
              <ul>
                {result.validation.issues.map((issue) => (
                  <li key={`${issue.severity}-${issue.field ?? issue.message}`}>
                    <strong>{issue.severity.toUpperCase()}</strong>: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
