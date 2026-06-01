import type { MetadataRoute } from "next";
import { getExperiences, getDestinations, getThemes } from "@/lib/data";
import { SITE_URL } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const experiences = getExperiences();
  const destinations = getDestinations();
  const themes = getThemes();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/experiences`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/destinations`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/themes`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/search`, changeFrequency: "weekly", priority: 0.6 },
  ];

  const experiencePages: MetadataRoute.Sitemap = experiences.map((exp) => ({
    url: `${SITE_URL}/experiences/${exp.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const destinationPages: MetadataRoute.Sitemap = destinations.map((dest) => ({
    url: `${SITE_URL}/destinations/${dest.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const themePages: MetadataRoute.Sitemap = themes.map((theme) => ({
    url: `${SITE_URL}/themes/${theme.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...destinationPages, ...themePages, ...experiencePages];
}
