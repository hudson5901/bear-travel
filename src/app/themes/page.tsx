import type { Metadata } from "next";
import Link from "next/link";
import {
  UtensilsCrossed,
  Landmark,
  Mountain,
  Compass,
  Palette,
  Moon,
} from "lucide-react";
import { getThemes, getExperiencesByTheme } from "@/lib/data";

export const metadata: Metadata = {
  title: "Themes",
  description: "Explore Japan experiences by theme - food, culture, nature, and more.",
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  UtensilsCrossed,
  Landmark,
  Mountain,
  Compass,
  Palette,
  Moon,
};

export default function ThemesPage() {
  const themes = getThemes();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-heading text-3xl font-bold text-navy mb-2">
        Explore by Theme
      </h1>
      <p className="text-navy/60 mb-8">
        Find the perfect experience for your interests
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {themes.map((theme) => {
          const Icon = ICON_MAP[theme.icon] || Compass;
          const count = getExperiencesByTheme(theme.slug).length;
          return (
            <Link
              key={theme.slug}
              href={`/themes/${theme.slug}`}
              className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow"
            >
              <div className="p-3 bg-orange/10 rounded-xl w-fit mb-4 group-hover:bg-orange/20 transition-colors">
                <Icon className="w-8 h-8 text-orange" />
              </div>
              <h2 className="font-heading text-xl font-bold text-navy group-hover:text-orange transition-colors mb-2">
                {theme.name}
              </h2>
              <p className="text-sm text-navy/60 mb-3">{theme.description}</p>
              <span className="text-sm text-orange font-medium">
                {count} experiences &rarr;
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
