import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.viator.com",
      },
      {
        protocol: "https",
        hostname: "**.getyourguide.com",
      },
      {
        protocol: "https",
        hostname: "**.klook.com",
      },
      {
        protocol: "https",
        hostname: "image.asoview-media.com",
      },
      {
        protocol: "https",
        hostname: "**.jalan.net",
      },
      {
        protocol: "https",
        hostname: "cdn.activityboard.jp",
      },
      {
        protocol: "https",
        hostname: "cdn.jalan.jp",
      },
      {
        protocol: "https",
        hostname: "cdn2.veltra.com",
      },
      {
        protocol: "https",
        hostname: "storage.otonami.jp",
      },
      {
        protocol: "https",
        hostname: "otonami.jp",
      },
      {
        protocol: "https",
        hostname: "images.gowithguide.com",
      },
      {
        protocol: "https",
        hostname: "airkitchen.me",
      },
      {
        protocol: "https",
        hostname: "assets.deep-exp.com",
      },
      {
        protocol: "https",
        hostname: "d3e8ogs60q6bjk.cloudfront.net",
      },
    ],
  },
};

export default nextConfig;
