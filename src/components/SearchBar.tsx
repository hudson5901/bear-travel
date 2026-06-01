"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin } from "lucide-react";

export function SearchBar({ variant = "hero" }: { variant?: "hero" | "page" }) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  if (variant === "page") {
    return (
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search experiences, destinations..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-cream-dark rounded-xl text-navy placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-orange/50"
          />
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col sm:flex-row gap-3 bg-white/10 backdrop-blur-sm p-2 rounded-2xl max-w-xl mx-auto lg:mx-0">
        <div className="flex-1 relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-navy/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Where do you want to explore?"
            className="w-full pl-10 pr-4 py-3 bg-white rounded-xl text-navy placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-orange/50"
          />
        </div>
        <button
          type="submit"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-orange hover:bg-orange-light text-white font-semibold rounded-xl transition-colors"
        >
          <Search className="w-5 h-5" />
          <span>Search</span>
        </button>
      </div>
    </form>
  );
}
