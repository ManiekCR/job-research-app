import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { findLearningResources } from "@/lib/learning-resources";
import { GenerateApplication } from "./generate-application";
import { PublishedDate } from "@/components/published-date";
import { EstimateSalary } from "./estimate-salary";
import { Icon } from "@/components/icons";
import { formatSalaryRange, type SalaryPeriod } from "@/lib/salary";
import type { SalaryEstimateView } from "./actions";

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

type SalaryEstimateRow = {
  min_eur: number;
  max_eur: number;
  confidence: "low" | "medium" | "high";
  rationale: string;
  negotiation_tips: string[];
  model: string;
  created_at: string;
} | null;

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
    <div className="flex max-w-3xl flex-col gap-3 text-sm leading-[22px] text-text-2">
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) {
          return (
            <h3 key={index} className="font-heading text-base font-semibold text-text">
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
      "id, title, location, is_remote, url, posted_at, source, description, is_hidden, salary_min, salary_max, salary_currency, salary_period, salary_yearly_min, salary_yearly_max, salary_source, companies(name), job_scores(hard_skills_score, soft_skills_score, experience_score, languages_score, final_score, missing_skills, reasoning) , salary_estimates(min_eur, max_eur, confidence, rationale, negotiation_tips, model, created_at)"
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
  const estimateRow = asSingle<SalaryEstimateRow>(job.salary_estimates);
  const initialEstimate: SalaryEstimateView | null = estimateRow
    ? {
        minEur: estimateRow.min_eur,
        maxEur: estimateRow.max_eur,
        confidence: estimateRow.confidence,
        rationale: estimateRow.rationale,
        negotiationTips: estimateRow.negotiation_tips,
        model: estimateRow.model,
        createdAt: estimateRow.created_at,
      }
    : null;
  const offeredPeriod = job.salary_period as SalaryPeriod | null;
  const hasOffered =
    job.salary_min != null && job.salary_max != null && job.salary_currency && offeredPeriod;
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

  const subScores = score
    ? [
        { label: "Hard skills", value: score.hard_skills_score },
        { label: "Soft skills", value: score.soft_skills_score },
        { label: "Experience", value: score.experience_score },
        { label: "Languages", value: score.languages_score },
      ]
    : [];
  const scoreLabel = !score
    ? null
    : score.final_score >= 70
      ? "Strong match"
      : score.final_score >= 40
        ? "Partial match"
        : "Weak match";
  const scoreColor = !score
    ? ""
    : score.final_score >= 70
      ? "var(--good)"
      : score.final_score >= 40
        ? "var(--warn)"
        : "var(--bad)";

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 p-4 md:px-10 md:pb-10 md:pt-7">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-text-3">
        <Link href="/jobs" className="font-medium !text-text-3">
          Jobs
        </Link>
        <Icon name="chevronRight" size={13} />
        <span aria-current="page" className="truncate text-text-2">
          {job.title}
        </span>
      </nav>

      <header className="flex flex-col justify-between gap-5 md:flex-row md:items-start md:gap-8">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="font-heading m-0 text-[22px] font-semibold leading-7 tracking-[-0.02em] md:text-[30px] md:leading-9">
            {job.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-2">
            <span className="font-semibold text-text">{company?.name ?? "Unknown company"}</span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="pin" className="text-text-3" />
              {job.is_remote ? "Remote" : (job.location ?? "Location unknown")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="clock" className="text-text-3" />
              <PublishedDate iso={job.posted_at} />
            </span>
            <span className="chip font-num !rounded-md !text-[11px]">{job.source}</span>
            {job.is_hidden && (
              <span className="chip chip-accent">
                <Icon name="eyeOff" size={13} />
                Probably not on LinkedIn/Indeed
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-2.5">
            <a href="#application-kit" className="btn btn-primary">
              <Icon name="applications" />
              Generate CV + letter
            </a>
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              View original posting
              <Icon name="external" />
            </a>
          </div>
        </div>

        {score && (
          <div className="card flex shrink-0 items-center gap-4 self-start py-4 pl-4 pr-5">
            <div
              role="img"
              aria-label={`Match score ${score.final_score} out of 100`}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(${scoreColor} 0 ${score.final_score}%, var(--surface-3) ${score.final_score}% 100%)`,
              }}
            >
              <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-surface">
                <span className="font-num text-[22px] font-medium" style={{ color: scoreColor }}>
                  {score.final_score}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-heading text-base font-semibold">{scoreLabel}</span>
              <span className="caption">Out of 100</span>
            </div>
          </div>
        )}
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          {score && (
            <section className="card flex flex-col gap-5 p-5 md:p-6">
              <h2 className="section-title !text-lg">Why this score</h2>
              {score.reasoning && (
                <p className="m-0 text-[15px] leading-6 text-text [text-wrap:pretty]">{score.reasoning}</p>
              )}
              <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {subScores.map((sub) => (
                  <li key={sub.label} className="flex flex-col gap-2">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-text-2">{sub.label}</span>
                      <span className="font-num font-medium">{sub.value}</span>
                    </div>
                    <div className="flex h-1.5 rounded-full bg-surface-3">
                      <span className="rounded-full bg-accent" style={{ width: `${sub.value}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="caption m-0 flex items-center gap-1.5">
                The model rates the four parts. The final score is computed in code from them.
              </p>
            </section>
          )}

          {score && score.missing_skills.length > 0 && (
            <section className="card flex flex-col gap-4 p-5 md:p-6">
              <div className="flex flex-col gap-1">
                <h2 className="section-title !text-lg">Skills to close the gap</h2>
                <span className="caption">Ranked by impact on the score, most penalising first</span>
              </div>
              <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
                {score.missing_skills.map((skill, index) => (
                  <li
                    key={skill}
                    className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-[10px] border border-line px-4 py-3.5"
                  >
                    <span className="font-num flex h-6 w-6 items-center justify-center rounded-md bg-surface-2 text-xs text-text-2">
                      {index + 1}
                    </span>
                    <div className="flex flex-col gap-1.5">
                      <span className="font-semibold">{skill}</span>
                      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {findLearningResources(skill).map((resource) => (
                          <li key={resource.url}>
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[13px] font-medium"
                            >
                              {resource.label}
                              <Icon name="arrowUpRight" size={12} />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div id="application-kit" className="scroll-mt-6">
            <GenerateApplication jobId={job.id} />
          </div>

          <section id="description" className="card flex scroll-mt-6 flex-col gap-3.5 p-5 md:p-6">
            <h2 className="section-title !text-lg">Full description</h2>
            <DescriptionBlock text={job.description ?? ""} />
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <section className="card flex flex-col gap-4 p-5">
            <h2 className="section-title !text-lg">Salary</h2>
            <div className="flex flex-col gap-1.5">
              <span className="label">Offered</span>
              {hasOffered ? (
                <>
                  <span className="font-num text-xl font-medium leading-[26px]">
                    {formatSalaryRange(job.salary_min, job.salary_max, job.salary_currency, offeredPeriod)}
                  </span>
                  {offeredPeriod !== "year" && job.salary_yearly_min != null && job.salary_yearly_max != null && (
                    <span className="caption">
                      ≈ {formatSalaryRange(job.salary_yearly_min, job.salary_yearly_max, job.salary_currency, "year")}{" "}
                      (assumes full time)
                    </span>
                  )}
                  <span className="caption flex items-center gap-1.5">
                    <Icon name="check" size={13} className="text-good" />
                    {job.salary_source === "llm_extracted"
                      ? "Extracted from the posting by the AI (quote verified in code)."
                      : "Given by the source."}
                  </span>
                </>
              ) : (
                <span className="text-sm text-text-3">Not stated in the posting</span>
              )}
            </div>
            <EstimateSalary jobId={job.id} initial={initialEstimate} />
          </section>

          <section className="card flex flex-col gap-3 p-5">
            <h2 className="section-title !text-lg">Company</h2>
            {techKeywords.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="label">Tech stack mentioned</span>
                <div className="flex flex-wrap gap-1.5">
                  {techKeywords.map((kw) => (
                    <span key={kw} className="chip font-num !rounded-md !text-[11px]">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <ul className="flex flex-col gap-1">
              {companyLinks.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="row-link flex items-center justify-between gap-2 px-2 py-2 !text-accent-fg text-[13px] font-medium"
                  >
                    {link.label}
                    <Icon name="external" size={13} />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
