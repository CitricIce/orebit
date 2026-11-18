import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The guide moved onto the start screen. Keep old links working.
  async redirects() {
    return [{ source: "/how-to-play", destination: "/", permanent: true }];
  },
};

export default nextConfig;
