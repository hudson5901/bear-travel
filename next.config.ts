import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.viator.com" },
      { protocol: "https", hostname: "**.getyourguide.com" },
      { protocol: "https", hostname: "**.klook.com" },
      { protocol: "https", hostname: "image.asoview-media.com" },
      { protocol: "https", hostname: "**.jalan.net" },
      { protocol: "https", hostname: "cdn.activityboard.jp" },
      { protocol: "https", hostname: "cdn.jalan.jp" },
      { protocol: "https", hostname: "cdn2.veltra.com" },
      { protocol: "https", hostname: "img-cdn.veltra.com" },
      { protocol: "https", hostname: "**.veltra.com" },
      { protocol: "https", hostname: "storage.otonami.jp" },
      { protocol: "https", hostname: "otonami.jp" },
      { protocol: "https", hostname: "images.gowithguide.com" },
      { protocol: "https", hostname: "airkitchen.me" },
      { protocol: "https", hostname: "image.airkitchen.me" },
      { protocol: "https", hostname: "assets.deep-exp.com" },
      { protocol: "https", hostname: "d3e8ogs60q6bjk.cloudfront.net" },
      { protocol: "https", hostname: "**.tabirai.net" },
      { protocol: "https", hostname: "**.cookly.me" },
      { protocol: "https", hostname: "img.activityjapan.com" },
      { protocol: "https", hostname: "gd.activityjapan.com" },
      { protocol: "https", hostname: "**.go-nagano.net" },
      { protocol: "https", hostname: "**.tabione.com" },
      { protocol: "https", hostname: "byfood.b-cdn.net" },
      { protocol: "https", hostname: "**.tripadvisor.com" },
      { protocol: "https", hostname: "activities.his-j.com" },
      { protocol: "https", hostname: "cdn-imgix.headout.com" },
      { protocol: "https", hostname: "pro-opt.s3.amazonaws.com" },
      { protocol: "https", hostname: "minemurashouten.com" },
      { protocol: "https", hostname: "image.kkday.com" },
    ],
  },
};

export default nextConfig;
