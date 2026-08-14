// ARIA's native tool definitions — Anthropic Messages API "tools" format.
// Replaces the old @@COMMAND@@/@@ACTION@@ text-marker convention: instead
// of instructing the model in prose to emit specially-formatted text the
// client then regexes out, the model now returns a proper structured
// tool_use block per the schema below, which the client (ariaClient.ts /
// AIChatPanel.tsx) consumes directly — no parsing, no malformed-marker risk.
//
// Naming follows the namespaced convention agreed for this phase
// (domain_verb, e.g. lead_create) so future tools stay organized as the
// list grows, rather than a flat list of unrelated verb-first names.

export const ARIA_TOOLS = [
  {
    name: "lead_create",
    description:
      "Create a new lead/prospect in the CRM. Use whenever the agent tells you about a new prospect or enquiry. This performs a real database write.",
    input_schema: {
      type: "object",
      properties: {
        full_name: { type: "string", description: "Full name of the prospect" },
        phone: { type: "string", description: "Phone number, optional" },
        email: { type: "string", description: "Email address, optional" },
        notes: { type: "string", description: "Any notes about the lead, optional" },
      },
      required: ["full_name"],
    },
  },
  {
    name: "lead_update_status",
    description: "Update an existing lead's pipeline status.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "UUID of the lead" },
        status: {
          type: "string",
          enum: ["new", "contacted", "viewing", "offer", "closed", "lost"],
        },
      },
      required: ["lead_id", "status"],
    },
  },
  {
    name: "lead_draft_message",
    description:
      "Draft a message to a lead using the agent's saved templates. This ONLY drafts — it never sends. Tell the user you've drafted something for them to review, never that you've sent or messaged them.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "UUID of the lead" },
        channel: { type: "string", description: "e.g. whatsapp" },
      },
      required: ["lead_id"],
    },
  },
  {
    name: "viewing_book",
    description: "Book a real property viewing for a lead.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "UUID of the lead" },
        property_id: { type: "string", description: "UUID of the property" },
        scheduled_at: {
          type: "string",
          description:
            "Full ISO 8601 datetime WITH the +08:00 Singapore offset, resolved from the current date/time given in context — never a vague phrase like 'tomorrow'.",
        },
        duration_mins: { type: "integer", description: "Optional, defaults to 60" },
      },
      required: ["lead_id", "property_id", "scheduled_at"],
    },
  },
  {
    name: "viewing_reschedule",
    description:
      "Reschedule a lead's upcoming viewing to a new date/time. Resolves the viewing by the lead's name — if that lead has more than one upcoming viewing, the agent will be shown a pick-list instead of guessing which one.",
    input_schema: {
      type: "object",
      properties: {
        lead_name: { type: "string", description: "The lead's name as the agent said it" },
        new_scheduled_at: {
          type: "string",
          description:
            "Full ISO 8601 datetime WITH the +08:00 Singapore offset, resolved from the current date/time given in context — never a vague phrase like 'tomorrow'.",
        },
      },
      required: ["lead_name", "new_scheduled_at"],
    },
  },
  {
    name: "viewing_update_status",
    description:
      "Update the status of a lead's upcoming viewing (confirm it, mark it completed, mark a no-show, or cancel it). Resolves the viewing by the lead's name — if that lead has more than one upcoming viewing, the agent will be shown a pick-list instead of guessing which one.",
    input_schema: {
      type: "object",
      properties: {
        lead_name: { type: "string", description: "The lead's name as the agent said it" },
        status: {
          type: "string",
          enum: ["confirmed", "completed", "cancelled", "no_show"],
        },
        reason: { type: "string", description: "Optional, only used when status is 'cancelled'" },
      },
      required: ["lead_name", "status"],
    },
  },
  {
    name: "viewing_lookup",
    description:
      "Look up the agent's own booked viewings and answer questions about them directly (e.g. 'what's my latest booking', 'when's my next viewing', 'what viewings do I have with John'). Read-only — never mutates anything, so fuzzy name matching is fine here.",
    input_schema: {
      type: "object",
      properties: {
        lead_name: { type: "string", description: "Optional — filter to a specific lead's viewings, fuzzy match" },
        which: {
          type: "string",
          enum: ["latest", "upcoming"],
          description:
            "'latest' = the most recently booked viewing, by when it was created (any status, past or future) — use for phrasing like 'my latest booking'. 'upcoming' = the soonest viewing scheduled from now onward, only pending/confirmed — use for phrasing like 'my next viewing'. Defaults to 'latest' if not specified.",
        },
      },
      required: [],
    },
  },
  {
    name: "task_create",
    description:
      "Create a personal-assistant task/reminder for the agent — a call, follow-up, admin item, or anything else that isn't a property viewing. Use whenever the agent asks you to remind them of something or add something to their to-do list.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "What the task is, e.g. 'Call John about financing'" },
        due_at: {
          type: "string",
          description:
            "Optional. Full ISO 8601 datetime WITH the +08:00 Singapore offset, resolved from the current date/time given in context — never a vague phrase like 'tomorrow'. Omit if the agent didn't give a due date.",
        },
        lead_name: { type: "string", description: "Optional — the lead's name as the agent said it, to link this task to that lead" },
      },
      required: ["title"],
    },
  },
  {
    name: "task_complete",
    description: "Mark an existing task as done, resolved by its title. If more than one open task matches, the agent will be shown a pick-list instead of guessing.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "The task's title (or a fragment of it) as the agent said it" },
      },
      required: ["title"],
    },
  },
  {
    name: "lead_view",
    description:
      "Navigate to a specific lead's detail page by name. Read-only — use this whenever the agent asks to see/view/open a named lead's details. Fuzzy name matching is fine here since nothing mutates; if the name matches more than one lead, the agent will be shown a pick-list instead of guessing.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The lead's name as the agent said it" },
      },
      required: ["name"],
    },
  },
  {
    name: "lead_reassign",
    description:
      "Invite a named colleague to take over a lead the agent currently owns. This only creates a pending request — the colleague still has to accept before ownership actually transfers, so it is never an instant/silent reassignment.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "UUID of the lead" },
        to_agent_name: {
          type: "string",
          description:
            "The colleague's name as the agent said it. You cannot invent an agent id — this must be resolved against real colleagues by name.",
        },
        message: { type: "string", description: "Optional note to include with the request" },
      },
      required: ["lead_id", "to_agent_name"],
    },
  },
  {
    name: "folder_create",
    description:
      "Create a new folder in My Files. Always use this when the user asks to create a folder — without calling this, no folder is actually created.",
    input_schema: {
      type: "object",
      properties: {
        folder_name: { type: "string", description: "Human-readable folder name, e.g. '53 Tras Street'" },
      },
      required: ["folder_name"],
    },
  },
  {
    name: "screen_navigate",
    description: "Navigate the agent's screen to a specific view.",
    input_schema: {
      type: "object",
      properties: {
        screen: {
          type: "string",
          enum: [
            "dashboard", "leads", "lead_detail", "listings", "listing_detail",
            "listing_form", "calendar", "viewing_detail", "crm", "commission_calc",
            "market", "social", "documents", "templates", "notifications", "files",
          ],
        },
        filter: { type: "string", description: "For screen=leads" },
        lead_id: { type: "string", description: "For screen=lead_detail" },
        viewing_id: { type: "string", description: "For screen=viewing_detail" },
        price: { type: "number", description: "For screen=commission_calc" },
        rate: { type: "number", description: "For screen=commission_calc" },
        view: { type: "string", description: "For screen=crm, e.g. pipeline" },
        district: { type: "number", description: "For screen=market" },
        folder_name: { type: "string", description: "For screen=files, optional" },
      },
      required: ["screen"],
    },
  },
];
