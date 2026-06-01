import type { Metadata } from "next";
import { ExperienceCard } from "@/components/ExperienceCard";
import { FilterSidebar } from "@/components/FilterSidebar";
import { filterExperiences, getDestinations, getThemes } from "@/lib/data";

export const metadata: Metadata = {
  title: "All Experiences",
  description: "Browse hundreds of tours and experiences across Japan.",
};

export default async function ExperiencesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const experiences = filterExperiences({
    city: params.city,
    theme: params.theme,
    minRating: params.rating ? parseFloat(params.rating) : undefined,
    sortBy: (params.sort as "price-asc" | "price-desc" | "rating" | "popular") || undefined,
  });
  const destinations = getDestinations();
  const themes = getThemes();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-heading text-3xl font-bold text-navy mb-2">
        All Experiences
      </h1>
      <p className="text-navy/60 mb-8">
        {experiences.length} experiences found
      </p>

      <div className="flex flex-col lg:flex-row gap-8">
        <FilterSidebar
          destinations={destinations}
          themes={themes}
          currentCity={params.city}
          currentTheme={params.theme}
          currentSort={params.sort}
        />

        <div className="flex-1">
          {experiences.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-navy/60 text-lg">No experiences found.</p>
              <p className="text-navy/40 mt-2">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {experiences.map((exp) => (
                <ExperienceCard key={exp.id} experience={exp} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
