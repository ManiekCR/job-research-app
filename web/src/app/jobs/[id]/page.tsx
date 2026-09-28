import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { findLearningResources } from "@/lib/learning-resources";
import { GenerateApplication } from "./generate-application";

type JobScore = {
  hard_skills_score: number;
  soft_skills_score: number;
  experience_score: number;
  languages_score: number;
  final_score: number;
  missing_skills: string[];
  reasoning: string | null;
} | null;

type Company = { name: string } | null;

function asSingle<T>(value: unknown): T {
  return value as T;
}

// Same keyword list as the skills covered by the curated learning links —
// no second list to maintain in duplicate.
const TECH_KEYWORDS = [
  "SQL", "Python", "JavaScript", "TypeScript", "React", "Next.js", "Rails",
  "Git", "REST", "API", "Salesforce", "Scrum", "Agile", "AWS", "Docker",
  "PostgreSQL", "Zendesk", "HubSpot", "Jira", "Figma",
];

function extractTechKeywords(description: string): string[] {
  const lower = description.toLowerCase();
  return TECH_KEYWORDS.filter((kw) => lower.includes(kw.toLowerCase()));
}

// The description is stored as plain text with lightweight Markdown-style
// markup ("## " for a heading, "- " for a bullet — see worker/sources/base.py
// strip_html) rather than HTML, so nothing dangerous gets stored to render
// as-is. It's converted back into styled elements here.
function DescriptionBlock({ text }: { text: string }) {
  const blocks = text.split("\n\n").filter(Boolean);

  return (
    <div className="mt-2 flex flex-col gap-3 text-sm text-zinc-700 dark:text-zinc-300">
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) {
          return (
            <h3 key={index} className="text-base font-semibold text-black dark:text-zinc-50">
              {block.slice(3)}
            </h3>
          );
        }
        if (block.startsWith("- ")) {
          const items = block.split("\n").map((line) => line.replace(/^- /, ""));
          return (
            <ul key={index} className="list-disc pl-5">
              {items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {block}
          </p>
        );
      })}
    </div>
  );
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: job, error } = await supabase
    .from("jobs")
    .select(
      "id, title, location, is_remote, url, posted_at, source, description, is_hidden, companies(name), job_scores(hard_skills_score, soft_skills_score, experience_score, languages_score, final_score, missing_skills, reasoning)"
    )
    .eq("user_id", user!.id)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load the job:", error.message);
  }
  if (!job) notFound();

  const company = asSingle<Company>(job.companies);
  const score = asSingle<JobScore>(job.job_scores);
  const techKeywords = extractTechKeywords(job.description ?? "");
  const companyLinks = company
    ? [
        {
          label: `Search ${company.name} on LinkedIn`,
          url: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(company.name)}`,
        },
        {
          label: `Employee reviews on kununu`,
          url: `https://www.kununu.com/de/search?q=${encodeURIComponent(company.name)}`,
        },
        {
          label: `Employee reviews on Glassdoor`,
          url: `https://www.glassdoor.com/Search/results.htm?keyword=${encodeURIComponent(company.name)}`,
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/jobs" className="text-sm text-zinc-500 hover:underline">
        ← Back to jobs
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-black dark:text-zinc-50">
        {job.title}
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {company?.name ?? "Unknown company"}
        {" · "}
        {job.is_remote ? "Remote" : job.location}
        {" · "}
        source: {job.source}
      </p>

      <a
        href={job.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block rounded bg-black px-3 py-1 text-sm text-white dark:bg-white dark:text-black"
      >
        View original posting
      </a>

      {score && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
            Score: {score.final_score}/100
          </h2>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{score.reasoning}</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li>Hard skills: {score.hard_skills_score}/100</li>
            <li>Soft skills: {score.soft_skills_score}/100</li>
            <li>Experience: {score.experience_score}/100</li>
            <li>Languages: {score.languages_score}/100</li>
          </ul>
        </section>
      )}

      {score && score.missing_skills.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
            To learn to improve the score
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Ranked by impact on the score, from most to least penalizing.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {score.missing_skills.map((skill, index) => (
              <li key={skill} className="rounded border border-black/10 p-3 dark:border-white/10">
                <p className="text-sm font-medium text-black dark:text-zinc-50">
                  {index + 1}. {skill}
                </p>
                <ul className="mt-1 flex flex-wrap gap-x-3 text-sm text-blue-700 dark:text-blue-400">
                  {findLearningResources(skill).map((resource) => (
                    <li key={resource.url}>
                      <a href={resource.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {resource.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Company</h2>
        {techKeywords.length > 0 && (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Tech stack mentioned: {techKeywords.join(", ")}
          </p>
        )}
        <ul className="mt-2 flex flex-col gap-1">
          {companyLinks.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-700 hover:underline dark:text-blue-400"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <GenerateApplication jobId={job.id} />

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Full description</h2>
        <DescriptionBlock text={job.description ?? ""} />
      </section>
    </div>
  );
}
