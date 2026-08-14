import { useCommand, SceneType } from "./CommandContext";
import {
  BarChart3,
  Users,
  Home,
  Calendar,
  DollarSign,
  TrendingUp,
  Share2,
  FileText,
  MessageSquare,
  Bell,
  Settings,
} from "lucide-react";
import { useEffect } from "react";

interface ActionItem {
  icon: any;
  label: string;
  scene: SceneType;
  params?: Record<string, any>;
  shortcut?: string;
}

const actions: ActionItem[] = [
  { icon: BarChart3, label: "Dashboard", scene: "dashboard", shortcut: "D" },
  { icon: Users, label: "CRM", scene: "crm", params: { view: "pipeline" }, shortcut: "L" },
  { icon: Home, label: "Listings", scene: "listings", shortcut: "M" },
  { icon: Calendar, label: "Schedule", scene: "calendar", shortcut: "C" },
  { icon: DollarSign, label: "Commission", scene: "commission_calc", shortcut: "$" },
  { icon: TrendingUp, label: "Market", scene: "market" },
  { icon: Share2, label: "Social", scene: "social" },
  { icon: FileText, label: "Documents", scene: "documents" },
  { icon: MessageSquare, label: "Templates", scene: "templates" },
  { icon: Bell, label: "Alerts", scene: "notifications" },
];

export function ActionBar() {
  const { state, dispatch, navigateTo } = useCommand();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.shiftKey && e.key === "A") {
        dispatch({ type: "TOGGLE_ACTION_BAR" });
        return;
      }

      const map: Record<string, SceneType> = { d: "dashboard", l: "crm", m: "listings", c: "calendar", $: "commission_calc" };
      const scene = map[e.key.toLowerCase()];
      if (scene) navigateTo(scene);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [dispatch, navigateTo]);

  return (
    <div className="shrink-0 bg-navy border-t border-gold/15 z-40">
      {/* Collapsed handle */}
      {!state.isActionBarExpanded && (
        <button
          onClick={() => dispatch({ type: "TOGGLE_ACTION_BAR" })}
          className="w-full h-10 flex items-center justify-center group"
        >
          <div className="w-10 h-[3px] rounded-full bg-gold/20 group-hover:bg-gold/50 transition-colors" />
          <span className="absolute left-4 text-[10px] text-cream/15 font-body">Quick Access</span>
        </button>
      )}

      {/* Expanded */}
      {state.isActionBarExpanded && (
        <div className="h-20 flex items-center justify-center gap-1 px-4 overflow-x-auto">
          {actions.map((a) => {
            const isActive = state.currentScene === a.scene;
            return (
              <button
                key={a.label}
                onClick={() => {
                  navigateTo(a.scene, a.params);
                  dispatch({ type: "SET_ACTION_BAR", open: false });
                }}
                title={a.shortcut ? `${a.label} (${a.shortcut})` : a.label}
                className={`flex flex-col items-center justify-center w-16 h-16 rounded-lg transition-colors ${
                  isActive
                    ? "text-gold"
                    : "text-cream/50 hover:text-cream/80 hover:bg-navy-light/50"
                }`}
              >
                <a.icon className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-body">{a.label}</span>
                {isActive && <div className="w-4 h-0.5 bg-gold rounded-full mt-0.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
