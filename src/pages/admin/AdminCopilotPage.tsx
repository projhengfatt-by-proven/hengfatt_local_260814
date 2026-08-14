import { Sparkles } from "lucide-react";
import { AdminCommandProvider, useAdminCommand } from "@/components/admin/command/AdminCommandContext";
import { AdminChatPanel } from "@/components/admin/command/AdminChatPanel";
import { AdminDynamicScreen } from "@/components/admin/command/AdminDynamicScreen";

function AdminCopilotLayout() {
  const { state, dispatch } = useAdminCommand();

  return (
    <div className="flex h-full overflow-hidden">
      <div
        className={`${
          state.isChatOpen ? "w-full lg:w-[380px]" : "w-0"
        } shrink-0 h-full transition-all duration-300 overflow-hidden`}
      >
        <AdminChatPanel className="w-full lg:w-[380px] min-w-[380px]" />
      </div>

      {!state.isChatOpen && (
        <button
          onClick={() => dispatch({ type: "SET_CHAT_OPEN", open: true })}
          className="hidden lg:flex shrink-0 w-10 h-full border-r border-border/70 bg-muted/20 flex-col items-center justify-center gap-2 hover:bg-muted/40 transition-colors"
        >
          <Sparkles className="w-4 h-4 text-gold/80" />
          <span className="text-muted-foreground text-[10px] font-heading tracking-widest [writing-mode:vertical-rl]">
            COPILOT
          </span>
        </button>
      )}

      <AdminDynamicScreen />
    </div>
  );
}

export default function AdminCopilotPage() {
  return (
    <AdminCommandProvider>
      <AdminCopilotLayout />
    </AdminCommandProvider>
  );
}
