"use client";

import { useState } from "react";
import { generateApplication, type GeneratedApplication } from "./actions";

export function GenerateApplication({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GeneratedApplication | null>(null);

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

  if (!data) {
    return (
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
          CV + lettre de motivation ciblés
        </h2>
        <button
          type="button"
          disabled={loading}
          onClick={handleGenerate}
          className="mt-2 rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Génération..." : "Générer CV + lettre"}
        </button>
        {error && <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
          CV + lettre de motivation ciblés
        </h2>
        <span className="text-xs text-zinc-500">Langue : {data.detectedLanguage}</span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Relis et corrige avant export — rien n&apos;est encore enregistré.
      </p>

      <label className="mt-4 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Accroche
      </label>
      <input
        value={data.headline}
        onChange={(e) => setData({ ...data, headline: e.target.value })}
        className="mt-1 w-full rounded border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-900"
      />

      <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Résumé
      </label>
      <textarea
        value={data.summary}
        onChange={(e) => setData({ ...data, summary: e.target.value })}
        rows={4}
        className="mt-1 w-full rounded border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-900"
      />

      <p className="mt-4 text-xs font-medium text-zinc-600 dark:text-zinc-400">Expériences</p>
      {data.experience.map((exp, index) => (
        <div key={index} className="mt-2 rounded border border-black/10 p-2 dark:border-white/10">
          <p className="text-sm font-medium text-black dark:text-zinc-50">
            {exp.title} — {exp.company}
          </p>
          <textarea
            value={exp.highlights.join("\n")}
            onChange={(e) => updateExperienceHighlights(index, e.target.value)}
            rows={Math.max(3, exp.highlights.length)}
            className="mt-1 w-full rounded border border-black/10 px-2 py-1 text-xs dark:border-white/10 dark:bg-zinc-900"
          />
        </div>
      ))}

      <label className="mt-4 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Lettre de motivation
      </label>
      <textarea
        value={data.coverLetter}
        onChange={(e) => setData({ ...data, coverLetter: e.target.value })}
        rows={10}
        className="mt-1 w-full rounded border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-900"
      />

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="mt-3 rounded border border-black/10 px-3 py-1 text-sm dark:border-white/10"
      >
        {loading ? "Régénération..." : "Régénérer"}
      </button>
    </section>
  );
}