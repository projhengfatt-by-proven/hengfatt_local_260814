import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  X,
  Menu,
  ClipboardList,
  Sparkles,
  TrendingUp,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AdminCommandProvider, useAdminCommand } from "@/components/admin/command/AdminCommandContext";
import { AdminChatPanel } from "@/components/admin/command/AdminChatPanel";

const STORAGE_KEY = "admin-sidebar-collapsed";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { label: "Copilot", icon: Sparkles, path: "/admin/copilot" },
  { label: "Agents", icon: Users, path: "/admin/agents" },
  { label: "Activity Log", icon: ClipboardList, path: "/admin/activity" },
  { label: "Listings", icon: Building2, path: "/admin/listings" },
  { label: "Insights", icon: TrendingUp, path: "/admin/insights" },
  { label: "Applications", icon: FileText, path: "/admin/applications" },
  { label: "Reports", icon: BarChart3, path: "/admin/reports" },
  { label: "Settings", icon: Settings, path: "/admin/settings" },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setAdminEmail(data.user.email ?? "");
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {}
  }, [collapsed]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast({ title: "Signed out" });
    navigate("/agent-login");
  }

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  const initials = adminEmail
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  /* ---- Sidebar content (shared between desktop & mobile) ---- */
  function SidebarContent({ isMobile = false }: { isMobile?: boolean }) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-sidebar-border">
          {(!collapsed || isMobile) && (
            <span className="font-heading text-lg font-bold text-sidebar-foreground truncate">
              Admin
            </span>
          )}
          {isMobile ? (
            <button onClick={() => setMobileOpen(false)} className="text-sidebar-foreground p-1">
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="text-sidebar-foreground/70 hover:text-sidebar-foreground p-1 transition-colors"
            >
              {collapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body transition-all duration-200 group relative",
                  active
                    ? "bg-sidebar-accent text-gold font-semibold"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                {/* Gold left border for active */}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-gold" />
                )}
                <item.icon className={cn("w-5 h-5 shrink-0", active && "text-gold")} />
                {(!collapsed || isMobile) && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: avatar + sign out */}
        <div className="border-t border-sidebar-border px-3 py-4">
          <div className={cn("flex items-center gap-3", collapsed && !isMobile && "justify-center")}>
            <Avatar className="w-9 h-9 shrink-0 bg-sidebar-accent text-sidebar-foreground">
              <AvatarFallback className="bg-sidebar-accent text-gold text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {(!collapsed || isMobile) && (
              <div className="flex-1 min-w-0">
                <p className="text-xs text-sidebar-foreground/50 truncate">{adminEmail}</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className={cn(
              "mt-3 w-full text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 font-body text-sm",
              collapsed && !isMobile && "px-0 justify-center"
            )}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {(!collapsed || isMobile) && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-primary shrink-0 transition-all duration-300 ease-in-out",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 bg-primary text-primary-foreground p-2 rounded-lg shadow-elevated"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-72 bg-primary z-50 lg:hidden overflow-y-auto">
            <SidebarContent isMobile />
          </aside>
        </>
      )}

      {/* Main content: persistent Copilot chat (collapsible) + dynamic canvas (whatever route is active) */}
      <AdminCommandProvider>
        <AdminMainArea />
      </AdminCommandProvider>
    </div>
  );
}

function AdminMainArea() {
  const { state, dispatch } = useAdminCommand();

  return (
    <div className="flex-1 flex overflow-hidden relative">
      <div
        className={cn(
          "shrink-0 relative z-30 h-full transition-all duration-300 overflow-hidden",
          state.isChatOpen ? "w-full lg:w-[380px] absolute lg:relative" : "w-0"
        )}
      >
        <AdminChatPanel className="w-full lg:w-[380px] min-w-[380px]" />
      </div>

      {/* Collapsed chat toggle — visible when chat is closed on desktop */}
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

      {/* Dynamic canvas — whatever admin route is active */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Mobile chat toggle — chat overlays the canvas on small screens */}
      {!state.isChatOpen && (
        <button
          onClick={() => dispatch({ type: "SET_CHAT_OPEN", open: true })}
          className="lg:hidden fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-gold shadow-gold flex items-center justify-center"
        >
          <MessageCircle className="w-5 h-5 text-navy" />
        </button>
      )}
    </div>
  );
}
