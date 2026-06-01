import Link from "next/link";
import { BearLogo } from "./BearMascot";

export function Footer() {
  return (
    <footer className="bg-navy text-white/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <BearLogo className="w-8 h-8" />
              <span className="font-heading font-bold text-lg text-white">
                Bear<span className="text-orange">Tour</span>
              </span>
            </Link>
            <p className="text-sm text-white/60">
              Your friendly guide to the best experiences across Japan.
            </p>
          </div>

          {/* Destinations */}
          <div>
            <h4 className="font-heading font-semibold text-white mb-3">
              Destinations
            </h4>
            <ul className="space-y-2 text-sm">
              {["Tokyo", "Kyoto", "Osaka", "Hiroshima", "Nara", "Hakone"].map(
                (city) => (
                  <li key={city}>
                    <Link
                      href={`/destinations/${city.toLowerCase()}`}
                      className="hover:text-orange transition-colors"
                    >
                      {city}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Themes */}
          <div>
            <h4 className="font-heading font-semibold text-white mb-3">
              Themes
            </h4>
            <ul className="space-y-2 text-sm">
              {[
                { label: "Food & Drink", slug: "food-drink" },
                { label: "Culture & History", slug: "culture-history" },
                { label: "Nature & Outdoor", slug: "nature-outdoor" },
                { label: "Adventure", slug: "adventure" },
              ].map((theme) => (
                <li key={theme.slug}>
                  <Link
                    href={`/themes/${theme.slug}`}
                    className="hover:text-orange transition-colors"
                  >
                    {theme.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* About */}
          <div>
            <h4 className="font-heading font-semibold text-white mb-3">
              About
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/experiences"
                  className="hover:text-orange transition-colors"
                >
                  All Experiences
                </Link>
              </li>
              <li>
                <Link
                  href="/search"
                  className="hover:text-orange transition-colors"
                >
                  Search
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 text-center text-xs text-white/40">
          <p>&copy; {new Date().getFullYear()} Bear Tour. All rights reserved.</p>
          <p className="mt-1">
            Tour data aggregated from Viator and GetYourGuide. We are not affiliated with these providers.
          </p>
        </div>
      </div>
    </footer>
  );
}
