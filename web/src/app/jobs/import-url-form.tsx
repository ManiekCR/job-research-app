"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
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
    // Move to the details step even if the auto-fetch failed: the user can
    // still fill in the fields by hand.
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
      <div className="card flex flex-col gap-2.5 p-4">
        <label htmlFor="import-url" className="section-title">
          Import a job from a URL
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="import-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.linkedin.com/jobs/view/..."
            className="field"
          />
          <button
            type="button"
            disabled={!url || loading}
            onClick={handleFetchPreview}
            className="btn btn-secondary"
          >
            <Icon name="link" />
            {loading ? "Fetching…" : "Fetch"}
          </button>
        </div>
        {error && <p className="alert alert-bad">{error}</p>}
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3 p-4">
      <p className="section-title">Check and complete before importing</p>
      {error && <p className="alert alert-bad">{error}</p>}
      <div className="grid gap-3 md:grid-cols-3">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Job title"
          aria-label="Job title"
          className="field"
        />
        <input
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          placeholder="Company"
          aria-label="Company"
          className="field"
        />
        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Location"
          aria-label="Location"
          className="field"
        />
      </div>
      <label className="switch">
        <input
          type="checkbox"
          checked={isRemote}
          onChange={(event) => setIsRemote(event.target.checked)}
        />
        <span className="track" />
        Remote
      </label>
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Description (auto-filled if found)"
        aria-label="Description"
        rows={4}
        className="field"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!title || !company || loading}
          onClick={handleImport}
          className="btn btn-primary"
        >
          {loading ? "Importing…" : "Import"}
        </button>
        <button type="button" onClick={reset} className="btn btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}
