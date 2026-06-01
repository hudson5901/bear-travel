import Link from "next/link";
import Image from "next/image";
import { Star, Clock, MapPin } from "lucide-react";
import type { Experience } from "@/lib/types";

export function ExperienceCard({ experience }: { experience: Experience }) {
  const { slug, title, shortDescription, price, duration, rating, location, thumbnail } =
    experience;

  return (
    <Link href={`/experiences/${slug}`} className="group block">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-cream-dark overflow-hidden">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange/20 to-navy/10">
              <MapPin className="w-12 h-12 text-orange/40" />
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-1.5">
            {experience.isPopular && (
              <span className="px-2 py-1 text-xs font-semibold bg-orange text-white rounded-lg">
                Popular
              </span>
            )}
          </div>
          <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-medium bg-black/50 text-white rounded capitalize backdrop-blur-sm">
            {experience.source.platform === "getyourguide" ? "GetYourGuide" : experience.source.platform}
          </span>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-center gap-1 text-sm text-navy/50 mb-1">
            <MapPin className="w-3.5 h-3.5" />
            <span>{location.city}</span>
          </div>

          <h3 className="font-heading font-semibold text-navy group-hover:text-orange transition-colors line-clamp-2">
            {title}
          </h3>

          <p className="mt-1 text-sm text-navy/60 line-clamp-2">
            {shortDescription}
          </p>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm text-navy/60">
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                {rating.score.toFixed(1)}
                <span className="text-navy/40">({rating.count})</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {duration.display}
              </span>
            </div>

            <div className="font-heading font-bold text-navy">
              {price.display}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
