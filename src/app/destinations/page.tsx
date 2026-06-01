import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { getDestinations } from "@/lib/data";

export const metadata: Metadata = {
  title: "Destinations",
  description: "Explore Japan's most iconic cities and regions.",
};

export default function DestinationsPage() {
  const destinations = getDestinations();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-heading text-3xl font-bold text-navy mb-2">
        Destinations
      </h1>
      <p className="text-navy/60 mb-8">
        Explore Japan&apos;s most iconic cities
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {destinations.map((dest) => (
          <Link
            key={dest.slug}
            href={`/destinations/${dest.slug}`}
            className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
          >
            <div className="aspect-video bg-gradient-to-br from-navy via-navy-light to-navy relative overflow-hidden">
              {dest.image && (
                <Image
                  src={dest.image}
                  alt={dest.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <h2 className="font-heading text-2xl font-bold text-white group-hover:text-orange transition-colors">
                  {dest.name}
                </h2>
                <p className="text-white/70 text-sm">{dest.nameJa}</p>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-1 text-sm text-navy/50 mb-2">
                <MapPin className="w-3.5 h-3.5" />
                {dest.region}
              </div>
              <p className="text-sm text-navy/70 line-clamp-2">
                {dest.description}
              </p>
              <div className="mt-3 text-sm text-orange font-medium">
                {dest.experienceCount} experiences &rarr;
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
