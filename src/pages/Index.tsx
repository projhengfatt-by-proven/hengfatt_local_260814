import { HeroSection } from "@/components/home/HeroSection";
import { StatsBar } from "@/components/home/StatsBar";
import { FeaturedListings } from "@/components/home/FeaturedListings";
import { ServicesSection } from "@/components/home/ServicesSection";
import { TeamTeaser } from "@/components/home/TeamTeaser";
import { InsightsPreview } from "@/components/home/InsightsPreview";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { CTABanner } from "@/components/home/CTABanner";

const Index = () => {
  return (
    <div className="-mt-16 md:-mt-20">
      <HeroSection />
      <StatsBar />
      <FeaturedListings />
      <ServicesSection />
      <TeamTeaser />
      <InsightsPreview />
      <TestimonialsSection />
      <CTABanner />
    </div>
  );
};

export default Index;
