import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Building2, Mail, Sparkles, ArrowRight } from "lucide-react";

const settingsSections = [
  {
    title: "Public visibility rules",
    icon: Building2,
    items: [
      "Published agents can appear on the public Team page.",
      "Featured agents are the internal agents eligible for homepage spotlight placement.",
      "Active listings are visible on the public site; draft listings stay hidden.",
      "Featured listings are the promoted public listings the team wants to highlight.",
    ],
  },
  {
    title: "Agent onboarding and email",
    icon: Mail,
    items: [
      "Admin invite and password recovery emails are sent through Supabase Auth SMTP.",
      "The sender name should match Heng Fatt Property so the inbox feels consistent.",
      "If an email lands in spam, resend from the Agents page and verify the SMTP provider settings.",
      "Redirect URLs must be allowed in Supabase Auth for invite and recovery flows.",
    ],
  },
  {
    title: "Admin control surface",
    icon: Shield,
    items: [
      "Admin routes are protected by the user_roles admin check.",
      "The Admin Copilot can propose changes, but write actions still need confirmation.",
      "Activity log entries are the audit trail for content and visibility changes.",
      "RLS remains the source of truth for who can read or write data.",
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="p-6 sm:p-8 max-w-7xl space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-gold" />
        <Badge className="bg-gold/10 text-gold border-gold/30 font-body">Reference settings</Badge>
      </div>

      <div className="max-w-3xl space-y-2">
        <h1 className="font-heading text-3xl font-bold text-foreground">Settings</h1>
        <p className="font-body text-muted-foreground">
          This page documents the current operating rules for the admin portal, public visibility, and onboarding flows.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {settingsSections.map((section) => (
          <Card key={section.title} className="border-border/70">
            <CardHeader>
              <div className="flex items-center gap-3">
                <section.icon className="h-5 w-5 text-gold" />
                <CardTitle className="font-heading text-xl">{section.title}</CardTitle>
              </div>
              <CardDescription className="font-body">
                Current operating notes and source-of-truth reminders.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.items.map((item) => (
                <div key={item} className="rounded-xl border border-border/70 p-3">
                  <p className="font-body text-sm text-foreground">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Where to change things</CardTitle>
            <CardDescription className="font-body">
              The settings page is the map. These pages are where the actual controls live.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SettingLink title="Manage agents" href="/admin/agents" text="Toggle visibility, resend invites, and edit agent records." />
            <SettingLink title="Manage listings" href="/admin/listings" text="Publish, draft, and feature public listings." />
            <SettingLink title="Review applications" href="/admin/applications" text="Move applicants through review, interview, approval, or decline." />
            <SettingLink title="Open copilot" href="/admin/copilot" text="Ask for summaries or propose a controlled action." />
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Current gaps to watch</CardTitle>
            <CardDescription className="font-body">
              This is the short list of things to improve next.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <GapItem title="Persisted admin preferences" text="We do not yet have a dedicated settings table for portal preferences." />
            <GapItem title="Analytic charts" text="Reports are currently operational summaries rather than chart-heavy analytics." />
            <GapItem title="Copilot expansion" text="The admin assistant starts read-first with confirmation for writes." />
            <GapItem title="Public content governance" text="Keep refining which data belongs on the homepage versus the Team page." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SettingLink({ title, href, text }: { title: string; href: string; text: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
      <div>
        <p className="font-body font-semibold text-foreground">{title}</p>
        <p className="font-body text-sm text-muted-foreground">{text}</p>
      </div>
      <Button variant="outline" asChild>
        <Link to={href} className="gap-2">
          Open <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function GapItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-gold" />
        <p className="font-body font-semibold text-foreground">{title}</p>
      </div>
      <p className="mt-1 font-body text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
