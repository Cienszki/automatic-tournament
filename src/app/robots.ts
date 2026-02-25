// src/app/robots.ts
// Next.js Metadata API - generates /robots.txt automatically
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://dota2inhouse.pl';

  return {
    rules: [
      {
        // Public crawlers: allow all public content, block sensitive/internal routes
        userAgent: '*',
        allow: '/',
        disallow: [
          // Admin panels
          '/*/admin',
          '/*/admin/',
          '/*/admin/*',
          // Dev/seed tools (removed, but defensive rule in case they come back)
          '/*/seed-data',
          '/*/seed-playoffs',
          // Auth-required / personal pages (no SEO value)
          '/*/my-team',
          '/*/register',
          '/*/fantasy',
          '/*/pickem',
          // Internal API
          '/api/',
          // Dev endpoints
          '/api/dev/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
