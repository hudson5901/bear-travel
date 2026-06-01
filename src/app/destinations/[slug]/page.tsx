import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { ExperienceCard } from "@/components/ExperienceCard";
import {
  getDestinationBySlug,
  getDestinations,
  getExperiencesByCity,
} from "@/lib/data";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  return getDestinations().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dest = getDestinationBySlug(slug);
  if (!dest) return { title: "Not Found" };
  return {
    title: `${dest.name} Experiences`,
    description: dest.description,
  };
}

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const destination = getDestinationBySlug(slug);
  if (!destination) notFound();

  const experiences = getExperiencesByCity(slug);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/destinations"
        className="inline-flex items-center gap-1 text-sm text-navy/60 hover:text-orange mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All destinations
      </Link>

      {/* Header */}
      <div className="relative bg-gradient-to-br from-navy to-navy-light rounded-2xl p-8 md:p-12 mb-8 overflow-hidden">
        {destination.image && (
          <>
            <img
              src={destination.image}
              alt={destination.name}
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-navy/90 to-navy/60" />
          </>
        )}
        <div className="relative">
        <div className="flex items-center gap-2 text-white/60 text-sm mb-2">
          <MapPin className="w-4 h-4" />
          {destination.region}
        </div>
        <h1 className="font-heading text-4xl md:text-5xl font-bold text-white mb-2">
          {destination.name}
        </h1>
        <p className="font-heading text-xl text-white/60">{destination.nameJa}</p>
        <p className="mt-4 text-white/70 max-w-2xl">{destination.description}</p>
        <div className="mt-4 text-orange font-medium">
          {experiences.length} experiences available
        </div>
        </div>
      </div>

      {/* Experiences grid */}
      {experiences.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-navy/60 text-lg">
            No experiences found for {destination.name} yet.
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
