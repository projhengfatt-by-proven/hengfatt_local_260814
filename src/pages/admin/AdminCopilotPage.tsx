import { Link } from "react-router-dom";
import { ChevronRight, Sparkles } from "lucide-react";
import AdminCopilot from "@/components/admin/AdminCopilot";

export default function AdminCopilotPage() {
  return (
    <div className="space-y-6">
      <div className="px-6 sm:px-8 pt-8">
        <div className="flex items-center gap-2 text-sm font-body text-muted-foreground mb-4">
          <Link to="/admin" className="hover:text-foreground transition-colors">
            Admin
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">Copilot</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-gold/10 p-3 text-gold">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">Admin Copilot</h1>
            <p className="font-body text-muted-foreground">
              Ask for summaries, explanations, and controlled admin actions with confirmation.
            </p>
          </div>
        </div>
      </div>

      <AdminCopilot />
    </div>
  );
}
