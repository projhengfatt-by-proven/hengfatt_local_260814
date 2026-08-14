import { Link } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import AddNewAgentForm from "@/components/admin/AddNewAgentForm";

export default function AddNewAgentPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm font-body text-muted-foreground mb-6">
        <Link to="/admin" className="hover:text-foreground transition-colors">
          Admin
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link to="/admin/agents" className="hover:text-foreground transition-colors">
          Agents
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground font-medium">Add New</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          to="/admin/agents"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
          Add New Agent
        </h1>
      </div>

      <AddNewAgentForm />
    </div>
  );
}
