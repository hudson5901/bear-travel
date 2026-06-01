import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { getDestinations } from "@/lib/data";

export function DestinationGrid() {
  const destinations = getDestinations();

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="font-heading text-3xl font-bold text-navy">
              Popular Destinations
            </h2>
            <p className="mt-2 text-navy/60">
              Explore Japan&apos;s most iconic cities
            </p>
          </div>
          <Link
            href="/destinations"
            className="hidden sm:flex items-center gap-1 text-orange hover:text-orange-light font-medium transition-colors"
          >
            All destinations <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {destinations.map((dest) => (
            <Link
              key={dest.slug}
              href={`/destinations/${dest.slug}`}
              className="group relative overflow-hidden rounded-2xl aspect-[3/2]"
            >
              {/* Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy-light to-navy">
                {dest.image && (
                  <img
                    src={dest.image}
                    alt={dest.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              </div>

              {/* Content */}
              <div className="relative h-full flex flex-col justify-end p-6">
                <div className="flex items-center gap-2 text-white/70 text-sm mb-1">
                  <MapPin className="w-4 h-4" />
                  <span>{dest.region}</span>
                </div>
                <h3 className="font-heading text-2xl font-bold text-white group-hover:text-orange transition-colors">
                  {dest.name}
                </h3>
                <p className="text-sm text-white/80 font-heading">
                  {dest.nameJa}
                </p>
                <p className="mt-2 text-sm text-white/60 line-clamp-2">
                  {dest.description}
                </p>
                <div className="mt-3 text-sm text-orange font-medium">
                  {dest.experienceCount} experiences
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
