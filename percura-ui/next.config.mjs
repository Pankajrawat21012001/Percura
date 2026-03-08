import path from 'path';

/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  // Use static export for production (served via Node.js backend)
  output: isProd ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  // Fix workspace root resolution for Turbopack in a monorepo
  turbopack: {
    root: path.resolve(import.meta.dirname, '..'),
  },
  // Ensure Three.js packages are transpiled correctly
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
};

export default nextConfig;

