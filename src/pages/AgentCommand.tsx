import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CommandProvider } from "@/components/command/CommandContext";
import { TopBar } from "@/components/command/TopBar";
import { AIChatPanel } from "@/components/command/AIChatPanel";
import { DynamicScreen } from "@/components/command/DynamicScreen";
import { ActionBar } from "@/components/command/ActionBar";
import { useCommand } from "@/components/command/CommandContext";
import { MessageCircle, Sparkles } from "lucide-react";
import { QuickAccessPanel } from "@/components/command/QuickAccessPanel";

function CommandLayout() {
  const { state, dispatch } = useCommand();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex-1 flex overflow-hidden relative">
        {/* AI Chat Panel — collapsible sidebar */}
        <div
          className={`${
            state.isChatOpen ? "w-full lg:w-[380px]" : "w-0"
          } shrink-0 relative z-30 h-full transition-all duration-300 overflow-hidden ${
            state.isChatOpen ? "absolute lg:relative" : ""
          }`}
        >
          <AIChatPanel className="w-full lg:w-[380px] min-w-[380px]" />
        </div>

        {/* Collapsed sidebar toggle — visible when chat is closed on desktop */}
        {!state.isChatOpen && (
          <button
            onClick={() => dispatch({ type: "SET_CHAT_OPEN", open: true })}
            className="hidden lg:flex shrink-0 w-10 h-full border-r border-gold/10 bg-[hsl(210,50%,12%)] flex-col items-center justify-center gap-2 hover:bg-[hsl(210,50%,15%)] transition-colors"
          >
            <Sparkles className="w-4 h-4 text-gold/70" />
            <span className="text-gold/60 text-[10px] font-heading tracking-widest writing-vertical">ARIA</span>
          </button>
        )}

        {/* Dynamic Screen */}
        <DynamicScreen />

        {/* Quick Access Panel */}
        <QuickAccessPanel />

        {/* Mobile chat toggle */}
        {!state.isChatOpen && (
          <button
            onClick={() => dispatch({ type: "SET_CHAT_OPEN", open: true })}
            className="lg:hidden fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-gold shadow-gold flex items-center justify-center"
          >
            <MessageCircle className="w-5 h-5 text-navy" />
          </button>
        )}
      </div>
      <ActionBar />
    </div>
  );
}

export default function AgentCommand() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const hasAccess = roles?.some((r) => r.role === "agent" || r.role === "admin");
    if (!hasAccess) {
      navigate("/");
      return;
    }

    setAuthorized(true);
    setChecking(false);
  }

  if (checking) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-navy">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-cream/50 text-sm font-body">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <CommandProvider>
      <CommandLayout />
    </CommandProvider>
  );
}
