# Job Search HQ — Project Guide for Claude

Personal, single-user job search platform. Portfolio piece for Marian Caron (Berlin-based, ex-customer-facing fintech/travel/SaaS, Le Wagon 2019 bootcamp grad, targeting Solutions Engineer / Customer Success / TAM / Product Ops / Junior Software Engineer roles).

**Working language: English** (conversation, code, comments, UI, docs — switched from French in Sept 2026; if you find French text anywhere, it's a leftover to translate, not intentional).

## Collaboration model — read this first

**"I code, Claude guides."** The user writes the application code themselves. Claude's default mode is to explain concepts, give code as text blocks to paste, and review/test — not to autonomously implement features.

Exceptions where Claude may write/edit files directly:
- SQL migrations (`web/supabase/migrations/`) — always written directly by Claude; SQL isn't a "teaching" opportunity the same way app code is.
- Small, well-scoped bug fixes discovered live during testing.
- Anything the user explicitly asks Claude to do directly ("make the change", "fix it").
- Large mechanical/non-learning tasks (e.g. a full-repo translation pass) when the user asks for it directly.

When deviating from the default, say so transparently in the same turn.

## Workflow habits (always follow these)

- Before starting any new feature branch: `git fetch origin && git checkout main && git pull origin main`, then delete any already-merged local branch.
- Every feature/fix goes on its own branch → PR → merge. **Never commit directly to `main`.**
- After opening a PR, watch its checks in the background (`gh pr checks <N>`) and report pass/fail to the user before calling it ready to merge.
- Verify third-party library/API behavior empirically (curl, reading installed package source/types) rather than trusting training data — this stack moves fast and has repeatedly diverged from what's "well known" (Vercel AI SDK exports, `@react-pdf/renderer` exports, Resend's test-domain recipient restriction, Vercel Cron's auth header behavior, etc. all needed live verification).
- `web/AGENTS.md` (imported into `web/CLAUDE.md` via `@AGENTS.md`, auto-managed by `next dev` — don't hand-edit that line) warns that this Next.js version has real breaking changes vs. training data; read `web/node_modules/next/dist/docs/` before writing Next.js-specific code (route handlers, layouts, typed routes, etc.). `tsc --noEmit` depends on Next-generated ambient types — run `npx next typegen` first on a clean checkout (CI does this; see `.github/workflows/test.yml`).

## Architecture

```
[Browser] ──► [Next.js 16 web app — Vercel]
                     │  ├─ pages: jobs, job detail, applications, settings, profile
                     │  ├─ CV / letter / LinkedIn message generation (LLM, Vercel AI SDK)
                     │  └─ "Scrape" button ──► triggers ──┐
                     ▼                                     ▼
              [Supabase]  ◄──── writes jobs + scores ── [Python worker — GitHub Actions]
              Postgres + Auth + PDF Storage                ├─ multi-source collection
                                                            ├─ dedup + "hidden" badge
                                                            └─ LLM scoring (LiteLLM)
                     ▲
                     │
              [Vercel cron 1×/day] ──► reminder email (Resend)
```

Monorepo: `web/` (Next.js App Router + TypeScript + Tailwind + Supabase), `worker/` (Python, runs only via `workflow_dispatch` on GitHub Actions — never on a schedule, to bound cost). Repo is **public** on GitHub — no secrets ever committed (`.env*` gitignored; `.env.local.example` / `worker/.env.example` document required vars without values).

## Hard constraints (do not violate)

- Budget target: **< €5/month total**. Free tiers only (Vercel, Supabase, Resend); LLM calls are the only variable cost, tracked in the `llm_usage` table and shown on the Settings page.
- **Single user, sign-ups disabled.** RLS (`auth.uid() = user_id`) still applies on every table regardless.
- **Scraping is manual-trigger only** (button → `workflow_dispatch`), never a cron, to bound cost/risk.
- **LLM is BYO-key, multi-provider** (Anthropic/OpenAI/Google), key AES-256-GCM encrypted (`web/src/lib/crypto.ts` / `worker/crypto_utils.py`), never sent to the browser.
- **The final match score is always computed in application code** (`worker/scoring.py::compute_final_score`), never trusted as returned by the LLM. This is the single most important invariant in the project — don't let scoring logic move back into a prompt.
- **No LinkedIn automation.** Generated messages are always copy-pasted by the user manually.
- CV/cover-letter/outreach generation: identity/date/company fields are never part of the LLM's output schema (structural anti-hallucination, not just instructional).

## Plan status: all 14 steps (0–13) complete

Original plan: `/home/marian/.claude/plans/r-le-assistant-technique-shimmering-storm.md` (written in French, predates the English switch — translate mentally when reading it). Everything in it has shipped:
auth → schema/RLS → profile+LLM key → worker v1 → realtime progress → LLM scoring → multi-source collection+dedup → "hidden job" badge → job detail page → CV/letter generation+PDF → Kanban+history → reminders/cron/email/contacts+LinkedIn messages → LLM cost tracking+tests+CI+README.

No further steps are planned. Treat any new request as a fresh ask, not a "step 14" — check with the user for direction rather than assuming scope.

## Known gaps / deliberately not done

See the "What's not done" section of the root `README.md` for the current list (ATS company list is a ~10-company starter vs. a ~150 target, no German "Lebenslauf" CV template variant, required German level isn't persisted to the DB, no $ cost estimate for web-side LLM calls, no $ cost estimate for web-side LLM calls (CV/letter, messages, salary estimates), offered salary is empty for jobs scored before F2, dashboard cost meter is "partial" for the same web-side reason). Keep that section and this file in sync if either changes.

## Key locations

- `web/src/app/` — Next.js pages + Server Actions (one `actions.ts` per route segment).
- `web/src/app/_dashboard/` — the dashboard sections at `/` (each an async Server Component in its own `<Suspense>`) and the hand-rolled SVG `column-chart.tsx`; chart colour tokens live in `globals.css` (validated with the dataviz skill's `validate_palette.js`).
- `web/src/lib/dashboard/aggregate.ts` — pure, tested helpers behind the dashboard (Berlin-timezone week bucketing, top-N, reminders, cost/budget). `web/src/components/app-shell.tsx` is the global shell (desktop sidebar, phone top bar + tab bar; hidden on `/login`).
- Design system: tokens (light/dark CSS variables, `bg-surface` / `text-text-2` / `border-line` Tailwind colours) and shared classes (`.card`, `.btn`, `.chip`, `.field`, `.select`, `.switch`, `.alert`…) live in `web/src/app/globals.css`, taken from the "Job Search HQ — Web Design Board" Claude artifact. Use the tokens, never raw `zinc-*` / `dark:` classes. Icons are in `web/src/components/icons.tsx`.
- `web/src/lib/llm/` — LLM provider dispatch (`models.ts`), generation logic + system prompts (`generate-application.ts`, `generate-outreach.ts`).
- `worker/sources/` — one adapter module per job source (`fetch(lookback_hours) -> list[RawJob]` + `SOURCE_NAME` constant); add a source by adding one file + one line in `main.py`'s `SOURCE_MODULES` list.
- `web/supabase/migrations/` — SQL migrations, applied via `npx supabase db push` from `web/`.
- Tests: `worker/tests/` (pytest), `web/src/**/*.test.ts` (Vitest); both run in `.github/workflows/test.yml` on every PR.
