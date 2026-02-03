import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "source.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "unsplash.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "https://vahq.co.uk",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
