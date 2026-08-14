import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AgentCommand from "./pages/AgentCommand";
import AgentLoginPage from "./pages/AgentLoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AgentApplication from "./pages/AgentApplication";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCopilotPage from "./pages/admin/AdminCopilotPage";
import AgentsListPage from "./pages/admin/AgentsListPage";
import EditAgentPage from "./pages/admin/EditAgentPage";
import ActivityLogPage from "./pages/admin/ActivityLogPage";
import AdminListingsPage from "./pages/admin/AdminListingsPage";
import ApplicationsPage from "./pages/admin/ApplicationsPage";
import MarketInsightsPage from "./pages/admin/MarketInsightsPage";
import AdminInsightDetailPage from "./pages/admin/AdminInsightDetailPage";
import ReportsPage from "./pages/admin/ReportsPage";
import SettingsPage from "./pages/admin/SettingsPage";
import InsightsPage from "./pages/InsightsPage";
import InsightDetailPage from "./pages/InsightDetailPage";
import PropertiesPage from "./pages/PropertiesPage";
import PropertyDetailPage from "./pages/PropertyDetailPage";
import AgentListingsPage from "./pages/portal/AgentListingsPage";
import NewListingPage from "./pages/portal/NewListingPage";
import EditListingPage from "./pages/portal/EditListingPage";
import {
  About,
  Team,
  Services,
  Contact,
  MemberPortal,
  AgentPortal,
} from "./pages/PlaceholderPages";

const queryClient = new QueryClient();

/** Pages that use the standard Navbar + Footer layout */
function StandardPages() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/about" element={<About />} />
        <Route path="/team" element={<Team />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/properties/:slug" element={<PropertyDetailPage />} />
        <Route path="/listings" element={<PropertiesPage />} />
        <Route path="/listings/:id" element={<PropertyDetailPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/insights/:slug" element={<InsightDetailPage />} />
        <Route path="/services" element={<Services />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/apply" element={<AgentApplication />} />
        <Route path="/portal/member" element={<MemberPortal />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Auth pages — no Navbar/Footer */}
          <Route path="/agent-login" element={<AgentLoginPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Full-screen Agent Command Center — no Navbar/Footer */}
          <Route path="/portal/agent" element={<AgentCommand />} />

          {/* Agent listing pages — standalone layout */}
          <Route path="/portal/agent/listings" element={<AgentListingsPage />} />
          <Route path="/portal/agent/listings/new" element={<NewListingPage />} />
          <Route path="/portal/agent/listings/:id/edit" element={<EditListingPage />} />

          {/* Admin panel with sidebar layout — protected */}
          <Route path="/admin" element={<AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="copilot" element={<AdminCopilotPage />} />
            <Route path="agents" element={<AgentsListPage />} />
            <Route path="agents/:id/edit" element={<EditAgentPage />} />
            <Route path="activity" element={<ActivityLogPage />} />
            <Route path="listings" element={<AdminListingsPage />} />
            <Route path="listings/new" element={<NewListingPage />} />
            <Route path="properties" element={<AdminListingsPage />} />
            <Route path="insights" element={<MarketInsightsPage />} />
            <Route path="insights/:id" element={<AdminInsightDetailPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Everything else uses the standard layout */}
          <Route path="/*" element={<StandardPages />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
