import type { Experience } from "@/lib/types";
import { SITE_URL, SITE_NAME } from "@/lib/constants";

/** Website-level structured data */
export function WebsiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: "Discover the best tours and experiences across Japan.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Organization structured data */
export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.ico`,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Experience/TouristAttraction structured data */
export function ExperienceJsonLd({ experience }: { experience: Experience }) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: experience.title,
    description: experience.shortDescription || experience.description?.slice(0, 200),
    url: `${SITE_URL}/experiences/${experience.slug}`,
    image: experience.thumbnail || undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: experience.location.city,
      addressRegion: experience.location.region,
      addressCountry: "JP",
    },
  };

  if (experience.rating.score > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: experience.rating.score.toFixed(1),
      bestRating: "5",
      ratingCount: experience.rating.count,
    };
  }

  if (experience.price.amount > 0) {
    data.offers = {
      "@type": "Offer",
      price: experience.price.amount,
      priceCurrency: experience.price.currency,
      availability: "https://schema.org/InStock",
      url: experience.bookingUrl,
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** BreadcrumbList structured data */
export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; href: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.href}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
