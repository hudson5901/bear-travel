import type { Metadata } from "next";
import Link from "next/link";
import {
  Star,
  Clock,
  MapPin,
  ExternalLink,
  ArrowLeft,
  Check,
} from "lucide-react";
import { getExperienceBySlug, getExperiences } from "@/lib/data";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  return getExperiences().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const exp = getExperienceBySlug(slug);
  if (!exp) return { title: "Not Found" };
  return {
    title: exp.title,
    description: exp.shortDescription,
  };
}

export default async function ExperienceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const experience = getExperienceBySlug(slug);
  if (!experience) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <Link
        href="/experiences"
        className="inline-flex items-center gap-1 text-sm text-navy/60 hover:text-orange mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to experiences
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2">
          {/* Image */}
          <div className="aspect-video bg-cream-dark rounded-2xl overflow-hidden mb-6">
            {experience.thumbnail ? (
              <img
                src={experience.thumbnail}
                alt={experience.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange/20 to-navy/10">
                <MapPin className="w-16 h-16 text-orange/30" />
              </div>
            )}
          </div>

          {/* Title & info */}
          <div className="flex items-center gap-2 text-sm text-navy/50 mb-2">
            <MapPin className="w-4 h-4" />
            <Link
              href={`/destinations/${experience.location.citySlug}`}
              className="hover:text-orange transition-colors"
            >
              {experience.location.city}
            </Link>
            <span>&middot;</span>
            <span>{experience.location.region}</span>
          </div>

          <h1 className="font-heading text-3xl font-bold text-navy mb-4">
            {experience.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 mb-6 text-sm">
            <span className="flex items-center gap-1 text-navy/70">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              {experience.rating.score.toFixed(1)}
              <span className="text-navy/40">
                ({experience.rating.count} reviews)
              </span>
            </span>
            <span className="flex items-center gap-1 text-navy/70">
              <Clock className="w-4 h-4" />
              {experience.duration.display}
            </span>
            {experience.source.platform && (
              <span className="px-2 py-0.5 bg-cream rounded text-xs text-navy/50 capitalize">
                via {experience.source.platform}
              </span>
            )}
          </div>

          {/* Description */}
          <div className="prose prose-sm max-w-none mb-8">
            <h2 className="font-heading text-xl font-semibold text-navy">
              About this experience
            </h2>
            <p className="text-navy/70 leading-relaxed whitespace-pre-line">
              {experience.description}
            </p>
          </div>

          {/* Highlights */}
          {experience.highlights.length > 0 && (
            <div className="mb-8">
              <h2 className="font-heading text-xl font-semibold text-navy mb-4">
                Highlights
              </h2>
              <ul className="space-y-2">
                {experience.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-navy/70">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Themes */}
          {experience.themes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {experience.themes.map((theme) => (
                <Link
                  key={theme}
                  href={`/themes/${theme}`}
                  className="px-3 py-1 bg-cream text-sm text-navy/60 rounded-full hover:bg-orange/10 hover:text-orange transition-colors"
                >
                  {theme.replace("-", " & ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </Link>
              ))}
            </div>
          )}

          {/* Map */}
          <div className="mb-8">
            <h2 className="font-heading text-xl font-semibold text-navy mb-4">
              Location
            </h2>
            <div className="rounded-2xl overflow-hidden border border-cream-dark">
              <iframe
                title={`Map of ${experience.location.city}`}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${(() => {
                  const coords: Record<string, string> = {
                    tokyo: "139.6,35.6,139.85,35.75",
                    kyoto: "135.7,34.95,135.82,35.05",
                    osaka: "135.45,34.6,135.55,34.72",
                    hiroshima: "132.4,34.35,132.5,34.45",
                    nara: "135.78,34.67,135.87,34.72",
                    hakone: "139.0,35.2,139.1,35.28",
                    nagano: "138.15,36.22,138.22,36.28",
                    hokkaido: "141.3,43.02,141.4,43.1",
                    okinawa: "127.65,26.3,127.72,26.37",
                    fukuoka: "130.35,33.55,130.45,33.62",
                    kamakura: "139.53,35.3,139.58,35.34",
                    nikko: "139.6,36.74,139.67,36.78",
                    kanazawa: "136.64,36.55,136.68,36.59",
                    yokohama: "139.6,35.43,139.7,35.48",
                    kobe: "135.17,34.67,135.22,34.72",
                    niigata: "139.02,37.9,139.07,37.95",
                  };
                  return coords[experience.location.citySlug] || "139.6,35.6,139.85,35.75";
                })()}&layer=mapnik`}
                width="100%"
                height="300"
                style={{ border: 0 }}
                loading="lazy"
              />
            </div>
          </div>
        </div>

        {/* Sidebar - Booking card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
            <div className="text-center mb-4">
              <div className="text-sm text-navy/50">From</div>
              <div className="font-heading text-3xl font-bold text-navy">
                {experience.price.display}
              </div>
              <div className="text-sm text-navy/40">per person</div>
            </div>

            <a
              href={experience.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-orange hover:bg-orange-light text-white font-semibold rounded-xl transition-colors mb-3"
            >
              Book Now
              <ExternalLink className="w-4 h-4" />
            </a>

            <p className="text-xs text-center text-navy/40">
              You&apos;ll be redirected to {experience.source.platform} to complete
              your booking.
            </p>

            <div className="mt-6 pt-4 border-t border-cream-dark space-y-3 text-sm text-navy/60">
              <div className="flex justify-between">
                <span>Duration</span>
                <span className="font-medium text-navy">
                  {experience.duration.display}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Rating</span>
                <span className="font-medium text-navy">
                  {experience.rating.score.toFixed(1)} / 5.0
                </span>
              </div>
              <div className="flex justify-between">
                <span>Location</span>
                <span className="font-medium text-navy">
                  {experience.location.city}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
