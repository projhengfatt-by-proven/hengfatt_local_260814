import { useCommand, SceneType } from "./CommandContext";
import { Bell, ChevronLeft, LogOut, User, Settings, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const sceneLabels: Record<SceneType, string> = {
  dashboard: "Dashboard",
  leads: "Lead Inbox",
  lead_detail: "Lead Detail",
  listings: "Listings",
  listing_detail: "Listing Detail",
  listing_form: "New Listing",
  calendar: "Schedule",
  viewing_detail: "Viewing Detail",
  crm: "CRM Pipeline",
  commission_calc: "Commission Calculator",
  market: "Market Pulse",
  social: "Social Hub",
  documents: "Documents",
  templates: "Templates",
  notifications: "Notifications",
  files: "My Files",
};

export function TopBar() {
  const { state, dispatch, navigateTo } = useCommand();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header className="h-14 bg-navy border-b border-gold/15 flex items-center px-4 gap-3 shrink-0 z-50">
      {/* Left */}
      <div className="flex items-center gap-2">
        <span className="font-heading text-gold text-base font-bold tracking-wide">
          Heng Fatt
        </span>
        <div className="w-px h-5 bg-gold/20" />
        <span className="font-body text-[11px] uppercase tracking-widest text-cream/50">
          Command Center
        </span>
      </div>

      {/* Center breadcrumb */}
      <div className="flex-1 flex items-center justify-center gap-2">
        {state.sceneHistory.length > 0 && (
          <button
            onClick={() => dispatch({ type: "GO_BACK" })}
            className="text-cream/40 hover:text-cream/80 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <span className="font-body text-sm text-cream/80 transition-all duration-200">
          {sceneLabels[state.currentScene] || state.currentScene}
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* AI Status */}
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              state.isARIAThinking
                ? "bg-gold animate-pulse"
                : state.isListening
                ? "bg-destructive animate-pulse"
                : "bg-green-500 animate-pulse"
            }`}
          />
          <span className="text-[11px] font-body text-cream/60">
            {state.isARIAThinking
              ? "AI Thinking..."
              : state.isListening
              ? "Listening..."
              : "AI Ready"}
          </span>
        </div>

        {/* Notifications */}
        <button
          onClick={() => navigateTo("notifications")}
          className="relative text-cream/60 hover:text-gold transition-colors"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-8 h-8 rounded-full bg-navy-light border border-gold/20 flex items-center justify-center text-gold hover:border-gold/40 transition-colors">
              <User className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigateTo("dashboard")}>
              <User className="w-4 h-4 mr-2" /> My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/")}>
              <ExternalLink className="w-4 h-4 mr-2" /> Back to Site
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
