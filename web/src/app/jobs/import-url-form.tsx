"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJobPreview, importJob } from "./actions";

export function ImportUrlForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<"url" | "details">("url");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [description, setDescription] = useState("");

  async function handleFetchPreview() {
    setLoading(true);
    setError(null);
    const result = await fetchJobPreview(url);
    setLoading(false);
    if (result.ok) {
      setTitle(result.title);
      setCompany(result.company);
      setLocation(result.location);
      setDescription(result.description);
    } else {
      setError(result.error);
    }
    // On passe à la saisie même si la récupération auto a échoué : l'utilisateur
    // peut toujours remplir les champs à la main.
    setStep("details");
  }

  async function handleImport() {
    setLoading(true);
    setError(null);
    const result = await importJob({ url, title, company, location, isRemote, description });
    setLoading(false);
    if (result.ok) {
      reset();
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  function reset() {
    setUrl("");
    setTitle("");
    setCompany("");
    setLocation("");
    setIsRemote(false);
    setDescription("");
    setStep("url");
    setError(null);
  }

  if (step === "url") {
    return (
      <div className="mt-4 rounded border border-black/10 p-4 dark:border-white/10">
        <p className="text-sm font-medium text-black dark:text-zinc-50">
          Importer une offre depuis une URL
        </p>
        <div className="mt-2 flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.linkedin.com/jobs/view/..."
            className="flex-1 rounded border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-900"
          />
          <button
            type="button"
            disabled={!url || loading}
            onClick={handleFetchPreview}
            className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? "Récupération..." : "Récupérer"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2 rounded border border-black/10 p-4 dark:border-white/10">
      <p className="text-sm font-medium text-black dark:text-zinc-50">
        Vérifie et complète avant d&apos;importer
      </p>
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Titre du poste"
        className="rounded border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-900"
      />
      <input
        value={company}
        onChange={(event) => setCompany(event.target.value)}
        placeholder="Entreprise"
        className="rounded border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-900"
      />
      <input
        value={location}
        onChange={(event) => setLocation(event.target.value)}
        placeholder="Lieu"
        className="rounded border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-900"
      />
      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={isRemote}
          onChange={(event) => setIsRemote(event.target.checked)}
        />
        Remote
      </label>
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Description (collée automatiquement si trouvée)"
        rows={4}
        className="rounded border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-900"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!title || !company || loading}
          onClick={handleImport}
          className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Import..." : "Importer"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded border border-black/10 px-3 py-1 text-sm dark:border-white/10"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}