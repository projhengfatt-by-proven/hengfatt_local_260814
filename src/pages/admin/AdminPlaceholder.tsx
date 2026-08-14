import { useLocation } from "react-router-dom";

export default function AdminPlaceholder() {
  const { pathname } = useLocation();
  const section = pathname.split("/").pop() ?? "";

  return (
    <div className="p-8">
      <h1 className="font-heading text-3xl font-bold text-foreground mb-4 capitalize">
        {section || "Admin"}
      </h1>
      <p className="font-body text-muted-foreground">This section is under construction.</p>
    </div>
  );
}
