"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import type { Destination, Theme } from "@/lib/types";

interface FilterSidebarProps {
  destinations: Destination[];
  themes: Theme[];
  currentCity?: string;
  currentTheme?: string;
  currentSort?: string;
}

export function FilterSidebar({
  destinations,
  themes,
  currentCity,
  currentTheme,
  currentSort,
}: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <aside className="w-full lg:w-64 flex-shrink-0">
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <SlidersHorizontal className="w-5 h-5 text-orange" />
          <h3 className="font-heading font-semibold text-navy">Filters</h3>
        </div>

        {/* Destination */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-navy/70 mb-2">
            Destination
          </label>
          <select
            value={currentCity || ""}
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

        {/* Theme */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-navy/70 mb-2">
            Theme
          </label>
          <select
            value={currentTheme || ""}
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

        {/* Sort */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-navy/70 mb-2">
            Sort by
          </label>
          <select
            value={currentSort || ""}
            onChange={(e) => updateFilter("sort", e.target.value)}
            className="w-full px-3 py-2 bg-cream border border-cream-dark rounded-lg text-navy text-sm focus:outline-none focus:ring-2 focus:ring-orange/50"
          >
            <option value="">Best rated</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="popular">Most popular</option>
          </select>
        </div>

        {/* Clear */}
        <button
          onClick={() => router.push("/experiences")}
          className="w-full py-2 text-sm text-orange hover:text-orange-light font-medium transition-colors"
        >
          Clear all filters
        </button>
      </div>
    </aside>
  );
}
