import { MapPin, Star, Globe, Users } from "lucide-react";
import { getSiteStats } from "@/lib/data";

export function StatsBar() {
  const stats = getSiteStats();

  const items = [
    { icon: Globe, value: `${stats.experienceCount}+`, label: "Experiences" },
    { icon: MapPin, value: String(stats.destinationCount), label: "Destinations" },
    { icon: Star, value: stats.avgRating, label: "Avg Rating" },
    { icon: Users, value: String(stats.platformCount), label: "Platforms" },
  ];

  return (
    <section className="bg-white py-8 border-y border-cream-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {items.map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 justify-center">
              <div className="p-2 bg-orange/10 rounded-lg">
                <stat.icon className="w-5 h-5 text-orange" />
              </div>
              <div>
                <div className="font-heading font-bold text-xl text-navy">
                  {stat.value}
                </div>
                <div className="text-sm text-navy/60">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
