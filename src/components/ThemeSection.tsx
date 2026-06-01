import Link from "next/link";
import {
  UtensilsCrossed,
  Landmark,
  Mountain,
  Compass,
  Palette,
  Moon,
} from "lucide-react";
import { getThemes } from "@/lib/data";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  UtensilsCrossed,
  Landmark,
  Mountain,
  Compass,
  Palette,
  Moon,
};

export function ThemeSection() {
  const themes = getThemes();

  return (
    <section className="py-16 bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="font-heading text-3xl font-bold text-navy">
            Explore by Theme
          </h2>
          <p className="mt-2 text-navy/60">
            Find the perfect experience for your interests
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {themes.map((theme) => {
            const Icon = ICON_MAP[theme.icon] || Compass;
            return (
              <Link
                key={theme.slug}
                href={`/themes/${theme.slug}`}
                className="group flex flex-col items-center gap-3 p-6 bg-white rounded-2xl hover:shadow-md transition-shadow"
              >
                <div className="p-3 bg-orange/10 rounded-xl group-hover:bg-orange/20 transition-colors">
                  <Icon className="w-6 h-6 text-orange" />
                </div>
                <span className="text-sm font-medium text-navy text-center group-hover:text-orange transition-colors">
                  {theme.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
