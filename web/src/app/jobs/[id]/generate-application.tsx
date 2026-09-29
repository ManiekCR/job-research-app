"use client";

import { useState } from "react";
import { pdf, type DocumentProps } from "@react-pdf/renderer";
import { Icon } from "@/components/icons";
import { generateApplication, saveApplicationDocument, type GeneratedApplication } from "./actions";
import { CvDocument } from "@/lib/pdf/cv-document";
import { CoverLetterDocument } from "@/lib/pdf/cover-letter-document";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function GenerateApplication({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GeneratedApplication | null>(null);
  const [pdfLoading, setPdfLoading] = useState<"cv" | "letter" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedKinds, setSavedKinds] = useState<Set<"cv" | "letter">>(new Set());

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    const result = await generateApplication(jobId);
    setLoading(false);
    if (result.ok) {
      setData(result.data);
    } else {
      setError(result.error);
    }
  }

  function updateExperienceHighlights(index: number, value: string) {
    if (!data) return;
    const experience = [...data.experience];
    experience[index] = { ...experience[index], highlights: value.split("\n").filter(Boolean) };
    setData({ ...data, experience });
  }

  const fieldLabel = "label";

  if (!data) {
    return (
      <section className="card flex flex-col items-start gap-3 p-5 md:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="section-title !text-lg">Tailored CV + cover letter</h2>
          <span className="caption">
            Written from your master CV. Identity and dates are copied by code, never generated.
          </span>
        </div>
        <button type="button" disabled={loading} onClick={handleGenerate} className="btn btn-primary">
          <Icon name="applications" />
          {loading ? "Generating…" : "Generate CV + letter"}
        </button>
        {error && <p className="alert alert-bad">{error}</p>}
      </section>
    );
  }

  async function handleDownload(kind: "cv" | "letter") {
    if (!data) return;
    setPdfLoading(kind);
    setSaveError(null);
    const blob =
      kind === "cv"
        ? await pdf(<CvDocument data={data} />).toBlob()
        : await pdf(<CoverLetterDocument data={data} />).toBlob();
    downloadBlob(
      blob,
      kind === "cv" ? `cv-${slugify(data.companyName)}.pdf` : `cover-letter-${slugify(data.companyName)}.pdf`,
    );
    const base64 = await blobToBase64(blob);
    const result = await saveApplicationDocument(jobId, kind === "cv" ? "cv" : "cover_letter", base64);
    if (result.ok) {
      setSavedKinds((prev) => new Set(prev).add(kind));
    } else {
      setSaveError(result.error);
    }
    setPdfLoading(null);
  }

  return (
    <section className="card flex flex-col gap-4 p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="section-title !text-lg">Tailored CV + cover letter</h2>
          <span className="caption">Review and edit before exporting. Nothing is saved yet.</span>
        </div>
        <span className="chip shrink-0">Language: {data.detectedLanguage}</span>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Headline</span>
        <input
          value={data.headline}
          onChange={(e) => setData({ ...data, headline: e.target.value })}
          className="field"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Summary</span>
        <textarea
          value={data.summary}
          onChange={(e) => setData({ ...data, summary: e.target.value })}
          rows={4}
          className="field"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>Experience</span>
        {data.experience.map((exp, index) => (
          <div key={index} className="flex flex-col gap-1.5 rounded-[10px] border border-line p-3">
            <span className="text-sm font-semibold">
              {exp.title} <span className="font-normal text-text-3">· {exp.company}</span>
            </span>
            <textarea
              value={exp.highlights.join("\n")}
              onChange={(e) => updateExperienceHighlights(index, e.target.value)}
              rows={Math.max(3, exp.highlights.length)}
              aria-label={`Highlights for ${exp.title} at ${exp.company}`}
              className="field !text-[13px]"
            />
          </div>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Cover letter</span>
        <textarea
          value={data.coverLetter}
          onChange={(e) => setData({ ...data, coverLetter: e.target.value })}
          rows={10}
          className="field"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleGenerate} disabled={loading} className="btn btn-secondary">
          <Icon name="refresh" className={loading ? "animate-spin" : ""} />
          {loading ? "Regenerating…" : "Regenerate"}
        </button>
        <button
          type="button"
          disabled={pdfLoading !== null}
          onClick={() => handleDownload("cv")}
          className="btn btn-primary"
        >
          {pdfLoading === "cv" ? "Generating PDF…" : "Download CV (PDF)"}
        </button>
        <button
          type="button"
          disabled={pdfLoading !== null}
          onClick={() => handleDownload("letter")}
          className="btn btn-primary"
        >
          {pdfLoading === "letter" ? "Generating PDF…" : "Download letter (PDF)"}
        </button>
      </div>

      {saveError && (
        <p className="alert alert-bad">
          Downloaded, but not saved to the application tracker: {saveError}
        </p>
      )}
      {savedKinds.size > 0 && (
        <p className="alert alert-good">
          Saved to the application tracker ({[...savedKinds].join(", ")}).
        </p>
      )}
    </section>
  );
}
