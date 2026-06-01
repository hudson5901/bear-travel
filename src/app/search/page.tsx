import type { Metadata } from "next";
import { Suspense } from "react";
import { getExperiences } from "@/lib/data";
import { SearchPageClient } from "@/components/SearchPageClient";

export const metadata: Metadata = {
  title: "Search",
  description: "Search for tours and experiences across Japan.",
};

export default function SearchPage() {
  const allExperiences = getExperiences();

  return (
    <Suspense>
      <SearchPageClient allExperiences={allExperiences} />
    </Suspense>
  );
}
