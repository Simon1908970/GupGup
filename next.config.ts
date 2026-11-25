import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.0.4"],
  // Hostinger build server reports many CPUs but has limited memory;
  // limit build workers so static page generation does not crash (SIGABRT).
  experimental: {
    cpus: 1,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-src 'self' https://www.youtube-nocookie.com https://www.tiktok.com https://www.facebook.com https://postcode.map.kakao.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
