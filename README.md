# Job Search HQ

A personal job search platform: multi-source job collection, a compatibility score against my profile computed in code (never trusted from an LLM), "hidden job" detection (not on LinkedIn/Indeed), offered-salary extraction and an on-demand AI salary estimate, tailored CV + cover letter generation, Kanban application tracking, automatic email follow-ups.

Personal, single-user project (sign-ups disabled), built as a portfolio piece following an **"I code, AI guides"** philosophy: every feature was written by hand, one feature branch at a time, with Claude Code acting as a technical guide (explanations, review, tests) rather than auto-implementing.

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Stack and why](#stack-and-why)
- [Data model](#data-model)
- [Running the project locally](#running-the-project-locally)
- [Tests](#tests)
- [Cost](#cost)
- [Notable engineering decisions](#notable-engineering-decisions)
- [What's not done](#whats-not-done)

## Features

- **Authentication** — Supabase Auth, public sign-up disabled (strictly personal use), every route protected by middleware.
- **Profile** — structured master CV (editable JSON), customizable score weights, encrypted LLM API key (AES-256-GCM) with a validity test before saving.
- **Job collection** — triggered by a button, run in the background by a Python worker (GitHub Actions):
  - Public APIs: [Arbeitnow](https://www.arbeitnow.com/api), [Adzuna](https://developer.adzuna.com/)
  - Guest-mode platforms via [JobSpy](https://github.com/speedyapply/JobSpy) (LinkedIn, Indeed)
  - ATS career pages: Greenhouse, Lever (curated company list, each identifier manually verified — see `worker/sources/ats_companies.py`)
  - Manual job URL import (handy for LinkedIn viewed while signed in)
  - Cross-source deduplication (the same job found on 3 sites = one row, with sources merged)
- **1–100 matching score** — an LLM evaluates 4 sub-scores (hard skills, soft skills, experience, languages) with reasoning; **the final weighted score is computed in code**, never returned as-is by the model. Elimination rule: German C1+ required → score capped at 40.
- **"Hidden job" badge** — detects jobs found via ATS/API but absent from the major platforms (fuzzy matching via Postgres trigram, `pg_trgm`) over the last 30 days.
- **Detailed job page** — missing skills ranked by impact, curated learning links (no URL invented by the LLM), company info (kununu, Glassdoor, LinkedIn).
- **CV + cover letter generation** — an LLM selects/rewords relevant highlights from the master CV (never an invented fact — structurally guaranteed: identity/date/company fields never pass through the LLM's output schema), editable preview, PDF export (`@react-pdf/renderer`), auto-saved to the application tracker.
- **Application tracking** — Kanban with native drag-and-drop (HTML5 Drag & Drop), status-change history (each status is logged only once, not on every back-and-forth), history reset when knowingly moved back to "to apply".
- **Follow-ups** — created automatically (7 days after moving to "Applied"), a panel of today's due reminders, a daily digest email via Vercel cron + Resend.
- **Networking** — contacts per application, LinkedIn message generation (connection request ≤300 characters, follow-up, thank-you) — always copy-pasted by hand, no LinkedIn automation.
- **LLM cost tracking** — every call (scoring, CV/letter generation, messages) logs its tokens; estimated $ cost for scoring (via `litellm.completion_cost`).

## Architecture

```
[Browser] ──► [Next.js web app — Vercel]
                     │  ├─ pages: jobs, job detail, applications, settings
                     │  ├─ CV / letter / LinkedIn message generation (LLM)
                     │  └─ "Scrape" button ──► triggers ──┐
                     ▼                                     ▼
              [Supabase]  ◄──── writes jobs + scores ── [Python worker — GitHub Actions]
              Postgres + Auth + PDF Storage              ├─ multi-source collection
                                                           ├─ dedup + "hidden" badge
                                                           └─ LLM scoring
                     ▲
                     │
              [Vercel cron 1×/day] ──► reminder email (Resend)
```

The worker runs separately because scraping + scoring dozens of jobs takes several minutes — too long for a free serverless function, but free and comfortable on GitHub Actions (unlimited minutes on a public repo, triggered on demand via `workflow_dispatch`).

## Stack and why

| Piece | Choice | Why |
|---|---|---|
| Web app | Next.js 16 (App Router) + TypeScript + Tailwind | The most in-demand stack for the Fullstack/Frontend/Solutions Engineer roles I'm targeting — the project doubles as proof of skill. |
| Database + Auth | Supabase (Postgres) | Plain SQL + built-in Auth + Storage + Row Level Security, without having to build auth myself. |
| Web hosting | Vercel | Automatic deployment on every push, native cron jobs. |
| Worker | Python on GitHub Actions | Python has the richest job-scraping ecosystem ([JobSpy](https://github.com/speedyapply/JobSpy)); Python is also a skill sought after in the target roles. |
| LLM (web) | [Vercel AI SDK](https://sdk.vercel.dev/) | A single interface for Anthropic / OpenAI / Google — the user brings their own key (BYO key), choosing among the three. |
| LLM (worker) | [LiteLLM](https://www.litellm.ai/) | Same role on the Python side, with `completion_cost()` as a bonus for per-call cost estimation without maintaining a price table. |
| PDF | `@react-pdf/renderer` | CV/letter defined as React components, rendered to PDF without a headless browser. |
| Email | [Resend](https://resend.com/) | 3,000 free emails/month, plenty for personal use. |

Next.js/React/Python rather than Rails (which I know better): no server to keep running around the clock to stay free, a much richer multi-provider AI and scraping ecosystem in TS/Python, and closer alignment with the stack sought after in my applications.

## Data model

Main tables (Postgres, RLS on every table — a single row in the world per user, since sign-ups are disabled):

`profile` (master CV + score weights) · `llm_credentials` (encrypted key) · `scrape_runs` · `companies` · `jobs` · `job_scores` · `learning_resources` · `applications` · `application_events` · `reminders` · `contacts` · `outreach_messages` · `llm_usage`

Migration details in `web/supabase/migrations/`.

## Running the project locally

Prerequisites: a Supabase project, an LLM key (Anthropic, OpenAI, or Google), Node.js, and Python 3.12+.

```bash
# Web
cd web
npm install
cp .env.local.example .env.local   # then fill in your own values
npx supabase db push               # applies the migrations
npm run dev

# Worker (manual local run; otherwise via GitHub Actions)
cd worker
cp .env.example .env               # then fill in your own values
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Main environment variables (web): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_MASTER_KEY`, `GITHUB_PAT`/`GITHUB_REPO_OWNER`/`GITHUB_REPO_NAME` (to trigger the worker), `CRON_SECRET`, `RESEND_API_KEY`, `REMINDER_EMAIL_TO`, `NEXT_PUBLIC_APP_URL`.

Main environment variables (worker): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_USER_ID`, `ENCRYPTION_MASTER_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`.

## Tests

```bash
cd web && npm test        # Vitest
cd worker && pytest       # pytest
```

Not exhaustive coverage — a handful of tests targeted at the most sensitive logic: the weighted score calculation and the German C1 cap rule (`worker/tests/test_scoring.py`), HTML cleanup of descriptions (`worker/tests/test_strip_html.py`), LinkedIn URL validation (`web/src/lib/validate-linkedin-url.test.ts`). Both suites, plus `tsc --noEmit`, run automatically on every pull request (`.github/workflows/test.yml`).

## Cost

Target < €5/month: web hosting (Vercel), database (Supabase), and email (Resend) all stay within their free tiers for personal use. The only variable cost is LLM calls, minimized by using a cheap model for scoring (Haiku/mini/Flash) and a more capable model reserved for one-off generations (CV, letters, messages). Real cost is tracked in the app (Settings page) via the `llm_usage` table.

## Notable engineering decisions

- **The final score is never the one returned by the LLM** — the model only provides sub-scores + reasoning; the weighted average and the German C1 elimination rule are computed in code (`compute_final_score`, unit-tested), to stay reproducible independent of variations between models.
- **Structural anti-hallucination rather than instructional** for CV/letter generation: the Zod schemas sent to the LLM simply omit the identity, date, and company fields — the model can't hallucinate what it isn't allowed to return.
- **Exact (not fuzzy) cross-source deduplication** to merge the same job seen on several sites; fuzzy matching (`pg_trgm`) is reserved for "hidden job" detection, where the goal is different (spotting a resemblance, not guaranteeing an identity).
- **No LinkedIn automation**: generated messages are always copy-pasted manually — a deliberate choice to put zero risk on my personal LinkedIn account.
- **Idempotent application history**: a status is only ever logged once (the first time it's reached), so an accidental back-and-forth on the Kanban doesn't make it look like an action (e.g. "applied") happened more than once.

## What's not done

- Deliberately modest ATS company list (10 today, the plan aimed for ~150) — see `worker/sources/ats_companies.py`.
- No German "Lebenslauf" CV template (only one ATS-friendly variant for now).
- The required German level is computed by the LLM on every scoring run but isn't persisted to the database (would need a dedicated migration).
- $ cost not computed for web-side LLM calls (CV/letter, messages) — only tokens are tracked, for lack of a per-model pricing source equivalent to `litellm.completion_cost` on the TypeScript side.
- Offered salary is only extracted for jobs scored after the salary feature shipped; existing jobs stay empty until re-scored.
- $ cost isn't computed for salary estimates either (tokens only), like the other web-side LLM calls.