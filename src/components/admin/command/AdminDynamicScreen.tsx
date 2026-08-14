import { useAdminCommand } from "./AdminCommandContext";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AgentsListPage from "@/pages/admin/AgentsListPage";
import ActivityLogPage from "@/pages/admin/ActivityLogPage";
import AdminListingsPage from "@/pages/admin/AdminListingsPage";
import MarketInsightsPage from "@/pages/admin/MarketInsightsPage";
import ApplicationsPage from "@/pages/admin/ApplicationsPage";
import ReportsPage from "@/pages/admin/ReportsPage";
import SettingsPage from "@/pages/admin/SettingsPage";

export function AdminDynamicScreen() {
  const { state } = useAdminCommand();

  const renderSection = () => {
    switch (state.currentSection) {
      case "agents":
        return <AgentsListPage />;
      case "activity":
        return <ActivityLogPage />;
      case "listings":
        return <AdminListingsPage />;
      case "insights":
        return <MarketInsightsPage />;
      case "applications":
        return <ApplicationsPage />;
      case "reports":
        return <ReportsPage />;
      case "settings":
        return <SettingsPage />;
      case "dashboard":
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      {renderSection()}
    </div>
  );
}
