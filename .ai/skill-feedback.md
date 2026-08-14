# Skill Feedback — HengFatt Property

Discrepancies/gaps found between the central knowledge repository
(`C:\Users\eddy\Documents\AI_Site_Buider_Skills_Knowledge\AI_Builder_Knowledge\`)
and this project's actual needs. Per `MASTER_05_CREATE_DYNAMIC_PROJECT_AGENT.md`
§20 — never edit the central repo directly from here; this file is the record
of what should eventually be improved there.

---

**2026-08-13 — n8n: critical, zero curated skills, confirmed still true**

The central repo's own `README.md` ("Known gaps") and
`00_MASTER/bundles/n8n-automation.yaml` both already flag this: 15 n8n-specific
`SKILL.md` candidates in `05_UPSTREAM/n8n-skills/` never cleared the curation
quality threshold, so `01_SKILLS/automation/` has no n8n-specific entry — only
generic `workflow-patterns`. This project's live automation (the agent-invite
orchestration in `n8n/workflows/`) is exactly the kind of work this gap
affects. Not a new finding, just confirming it's still current and directly
relevant to active work here — worth prioritizing if the central repo's
curation is ever re-run.

**2026-08-13 — Supabase skills not yet independently audited**

`01_SKILLS/database/supabase` and `01_SKILLS/database/supabase-postgres-best-practices`
are the official vendor-sourced skills (trust_level: high) but carry
`review_status: pending_human_review`, not `audited`, per the repo's own
README §4.1. Being used as this project's primary Supabase reference anyway
(nothing better exists), but flagging: if either turns out to contain a
stale/incorrect claim once someone does read it fully, log the specific
claim here, not just the general caveat.

**2026-08-13 — No AI-provider-usage skill (streaming/model routing/cost/fallback)**

Confirmed absent per the repo's own README known-gaps list. Relevant to this
project's `aria-whatsapp` / ARIA chat streaming client
(`src/lib/ariaClient.ts`) — worth a manual/from-scratch approach for anything
touching streaming-response error handling (this project already hit one bug
here per `BUILD_GUIDE.md` §19: a missing `case "error"` in the chat client's
event-type switch swallowed real API errors silently — a general
AI-provider-usage skill would likely have flagged that pattern).

---

_Add new entries above this line, dated, one per discrepancy. Don't batch
vague summaries — name the specific skill and the specific claim._
