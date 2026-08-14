# AGENTS.md — HengFatt Property

This file tells any coding agent working in this repo how to use the
**centralized AI Builder Knowledge Repository** instead of guessing at
patterns from training data alone. Set up 2026-08-13 per
`MASTER_05_CREATE_DYNAMIC_PROJECT_AGENT.md`.

## Central knowledge repository

```
C:\Users\eddy\Documents\AI_Site_Buider_Skills_Knowledge\AI_Builder_Knowledge\
```

(The master instruction's default path, `D:\AI_Builder_Knowledge`, does not
exist on this machine — no D: drive is present. Use the path above. If the
repo is ever moved to `D:\AI_Builder_Knowledge`, update this file.)

That repository is self-documenting — read its own `README.md` first if
anything below is unclear. In short:

- `00_MASTER/catalog/skills.csv` / `registry/skills.json` — searchable index of
  all 196 curated skills (id, description, category, quality score, audit status).
- `01_SKILLS/<category>/<name>/SKILL.md` — the actual instructions for one skill.
- `00_MASTER/bundles/*.yaml` — pre-grouped skill sets for a project type.
- `02_KNOWLEDGE/official-docs/<tech>/` — quick per-technology orientation notes.
- `01_SKILLS/_GOLDEN/` — pointers to the 19 highest-trust audited skills.
- `01_SKILLS/_DEPRECATED/` — 12 skills that failed audit, flagged not deleted — avoid these.

This project's own pre-resolved bundle lives at **`.ai/skills-manifest.yaml`**
in this repo — check that first before searching the global catalogue from scratch.

## How to use it on a task in this project

For any non-trivial task:

1. Understand the task, identify the affected technology/architecture/security surface.
2. Check `.ai/skills-manifest.yaml` (this project's curated subset) first.
3. If nothing fits, search `00_MASTER/catalog/skills.csv` by category/keyword.
4. Read the skill's `SKILL.md` — load only what's relevant, don't dump whole categories into context.
5. For Supabase specifically (this project's primary backend): load
   `01_SKILLS/database/supabase/SKILL.md` before writing migrations, RLS
   policies, or Edge Functions — it has a security checklist (RLS on views,
   `SECURITY DEFINER` bypass, never trusting `user_metadata` in JWTs) that's
   directly relevant to this codebase's `agent_profiles`/`leads`/`lead_shares` RLS work.
6. Implement, then verify (type-check, lint, and — for anything touching
   auth/RLS/Edge Functions — a manual security pass).
7. For medium/large tasks, briefly report which skills were used (see MASTER_05 §19)
   — don't paste skill contents into the response, just name them.

Don't ask the user to name a skill ("load the Supabase Auth skill") — work out
which skill(s) apply and load them yourself.

## Known gap specific to this project: n8n

This project's agent-invite orchestration runs on **n8n**
(`n8n/workflows/*.json`, see `BUILD_GUIDE.md` Part C). The knowledge repo's
own README documents this as a **critical, zero-curated-skills gap** — 15
n8n-specific candidates never cleared its curation threshold. For n8n work,
go straight to `05_UPSTREAM/n8n-skills/` (raw, unaudited upstream source) or
n8n's own official docs — do not expect a curated `01_SKILLS/` entry to exist.
Logged in `.ai/skill-feedback.md`.

## Rules that override generic instinct

- **Don't rebuild, replace, or migrate** existing working code (auth flow, RLS
  policies, the ARIA tool-dispatch pattern, `useFileOperations`-style shared
  modules) unless explicitly asked. Understand → audit → extend → improve.
- **Reuse existing conventions** before introducing a new pattern or library —
  see `BUILD_GUIDE.md` Part E for this project's established dual-execution
  pattern (every activity needs both a manual UI path and an ARIA tool path).
- **Treat Supabase as a full platform**, not just a database — Auth, RLS,
  Storage, Edge Functions, and the CLI are all in scope, not just table design.
- **Frontend checks are never security** — every access-control claim must be
  verified against an actual RLS policy or Edge Function auth check, not a
  UI-level role check alone.
- **Verify current docs over a stale skill** for fast-moving tech (Supabase,
  Anthropic/Claude, any AI SDK) — if a curated skill conflicts with current
  official documentation, follow the official docs and record the conflict in
  `.ai/skill-feedback.md`.
- **Never expose `.env` secrets or commit credentials.** This project's
  `service_role` key and n8n webhook secret must only ever live in Supabase
  Edge Function secrets / n8n env vars — never in `.env`, never in a
  `VITE_`-prefixed variable, never pasted into a chat or committed file.

## Project documentation map

- `BUILD_GUIDE.md` — the living build/architecture/roadmap doc. Source of
  truth for what's built vs. placeholder, and the agreed build order.
- `ONBOARDING_CHECKLIST.md` — QA test script for the agent-invite flow.
- `.ai/project-context.md` — concise stack/architecture snapshot for a fresh agent.
- `.ai/project-status.md` — completed / in progress / broken / missing / technical debt / risks.
- `.ai/skills-manifest.yaml` — this project's resolved skill bundle.
- `.ai/skill-feedback.md` — discrepancies found between the knowledge repo and reality.
