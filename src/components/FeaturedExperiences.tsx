import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ExperienceCard } from "./ExperienceCard";
import { getFeaturedExperiences } from "@/lib/data";

export function FeaturedExperiences() {
  const experiences = getFeaturedExperiences();

  if (experiences.length === 0) return null;

  return (
    <section className="py-16 bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="font-heading text-3xl font-bold text-navy">
              Featured Experiences
            </h2>
            <p className="mt-2 text-navy/60">
              Hand-picked tours loved by travelers
            </p>
          </div>
          <Link
            href="/experiences"
            className="hidden sm:flex items-center gap-1 text-orange hover:text-orange-light font-medium transition-colors"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {experiences.slice(0, 8).map((exp) => (
            <ExperienceCard key={exp.id} experience={exp} />
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/experiences"
            className="inline-flex items-center gap-1 text-orange font-medium"
          >
            View all experiences <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
