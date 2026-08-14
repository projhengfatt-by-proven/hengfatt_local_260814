import React, { createContext, useContext, useReducer, useCallback, ReactNode } from "react";

export type SceneType =
  | "dashboard"
  | "leads"
  | "lead_detail"
  | "listings"
  | "listing_detail"
  | "listing_form"
  | "calendar"
  | "viewing_detail"
  | "crm"
  | "commission_calc"
  | "market"
  | "social"
  | "documents"
  | "templates"
  | "notifications"
  | "files";

export interface MessageAction {
  label: string;
  icon?: string;
  id: string;
  payload?: Record<string, string>;
}

export interface MessageAttachment {
  file?: File;
  url?: string;
  name: string;
  type: "image" | "document" | "link";
  previewUrl?: string;
}

// AIChatPanel's conversation state machine — shared here (rather than
// defined in AIChatPanel.tsx) so intent-pack handlers can reference it
// without an import cycle back to AIChatPanel.
export type ConvoState =
  | { mode: "idle" }
  | { mode: "awaiting_file_action"; attachments: MessageAttachment[] }
  | { mode: "awaiting_folder_name"; attachments: MessageAttachment[] }
  | { mode: "awaiting_folder_select"; attachments: MessageAttachment[] }
  | { mode: "property_extracted"; details: Record<string, string> };

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  screenCommand?: any;
  dataAction?: any;
  inputMode?: "text" | "voice_memo" | "voice_chat";
  actions?: MessageAction[];
  attachments?: MessageAttachment[];
  folderPills?: string[];
  createdAt: Date;
}

interface AgentContext {
  listingsCount: number;
  leadsCount: number;
  viewingsTodayCount: number;
  pipelineValue: number;
}

interface CommandState {
  currentScene: SceneType;
  sceneParams: Record<string, any>;
  sceneHistory: { scene: SceneType; params: any }[];
  messages: Message[];
  isARIAThinking: boolean;
  isListening: boolean;
  isVoiceChatActive: boolean;
  inputMode: "type" | "voice_memo" | "voice_chat";
  agentContext: AgentContext;
  isActionBarExpanded: boolean;
  isChatOpen: boolean;
}

type Action =
  | { type: "NAVIGATE"; scene: SceneType; params?: Record<string, any> }
  | { type: "GO_BACK" }
  | { type: "ADD_MESSAGE"; message: Message }
  | { type: "UPDATE_LAST_ASSISTANT"; content: string }
  | { type: "SET_THINKING"; value: boolean }
  | { type: "SET_INPUT_MODE"; mode: "type" | "voice_memo" | "voice_chat" }
  | { type: "SET_AGENT_CONTEXT"; ctx: AgentContext }
  | { type: "TOGGLE_ACTION_BAR" }
  | { type: "SET_ACTION_BAR"; open: boolean }
  | { type: "TOGGLE_CHAT" }
  | { type: "SET_CHAT_OPEN"; open: boolean };

const initialState: CommandState = {
  currentScene: "dashboard",
  sceneParams: {},
  sceneHistory: [],
  messages: [],
  isARIAThinking: false,
  isListening: false,
  isVoiceChatActive: false,
  inputMode: "type",
  agentContext: { listingsCount: 0, leadsCount: 0, viewingsTodayCount: 0, pipelineValue: 0 },
  isActionBarExpanded: false,
  isChatOpen: true,
};

function reducer(state: CommandState, action: Action): CommandState {
  switch (action.type) {
    case "NAVIGATE":
      return {
        ...state,
        sceneHistory: [...state.sceneHistory, { scene: state.currentScene, params: state.sceneParams }],
        currentScene: action.scene,
        sceneParams: action.params || {},
      };
    case "GO_BACK": {
      const prev = state.sceneHistory[state.sceneHistory.length - 1];
      if (!prev) return state;
      return {
        ...state,
        currentScene: prev.scene,
        sceneParams: prev.params,
        sceneHistory: state.sceneHistory.slice(0, -1),
      };
    }
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] };
    case "UPDATE_LAST_ASSISTANT": {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content: action.content };
      } else {
        msgs.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: action.content,
          createdAt: new Date(),
        });
      }
      return { ...state, messages: msgs };
    }
    case "SET_THINKING":
      return { ...state, isARIAThinking: action.value };
    case "SET_INPUT_MODE":
      return { ...state, inputMode: action.mode };
    case "SET_AGENT_CONTEXT":
      return { ...state, agentContext: action.ctx };
    case "TOGGLE_ACTION_BAR":
      return { ...state, isActionBarExpanded: !state.isActionBarExpanded };
    case "SET_ACTION_BAR":
      return { ...state, isActionBarExpanded: action.open };
    case "TOGGLE_CHAT":
      return { ...state, isChatOpen: !state.isChatOpen };
    case "SET_CHAT_OPEN":
      return { ...state, isChatOpen: action.open };
    default:
      return state;
  }
}

interface CommandContextValue {
  state: CommandState;
  dispatch: React.Dispatch<Action>;
  navigateTo: (scene: SceneType, params?: Record<string, any>) => void;
}

const CommandCtx = createContext<CommandContextValue | null>(null);

export function CommandProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const navigateTo = useCallback(
    (scene: SceneType, params?: Record<string, any>) => {
      dispatch({ type: "NAVIGATE", scene, params });
    },
    []
  );

  return (
    <CommandCtx.Provider value={{ state, dispatch, navigateTo }}>
      {children}
    </CommandCtx.Provider>
  );
}

export function useCommand() {
  const ctx = useContext(CommandCtx);
  if (!ctx) throw new Error("useCommand must be used within CommandProvider");
  return ctx;
}
