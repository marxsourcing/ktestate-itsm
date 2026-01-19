import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'jfrfyamohatdiyypytrg.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'jfrfyamohatdiyypytrg.supabase.co',
        port: '',
        pathname: '/storage/v1/object/sign/**',
      }
    ],
  },
};

export default nextConfig;
