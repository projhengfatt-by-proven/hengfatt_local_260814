import { useCommand } from "./CommandContext";
import { DashboardScene } from "./scenes/DashboardScene";
import { LeadsScene } from "./scenes/LeadsScene";
import { LeadDetailScene } from "./scenes/LeadDetailScene";
import { ListingsScene } from "./scenes/ListingsScene";
import { ListingDetailScene } from "./scenes/ListingDetailScene";
import { ListingFormScene } from "./scenes/ListingFormScene";
import { CommissionScene } from "./scenes/CommissionScene";
import { PlaceholderScene } from "./scenes/PlaceholderScene";
import { FilesScene } from "./scenes/FilesScene";
import { CalendarScene } from "./scenes/CalendarScene";
import { ViewingDetailScene } from "./scenes/ViewingDetailScene";

export function DynamicScreen() {
  const { state } = useCommand();

  const renderScene = () => {
    switch (state.currentScene) {
      case "dashboard":
        return <DashboardScene />;
      case "leads":
        return <LeadsScene />;
      case "lead_detail":
        return <LeadDetailScene />;
      case "listings":
        return <ListingsScene />;
      case "listing_detail":
        return <ListingDetailScene />;
      case "listing_form":
        return <ListingFormScene />;
      case "commission_calc":
        return <CommissionScene />;
      case "files":
        return <FilesScene sceneParams={state.sceneParams} />;
      case "calendar":
        return <CalendarScene />;
      case "viewing_detail":
        return <ViewingDetailScene />;
      default:
        return <PlaceholderScene scene={state.currentScene} />;
    }
  };

  return (
    <div className="flex-1 bg-background overflow-hidden transition-all duration-200">
      {renderScene()}
    </div>
  );
}
