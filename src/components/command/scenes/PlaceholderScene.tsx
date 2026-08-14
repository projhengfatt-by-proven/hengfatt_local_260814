import { SceneType } from "../CommandContext";
import { Construction } from "lucide-react";

const labels: Partial<Record<SceneType, string>> = {
  lead_detail: "Lead Detail",
  listing_detail: "Listing Detail",
  listing_form: "New Listing",
  calendar: "Schedule",
  crm: "CRM Pipeline",
  market: "Market Pulse",
  social: "Social Hub",
  documents: "Documents",
  templates: "Templates",
  notifications: "Notifications",
};

export function PlaceholderScene({ scene }: { scene: SceneType }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <Construction className="w-12 h-12 text-gold/40 mb-4" />
      <h2 className="font-heading text-2xl text-navy font-bold mb-2">
        {labels[scene] || scene}
      </h2>
      <p className="text-sm text-muted-foreground font-body max-w-md">
        This module is coming soon. Ask ARIA for help or use the quick actions below.
      </p>
    </div>
  );
}
