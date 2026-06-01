export const SITE_NAME = "Bear Tour";
export const SITE_DESCRIPTION =
  "Discover the best tours and experiences across Japan. Curated from top providers, guided by our friendly bear mascot.";
export const SITE_URL = "https://beartour.jp";

export const CITIES = [
  "Tokyo",
  "Kyoto",
  "Osaka",
  "Hiroshima",
  "Nara",
  "Hakone",
] as const;

export const NAV_LINKS = [
  { label: "Experiences", href: "/experiences" },
  { label: "Destinations", href: "/destinations" },
  { label: "Themes", href: "/themes" },
] as const;

// Stats are now fetched dynamically via getSiteStats() in data.ts
