import { HeroSection } from "@/components/HeroSection";
import { StatsBar } from "@/components/StatsBar";
import { FeaturedExperiences } from "@/components/FeaturedExperiences";
import { DestinationGrid } from "@/components/DestinationGrid";
import { ThemeSection } from "@/components/ThemeSection";
import { WebsiteJsonLd, OrganizationJsonLd } from "@/components/JsonLd";

export default function Home() {
  return (
    <>
      <WebsiteJsonLd />
      <OrganizationJsonLd />
      <HeroSection />
      <StatsBar />
      <FeaturedExperiences />
      <DestinationGrid />
      <ThemeSection />
    </>
  );
}
