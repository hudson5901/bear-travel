import { HeroSection } from "@/components/HeroSection";
import { StatsBar } from "@/components/StatsBar";
import { FeaturedExperiences } from "@/components/FeaturedExperiences";
import { DestinationGrid } from "@/components/DestinationGrid";
import { ThemeSection } from "@/components/ThemeSection";

export default function Home() {
  return (
    <>
      <HeroSection />
      <StatsBar />
      <FeaturedExperiences />
      <DestinationGrid />
      <ThemeSection />
    </>
  );
}
