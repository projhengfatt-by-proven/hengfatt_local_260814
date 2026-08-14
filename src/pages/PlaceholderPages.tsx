import { Link } from "react-router-dom";
import TeamPage from "@/pages/TeamPage";

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="text-center">
      <h1 className="font-heading text-4xl font-bold text-foreground mb-3">{title}</h1>
      <p className="font-body text-muted-foreground">Coming soon — this page is under construction.</p>
    </div>
  </div>
);

export const About = () => <PlaceholderPage title="Our Story" />;
export const Team = () => <TeamPage />;
export const Listings = () => <PlaceholderPage title="Property Listings" />;
export const ListingDetail = () => <PlaceholderPage title="Property Details" />;
export const Insights = () => <PlaceholderPage title="Market Insights" />;
export const InsightDetail = () => <PlaceholderPage title="Insight Article" />;
export const Services = () => <PlaceholderPage title="Our Services" />;
export const Contact = () => <PlaceholderPage title="Contact Us" />;
export const MemberPortal = () => <PlaceholderPage title="Member Portal" />;
export const AgentPortal = () => <PlaceholderPage title="Agent Portal" />;
export const Admin = () => <PlaceholderPage title="Admin Dashboard" />;
