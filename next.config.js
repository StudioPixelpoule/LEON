/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['image.tmdb.org'], // TMDB images
    formats: ['image/webp'], // Optimisation WebP
  },
}

module.exports = nextConfig

