export interface Price {
  amount: number;
  currency: string;
  display: string;
}

export interface Duration {
  hours: number;
  display: string;
}

export interface Rating {
  score: number;
  count: number;
}

export interface Location {
  city: string;
  citySlug: string;
  region: string;
}

export interface Source {
  platform: string;
  url: string;
  productId: string;
  lastScraped: string;
}

export interface Experience {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  price: Price;
  duration: Duration;
  rating: Rating;
  images: string[];
  thumbnail: string;
  location: Location;
  categories: string[];
  themes: string[];
  highlights: string[];
  source: Source;
  bookingUrl: string;
  isPopular: boolean;
  isFeatured: boolean;
}

export interface Destination {
  slug: string;
  name: string;
  nameJa: string;
  region: string;
  description: string;
  image: string;
  experienceCount: number;
}

export interface Theme {
  slug: string;
  name: string;
  icon: string;
  description: string;
  keywords: string[];
}

export interface SearchFilters {
  query?: string;
  city?: string;
  theme?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sortBy?: "price-asc" | "price-desc" | "rating" | "popular";
}
