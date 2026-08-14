MASTER_05_CREATE_DYNAMIC_PROJECT_AGENT.md

# MASTER 05 — CREATE DYNAMIC PROJECT AGENT

You are now working inside an existing software project.

Your job is NOT to rebuild the project.

Your job is to understand the existing project and establish a dynamic AI development system that can use the centralized AI Builder Knowledge Repository.

Central repository:

D:\AI_Builder_Knowledge

---

# 1. FIRST — INSPECT

Before making significant changes, inspect the project.

Determine:

- application purpose
- current state
- frontend
- backend
- database
- authentication
- authorization
- APIs
- external services
- AI
- automation
- deployment
- testing
- existing documentation
- incomplete features
- technical debt

Do not assume the technology stack.

---

# 2. EXISTING PROJECT

This may be a partially completed project.

Treat existing implementation as valuable.

Use:

UNDERSTAND
→ AUDIT
→ EXTEND
→ IMPROVE

Do not:

REBUILD
→ REPLACE
→ MIGRATE

unless explicitly required.

---

# 3. CREATE / UPDATE AGENTS.MD

Create:

AGENTS.md

in the project root.

If one already exists:

- inspect it
- preserve existing instructions
- merge this system into it

AGENTS.md must tell the coding agent how to use:

D:\AI_Builder_Knowledge

---

# 4. DYNAMIC SKILL DISCOVERY

For each significant task:

1. Understand the task.
2. Identify affected technologies.
3. Identify affected architecture.
4. Identify security implications.
5. Search the central skill catalogue.
6. Select relevant skills.
7. Load only relevant skills.
8. Read references when needed.
9. Implement.
10. Verify.

Do not load the entire repository.

---

# 5. TECHNOLOGY DETECTION

Detect actual project technologies from:

- package.json
- source files
- configuration
- database configuration
- deployment configuration
- environment examples
- documentation

Do not assume:

- React
- Next.js
- Supabase
- OpenAI
- Claude
- Stripe
- n8n

Only use them when the project actually uses them.

---

# 6. SUPABASE

If this project uses Supabase, treat Supabase as a complete platform.

Do NOT treat it merely as a database.

Relevant skills may include:

- Supabase core
- PostgreSQL
- Auth
- JWT/session
- RLS
- authorization
- Storage
- Realtime
- Edge Functions
- webhooks
- external API integration
- vectors
- RAG
- migrations
- CLI
- MCP
- security

Before Supabase implementation, load the relevant Supabase skill.

Prefer the official Supabase Agent Skill and current official documentation.

---

# 7. AI PROVIDERS

If the project uses AI services:

identify which providers are actually used.

Examples:

- OpenAI
- Anthropic
- other providers

Load the appropriate skills.

Do not assume a single provider.

---

# 8. AI ARCHITECTURE

If the project contains an AI assistant or agent, inspect:

- model
- prompts
- tools
- Edge Functions
- API calls
- state
- memory
- RAG
- permissions
- external services
- error handling
- evaluation

Treat AI security as part of application security.

---

# 9. AUTHORIZATION

For authenticated applications, distinguish:

Authentication:
"Who is the user?"

Authorization:
"What is the user allowed to access?"

Check:

- user identity
- roles
- permissions
- RLS
- API authorization
- Edge Function authorization
- tenant isolation
- object-level access

Do not assume frontend checks provide security.

---

# 10. PROJECT CONTEXT

Create:

.ai/project-context.md

Include:

- purpose
- architecture
- stack
- database
- authentication
- AI
- integrations
- deployment
- major constraints

Keep it concise.

---

# 11. PROJECT STATUS

Create:

.ai/project-status.md

Include:

## Completed

## In Progress

## Broken

## Missing

## Technical Debt

## Risks

## Recommended Next Steps

Do not make major changes before understanding this status.

---

# 12. PROJECT-SPECIFIC SKILLS

Support:

.ai/skills/

Project-specific skills override general skills where appropriate.

Examples:

- project architecture
- internal business rules
- internal API conventions
- proprietary workflows
- organization coding conventions

---

# 13. SKILL MANIFEST

For larger projects create:

.ai/skills-manifest.yaml

Record the technologies and capabilities actually used by the project.

---

# 14. TASK EXECUTION

When the user gives a normal development request:

Do NOT ask them to manually specify the skills.

Determine the required skills yourself.

Example:

User:

"Add the ability for users to upload documents and ask the AI assistant questions about them."

The agent should dynamically identify possible requirements such as:

- frontend upload
- authentication
- authorization
- storage
- Edge Functions
- document processing
- embeddings
- vector search
- RAG
- AI provider
- security
- testing

Then load the relevant skills.

---

# 15. EXISTING ARCHITECTURE

When continuing an existing project:

First inspect existing patterns.

Reuse existing:

- components
- functions
- database conventions
- authentication
- APIs
- workflows
- AI architecture

unless there is a strong reason to change them.

Avoid introducing unnecessary technologies.

---

# 16. CURRENT DOCUMENTATION

For rapidly changing technologies:

verify current official documentation.

This is especially important for:

- Supabase
- OpenAI
- Anthropic
- AI SDKs
- authentication
- cloud services

If a local skill conflicts with current official documentation:

follow current authoritative documentation and record the discrepancy.

---

# 17. SECURITY

For significant changes check:

- authentication
- authorization
- RLS
- tenant isolation
- secrets
- API keys
- Edge Functions
- external APIs
- AI tools
- prompt injection
- data exposure

Never expose `.env` secrets.

Never commit credentials.

---

# 18. VERIFICATION

After implementation:

- run relevant tests
- run type checks
- run linting where applicable
- run build
- test affected functionality
- perform security verification
- verify database changes
- verify AI behavior where applicable

Use the selected skills' verification requirements.

---

# 19. ACTIVE SKILLS

For medium or large tasks briefly report:

Active skills:

- ...
- ...
- ...

References:

- ...

Do not dump skill contents.

---

# 20. CENTRAL REPOSITORY FEEDBACK

Do not automatically modify:

D:\AI_Builder_Knowledge

If you discover:

- missing skill
- outdated skill
- incorrect guidance
- useful new pattern
- documentation conflict

record it in:

.ai/skill-feedback.md

---

# 21. NORMAL DEVELOPMENT MODE

Once this setup is complete, normal user requests should be handled dynamically.

The user should NOT need to say:

"Load Supabase Auth skill."

The agent should determine that itself.

The user should be able to say:

"Complete the authentication flow."

or:

"Add the AI assistant capability."

or:

"Fix the agent portal."

and the agent should discover the appropriate knowledge automatically.

---

# 22. FINAL SETUP

Create/update:

AGENTS.md

.ai/project-context.md

.ai/project-status.md

.ai/skills-manifest.yaml
    if appropriate

.ai/skill-feedback.md

Do not modify application functionality merely to create these files.

---

# 23. FINAL REPORT

Report:

Project:
Detected stack:

Frontend:
Backend:
Database:
Authentication:
AI:
External services:
Automation:
Testing:
Deployment:

Project status:
Completed:
Incomplete:
Broken:
Missing:

Central knowledge:
D:\AI_Builder_Knowledge

Dynamic skill loading:
READY / ISSUES

Project documentation:
READY / ISSUES

Security concerns discovered:

1.
2.
3.

Do not begin major feature development until this setup and initial project understanding are complete.