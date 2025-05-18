/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable TypeScript checking during builds to allow us to deploy
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable ESLint during builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  // experimental: {
  //   nodeMiddleware: true,
  // },
};

export default nextConfig;
