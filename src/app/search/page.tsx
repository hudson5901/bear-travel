import type { Metadata } from "next";
import { ExperienceCard } from "@/components/ExperienceCard";
import { SearchBar } from "@/components/SearchBar";
import { filterExperiences } from "@/lib/data";

export const metadata: Metadata = {
  title: "Search",
  description: "Search for tours and experiences across Japan.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const query = params.q || "";
  const results = query
    ? filterExperiences({ query })
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-heading text-3xl font-bold text-navy mb-6">
        Search Experiences
      </h1>

      <div className="max-w-2xl mb-8">
        <SearchBar variant="page" />
      </div>

      {query && (
        <p className="text-navy/60 mb-6">
          {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;
          {query}&rdquo;
        </p>
      )}

      {!query && (
        <div className="text-center py-16">
          <p className="text-navy/60 text-lg">
            Enter a search term to find experiences.
          </p>
          <p className="text-navy/40 mt-2">
            Try &ldquo;sushi&rdquo;, &ldquo;temple&rdquo;, or &ldquo;Tokyo&rdquo;
          </p>
        </div>
      )}

      {query && results.length === 0 && (
        <div className="text-center py-16">
          <p className="text-navy/60 text-lg">No results found.</p>
          <p className="text-navy/40 mt-2">Try a different search term.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {results.map((exp) => (
            <ExperienceCard key={exp.id} experience={exp} />
          ))}
        </div>
      )}
    </div>
  );
}
