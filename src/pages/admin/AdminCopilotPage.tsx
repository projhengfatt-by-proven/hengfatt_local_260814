import { ChevronRight, Sparkles } from "lucide-react";
import { useAdminCommand } from "@/components/admin/command/AdminCommandContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const EXAMPLE_PROMPTS = [
  "Put Marina Residence live.",
  "Feature Marina Residence.",
  "Deactivate agent A102.",
  "Show me all inactive agents.",
  "Show three-bedroom properties below $3M.",
  "Publish all approved properties that are ready.",
  "Which properties should we feature this weekend?",
  "Which applications need attention first?",
  "Explain the latest activity log entry in plain English.",
];

/**
 * The Copilot chat itself now lives in AdminLayout, persistent across
 * every admin page — this is just a landing view explaining what it can
 * do, with example prompts that pre-fill the always-present chat panel
 * (via shared context) rather than a chat UI of its own.
 */
export default function AdminCopilotPage() {
  const { dispatch } = useAdminCommand();

  return (
    <div className="p-6 sm:p-8 max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Badge className="bg-gold/10 text-gold border-gold/30 font-body">
            <Sparkles className="mr-1 h-3 w-3" />
            Admin Copilot
          </Badge>
        </div>
        <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">Ask the Copilot anything</h1>
        <p className="mt-2 font-body text-muted-foreground">
          The chat panel on the left is available on every admin page — you don't need to be here to use it. This
          page is just a reference for what it can do. Actions that change data always pause for your confirmation
          first.
        </p>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Try one of these</CardTitle>
          <CardDescription className="font-body">Click a prompt to load it into the chat input.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => dispatch({ type: "SET_DRAFT_INPUT", value: prompt })}
              className="flex w-full items-center justify-between rounded-xl border border-border/70 px-4 py-3 text-left font-body text-sm text-foreground transition-colors hover:border-gold/40 hover:bg-gold/5"
            >
              <span>{prompt}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
