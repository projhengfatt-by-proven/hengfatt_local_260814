import { createContext, useContext, useReducer, ReactNode } from "react";
import type { ToolCall } from "@/lib/ariaClient";
import type { AdminOverview } from "@/components/admin/adminOverview";

export type AdminMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type AdminPendingAction = ToolCall & {
  title: string;
  description: string;
};

interface AdminCommandState {
  messages: AdminMessage[];
  pendingActions: AdminPendingAction[];
  overview: AdminOverview | null;
  isThinking: boolean;
  isChatOpen: boolean;
  /** Set by a page (e.g. the Copilot quick-start view) to pre-fill the persistent chat panel's input; consumed and cleared by AdminChatPanel. */
  draftInput: string | null;
}

type Action =
  | { type: "ADD_MESSAGE"; message: AdminMessage }
  | { type: "UPSERT_ASSISTANT"; id: string; content: string }
  | { type: "SET_THINKING"; value: boolean }
  | { type: "SET_OVERVIEW"; overview: AdminOverview | null }
  | { type: "SET_PENDING_ACTIONS"; actions: AdminPendingAction[] }
  | { type: "DISMISS_PENDING_ACTION"; id: string }
  | { type: "TOGGLE_CHAT" }
  | { type: "SET_CHAT_OPEN"; open: boolean }
  | { type: "SET_DRAFT_INPUT"; value: string | null };

const initialState: AdminCommandState = {
  messages: [],
  pendingActions: [],
  overview: null,
  isThinking: false,
  isChatOpen: true,
  draftInput: null,
};

function reducer(state: AdminCommandState, action: Action): AdminCommandState {
  switch (action.type) {
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] };
    case "UPSERT_ASSISTANT": {
      const exists = state.messages.some((item) => item.id === action.id);
      if (exists) {
        return {
          ...state,
          messages: state.messages.map((item) =>
            item.id === action.id ? { ...item, content: action.content } : item
          ),
        };
      }
      return {
        ...state,
        messages: [...state.messages, { id: action.id, role: "assistant", content: action.content }],
      };
    }
    case "SET_THINKING":
      return { ...state, isThinking: action.value };
    case "SET_OVERVIEW":
      return { ...state, overview: action.overview };
    case "SET_PENDING_ACTIONS":
      return { ...state, pendingActions: action.actions };
    case "DISMISS_PENDING_ACTION":
      return { ...state, pendingActions: state.pendingActions.filter((item) => item.id !== action.id) };
    case "TOGGLE_CHAT":
      return { ...state, isChatOpen: !state.isChatOpen };
    case "SET_CHAT_OPEN":
      return { ...state, isChatOpen: action.open };
    case "SET_DRAFT_INPUT":
      return { ...state, draftInput: action.value };
    default:
      return state;
  }
}

interface AdminCommandContextValue {
  state: AdminCommandState;
  dispatch: React.Dispatch<Action>;
}

const AdminCommandCtx = createContext<AdminCommandContextValue | null>(null);

export function AdminCommandProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return <AdminCommandCtx.Provider value={{ state, dispatch }}>{children}</AdminCommandCtx.Provider>;
}

export function useAdminCommand() {
  const ctx = useContext(AdminCommandCtx);
  if (!ctx) throw new Error("useAdminCommand must be used within AdminCommandProvider");
  return ctx;
}

/** Maps a Copilot "screen" name (from admin_navigate / the deterministic navigate intent) to a real admin route. */
const SCREEN_TO_PATH: Partial<Record<string, string>> = {
  dashboard: "/admin",
  agents: "/admin/agents",
  activity: "/admin/activity",
  listings: "/admin/listings",
  insights: "/admin/insights",
  applications: "/admin/applications",
  reports: "/admin/reports",
  settings: "/admin/settings",
  copilot: "/admin/copilot",
};

export function pathForScreen(screen: string): string | null {
  return SCREEN_TO_PATH[screen] ?? null;
}
