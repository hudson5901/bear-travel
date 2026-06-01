import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ExperienceCard } from "@/components/ExperienceCard";
import { getThemeBySlug, getThemes, getExperiencesByTheme } from "@/lib/data";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  return getThemes().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const theme = getThemeBySlug(slug);
  if (!theme) return { title: "Not Found" };
  return {
    title: `${theme.name} Experiences`,
    description: theme.description,
  };
}

export default async function ThemeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const theme = getThemeBySlug(slug);
  if (!theme) notFound();

  const experiences = getExperiencesByTheme(slug);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/themes"
        className="inline-flex items-center gap-1 text-sm text-navy/60 hover:text-orange mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All themes
      </Link>

      {/* Header */}
      <div className="bg-gradient-to-br from-orange to-orange-light rounded-2xl p-8 md:p-12 mb-8">
        <h1 className="font-heading text-4xl md:text-5xl font-bold text-white mb-2">
          {theme.name}
        </h1>
        <p className="text-white/80 max-w-2xl">{theme.description}</p>
        <div className="mt-4 text-white/60 font-medium">
          {experiences.length} experiences available
        </div>
      </div>

      {/* Experiences grid */}
      {experiences.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-navy/60 text-lg">
            No experiences found for {theme.name} yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {experiences.map((exp) => (
            <ExperienceCard key={exp.id} experience={exp} />
          ))}
        </div>
      )}
    </div>
  );
}
