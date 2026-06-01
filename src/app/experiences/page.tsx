import type { Metadata } from "next";
import { Suspense } from "react";
import { getExperiencesSlim, getDestinations, getThemes } from "@/lib/data";
import { ExperiencesPageClient } from "@/components/ExperiencesPageClient";

export const metadata: Metadata = {
  title: "All Experiences",
  description: "Browse hundreds of tours and experiences across Japan.",
};

export default function ExperiencesPage() {
  const allExperiences = getExperiencesSlim();
  const destinations = getDestinations();
  const themes = getThemes();

  return (
    <Suspense>
      <ExperiencesPageClient
        allExperiences={allExperiences}
        destinations={destinations}
        themes={themes}
      />
    </Suspense>
  );
}
