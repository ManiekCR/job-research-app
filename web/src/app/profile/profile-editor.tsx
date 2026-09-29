"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";

// Only the fields the preview reads. Anything else in the JSON is still saved as typed.
type CvPreview = {
  name?: string;
  headline?: string;
  location?: string;
  work_authorization?: string;
  languages?: { name: string; level: string }[];
  experience?: { title: string; company: string; start?: string; end?: string | null }[];
  technical_skills?: string[];
  tools?: string[];
};

function formatMonth(value: string | null | undefined): string {
  if (!value) return "Present";
  const [year, month] = value.split("-");
  return month ? `${month}/${year}` : year;
}

const asList = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export function ProfileEditor({
  initialJson,
  prefilled,
  error,
  saved,
  action,
}: {
  initialJson: string;
  prefilled: boolean;
  error?: string;
  saved: boolean;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [text, setText] = useState(initialJson);

  // Parsed on every keystroke: cheap, and it drives both the validity chip and the preview.
  const parsed = useMemo(() => {
    try {
      const value: unknown = JSON.parse(text);
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return { ok: false as const, message: "Must be a JSON object" };
      }
      return { ok: true as const, cv: value as CvPreview };
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : "Invalid JSON" };
    }
  }, [text]);

  const dirty = text !== initialJson;
  const cv = parsed.ok ? parsed.cv : null;
  const languages = asList<{ name: string; level: string }>(cv?.languages);
  const experience = asList<NonNullable<CvPreview["experience"]>[number]>(cv?.experience);
  const skills = [...asList<string>(cv?.technical_skills), ...asList<string>(cv?.tools)];

  function format() {
    if (parsed.ok) setText(JSON.stringify(parsed.cv, null, 2));
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <h1 className="page-title">Profile</h1>
          <span className="text-[13px] text-text-3">
            Your master CV. The only source used for scoring and for CV and letter generation.
            {prefilled && " Pre-filled from your CV: review and correct before saving."}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {parsed.ok ? (
            <span className="chip chip-good">
              <Icon name="check" size={12} />
              Valid JSON
            </span>
          ) : (
            <span className="chip chip-bad" title={parsed.message}>
              <Icon name="alert" size={12} />
              Invalid JSON
            </span>
          )}
          {dirty && <span className="caption">Unsaved changes</span>}
          <button type="submit" disabled={!parsed.ok} className="btn btn-primary">
            Save profile
          </button>
        </div>
      </header>

      {error && <p className="alert alert-bad">{error}</p>}
      {saved && <p className="alert alert-good">Profile saved.</p>}
      {!parsed.ok && <p className="alert alert-warn font-num">{parsed.message}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section aria-label="CV JSON editor" className="card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line py-2.5 pl-4 pr-3">
            <label htmlFor="cv-json" className="font-num text-xs text-text-2">
              cv.json
            </label>
            <button type="button" onClick={format} disabled={!parsed.ok} className="btn btn-ghost btn-sm">
              Format
            </button>
          </div>
          <textarea
            id="cv-json"
            name="cvJson"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={28}
            spellCheck={false}
            className="font-num min-h-[480px] w-full resize-y border-0 bg-[var(--code-bg)] p-4 text-[12.5px] leading-[21px] text-text focus:outline-2 focus:-outline-offset-2 focus:outline-accent"
          />
        </section>

        <section aria-label="Preview" className="card flex flex-col gap-5 self-start p-5 md:p-6">
          <div className="flex items-center justify-between">
            <span className="label">Preview</span>
            <span className="caption">What the model reads</span>
          </div>
          {cv ? (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="font-heading text-[22px] font-semibold leading-7">{cv.name ?? "No name"}</span>
                {cv.headline && (
                  <span className="text-sm leading-5 text-text-2 [text-wrap:pretty]">{cv.headline}</span>
                )}
                <span className="caption">{[cv.location, cv.work_authorization].filter(Boolean).join(" · ")}</span>
              </div>
              {languages.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <span className="label">Languages</span>
                  <div className="flex flex-wrap gap-2">
                    {languages.map((lang) => (
                      <span key={lang.name} className="chip">
                        {lang.name} · {lang.level}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {experience.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <span className="label">Experience</span>
                  <ol className="m-0 flex list-none flex-col gap-3 p-0">
                    {experience.map((exp, i) => (
                      <li key={i} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
                        <span className="font-num caption pt-0.5">
                          {formatMonth(exp.start)} – {formatMonth(exp.end)}
                        </span>
                        <span className="flex flex-col">
                          <span className="text-[13.5px] font-semibold leading-[19px]">{exp.title}</span>
                          <span className="text-[13px] text-text-3">{exp.company}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {skills.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <span className="label">Technical skills &amp; tools</span>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((skill) => (
                      <span key={skill} className="chip font-num !rounded-md !text-[11px]">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="m-0 text-sm text-text-3">Fix the JSON to see the preview.</p>
          )}
        </section>
      </div>
    </form>
  );
}
