import { createContext, useContext, useReducer, useCallback, ReactNode } from "react";
import type { ToolCall } from "@/lib/ariaClient";
import type { AdminOverview } from "@/components/admin/adminOverview";

export type AdminSection =
  | "dashboard"
  | "agents"
  | "activity"
  | "listings"
  | "insights"
  | "applications"
  | "reports"
  | "settings";

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
  currentSection: AdminSection;
  messages: AdminMessage[];
  pendingActions: AdminPendingAction[];
  overview: AdminOverview | null;
  isThinking: boolean;
  isChatOpen: boolean;
}

type Action =
  | { type: "NAVIGATE"; section: AdminSection }
  | { type: "ADD_MESSAGE"; message: AdminMessage }
  | { type: "UPSERT_ASSISTANT"; id: string; content: string }
  | { type: "SET_THINKING"; value: boolean }
  | { type: "SET_OVERVIEW"; overview: AdminOverview | null }
  | { type: "SET_PENDING_ACTIONS"; actions: AdminPendingAction[] }
  | { type: "DISMISS_PENDING_ACTION"; id: string }
  | { type: "TOGGLE_CHAT" }
  | { type: "SET_CHAT_OPEN"; open: boolean };

const initialState: AdminCommandState = {
  currentSection: "dashboard",
  messages: [],
  pendingActions: [],
  overview: null,
  isThinking: false,
  isChatOpen: true,
};

function reducer(state: AdminCommandState, action: Action): AdminCommandState {
  switch (action.type) {
    case "NAVIGATE":
      return { ...state, currentSection: action.section };
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
    default:
      return state;
  }
}

interface AdminCommandContextValue {
  state: AdminCommandState;
  dispatch: React.Dispatch<Action>;
  navigateTo: (section: AdminSection) => void;
}

const AdminCommandCtx = createContext<AdminCommandContextValue | null>(null);

export function AdminCommandProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const navigateTo = useCallback((section: AdminSection) => {
    dispatch({ type: "NAVIGATE", section });
  }, []);

  return (
    <AdminCommandCtx.Provider value={{ state, dispatch, navigateTo }}>
      {children}
    </AdminCommandCtx.Provider>
  );
}

export function useAdminCommand() {
  const ctx = useContext(AdminCommandCtx);
  if (!ctx) throw new Error("useAdminCommand must be used within AdminCommandProvider");
  return ctx;
}

const SCREEN_TO_SECTION: Partial<Record<string, AdminSection>> = {
  dashboard: "dashboard",
  agents: "agents",
  activity: "activity",
  listings: "listings",
  insights: "insights",
  applications: "applications",
  reports: "reports",
  settings: "settings",
};

export function sectionForScreen(screen: string): AdminSection | null {
  return SCREEN_TO_SECTION[screen] ?? null;
}
