import { BearMascot } from "./BearMascot";
import { SearchBar } from "./SearchBar";

export function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-navy via-navy-light to-navy overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-10 left-10 w-64 h-64 bg-orange/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-orange/5 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          {/* Text content */}
          <div className="flex-1 text-center lg:text-left">
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight">
              Explore Japan
              <br />
              <span className="text-orange">Like Never Before</span>
            </h1>
            <p className="mt-4 text-lg md:text-xl text-white/70 max-w-xl mx-auto lg:mx-0">
              Discover hundreds of curated tours and experiences across Japan&apos;s
              most iconic destinations, all in one place.
            </p>

            <div className="mt-8">
              <SearchBar />
            </div>

            <PopularSearches />
          </div>

          {/* Bear mascot */}
          <div className="flex-shrink-0 hidden lg:block">
            <div className="relative">
              <div className="absolute inset-0 bg-orange/20 rounded-full blur-2xl scale-110" />
              <BearMascot className="relative w-64 h-64 drop-shadow-2xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PopularSearches() {
  const searches = [
    { label: "Tokyo", href: "/destinations/tokyo" },
    { label: "Kyoto", href: "/destinations/kyoto" },
    { label: "Osaka", href: "/destinations/osaka" },
    { label: "Food Tours", href: "/themes/food-drink" },
    { label: "Temple Visits", href: "/themes/culture-history" },
    { label: "Mt. Fuji", href: "/destinations/hakone" },
  ];

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 justify-center lg:justify-start">
      <span className="text-sm text-white/50">Popular:</span>
      {searches.map((s) => (
        <a
          key={s.label}
          href={s.href}
          className="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 text-white/80 rounded-full transition-colors"
        >
          {s.label}
        </a>
      ))}
    </div>
  );
}
