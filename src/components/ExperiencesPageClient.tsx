"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { ExperienceCard } from "@/components/ExperienceCard";
import type { Experience, Destination, Theme } from "@/lib/types";

interface Props {
  allExperiences: Experience[];
  destinations: Destination[];
  themes: Theme[];
}

export function ExperiencesPageClient({ allExperiences, destinations, themes }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const city = searchParams.get("city") || "";
  const theme = searchParams.get("theme") || "";
  const sort = searchParams.get("sort") || "";

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  const filtered = useMemo(() => {
    let results = allExperiences;

    if (city) {
      results = results.filter((e) => e.location.citySlug === city);
    }

    if (theme) {
      results = results.filter((e) => e.themes.includes(theme));
    }

    switch (sort) {
      case "price-asc":
        results = [...results].sort((a, b) => a.price.amount - b.price.amount);
        break;
      case "price-desc":
        results = [...results].sort((a, b) => b.price.amount - a.price.amount);
        break;
      case "popular":
        results = [...results].sort((a, b) => b.rating.count - a.rating.count);
        break;
      default:
        results = [...results].sort((a, b) => b.rating.score - a.rating.score);
        break;
    }

    return results;
  }, [allExperiences, city, theme, sort]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-heading text-3xl font-bold text-navy mb-2">
        All Experiences
      </h1>
      <p className="text-navy/60 mb-8">
        {filtered.length} experiences found
      </p>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filter Sidebar */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <SlidersHorizontal className="w-5 h-5 text-orange" />
              <h3 className="font-heading font-semibold text-navy">Filters</h3>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-navy/70 mb-2">
                Destination
              </label>
              <select
                value={city}
                onChange={(e) => updateFilter("city", e.target.value)}
                className="w-full px-3 py-2 bg-cream border border-cream-dark rounded-lg text-navy text-sm focus:outline-none focus:ring-2 focus:ring-orange/50"
              >
                <option value="">All destinations</option>
                {destinations.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-navy/70 mb-2">
                Theme
              </label>
              <select
                value={theme}
                onChange={(e) => updateFilter("theme", e.target.value)}
                className="w-full px-3 py-2 bg-cream border border-cream-dark rounded-lg text-navy text-sm focus:outline-none focus:ring-2 focus:ring-orange/50"
              >
                <option value="">All themes</option>
                {themes.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-navy/70 mb-2">
                Sort by
              </label>
              <select
                value={sort}
                onChange={(e) => updateFilter("sort", e.target.value)}
                className="w-full px-3 py-2 bg-cream border border-cream-dark rounded-lg text-navy text-sm focus:outline-none focus:ring-2 focus:ring-orange/50"
              >
                <option value="">Best rated</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="popular">Most popular</option>
              </select>
            </div>

            <button
              onClick={() => router.push("/experiences")}
              className="w-full py-2 text-sm text-orange hover:text-orange-light font-medium transition-colors"
            >
              Clear all filters
            </button>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-navy/60 text-lg">No experiences found.</p>
              <p className="text-navy/40 mt-2">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((exp) => (
                <ExperienceCard key={exp.id} experience={exp} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
