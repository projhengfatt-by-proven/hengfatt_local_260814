import { useState } from "react";
import { useCommand } from "./CommandContext";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function QuickAccessPanel() {
  const [open, setOpen] = useState(false);
  const { navigateTo } = useCommand();

  const pages = [
    { label: "Dashboard", scene: "dashboard" as const },
    { label: "My Listings", scene: "listings" as const },
    { label: "My Files", scene: "files" as const },
    { label: "My Leads", scene: "leads" as const },
    { label: "Schedule", scene: "calendar" as const },
    { label: "My Profile", scene: "crm" as const },
  ];

  const quickActions = [
    { label: "Add Listing", scene: "listing_form" as const },
    { label: "Log a Lead", scene: "leads" as const, params: { action: "add" } },
    { label: "Book Viewing", scene: "calendar" as const, params: { action: "book" } },
    { label: "Send Proposal", scene: "documents" as const, params: { action: "proposal" } },
  ];

  const reports = [
    { label: "Commission", scene: "commission_calc" as const },
    { label: "Performance", scene: "market" as const },
  ];

  const handleNav = (scene: any, params?: any) => {
    navigateTo(scene, params);
    setOpen(false);
  };

  return (
    <>
      {/* Collapsed tab — inline in flex layout */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 w-8 h-full bg-navy border-l border-gold/10 flex flex-col items-center justify-center gap-1 hover:bg-navy-light transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-gold/60" />
          <span
            className="text-[11px] font-body text-gold/60 tracking-widest writing-vertical"
          >
            Quick Access
          </span>
        </button>
      )}

      {/* Expanded panel — fixed overlay so it doesn't push content */}
      {open && (
        <div
          className="fixed right-0 top-[60px] bottom-0 z-40 bg-navy border-l border-gold/10 flex flex-col overflow-y-auto w-[220px] animate-in slide-in-from-right duration-200"
        >
          {/* Header */}
          <button
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 px-3 py-3 border-b border-gold/10 text-gold hover:text-gold-light transition-colors shrink-0"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[13px] font-body font-semibold tracking-wide">Quick Access</span>
          </button>

          <div className="flex-1 px-3 py-3 space-y-5 overflow-y-auto">
            {/* Pages */}
            <div>
              <p className="text-[11px] font-body text-gold uppercase tracking-wider mb-2 font-semibold">Pages</p>
              <div className="space-y-1.5">
                {pages.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handleNav(p.scene)}
                    className="w-full text-left text-[13px] font-body text-cream/80 border border-navy-light rounded-lg px-3 py-2 hover:bg-navy-light hover:text-cream transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <p className="text-[11px] font-body text-gold uppercase tracking-wider mb-2 font-semibold">Quick Actions</p>
              <div className="space-y-1.5">
                {quickActions.map((a) => (
                  <button
                    key={a.label}
                    onClick={() => handleNav(a.scene, a.params)}
                    className="w-full text-left text-[13px] font-body text-navy font-semibold bg-gold hover:bg-gold-light rounded-lg px-3 py-2 transition-colors"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reports */}
            <div>
              <p className="text-[11px] font-body text-gold uppercase tracking-wider mb-2 font-semibold">Reports</p>
              <div className="space-y-1.5">
                {reports.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => handleNav(r.scene)}
                    className="w-full text-left text-[13px] font-body text-cream/80 border border-navy-light rounded-lg px-3 py-2 hover:bg-navy-light hover:text-cream transition-colors"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={() => setOpen(false)}
            className="shrink-0 mx-3 mb-3 flex items-center justify-center gap-1.5 text-[12px] font-body text-cream/40 hover:text-cream/70 border border-gold/10 rounded-lg py-2 transition-colors"
          >
            Close Panel <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </>
  );
}
