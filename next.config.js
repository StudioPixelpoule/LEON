/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: [
      'image.tmdb.org',              // TMDB images (posters auto)
      'vjgflvphprmuxsfwmhyo.supabase.co' // Supabase Storage (jaquettes manuelles)
    ],
    formats: ['image/webp'], // Optimisation WebP
  },
}

module.exports = nextConfig

