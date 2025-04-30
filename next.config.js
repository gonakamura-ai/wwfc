/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['via.placeholder.com', 'images.unsplash.com', 'flagcdn.com'],
  },
  transpilePackages: ['leaflet', 'react-leaflet'],
  experimental: {
    esmExternals: 'loose',
  },
}

module.exports = nextConfig 