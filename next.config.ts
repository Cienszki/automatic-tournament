import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
    // Exclude archive folder from build
    typescript: {
        ignoreBuildErrors: false,
    },
    eslint: {
        ignoreDuringBuilds: false,
        dirs: ['src'],
    },
    pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
    // Exclude _archive from webpack processing
    webpack: (config) => {
        config.watchOptions = {
            ...config.watchOptions,
            ignored: ['**/_archive/**', '**/node_modules/**'],
        };
        return config;
    },
    images: {
        // Enable Next.js image optimization for better performance
        unoptimized: false,
        formats: ['image/avif', 'image/webp'],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'via.placeholder.com',
            },
            {
                protocol: 'https',
                hostname: 'placehold.co',
            },
            {
                protocol: 'https',
                hostname: 'steamcdn-a.akamaihd.net',
            },
            {
                protocol: 'https',
                hostname: 'cdn.steamusercontent.com',
            },
            {
                protocol: 'https',
                hostname: 'firebasestorage.googleapis.com',
            },
            {
                protocol: 'https',
                hostname: 'tournament-tracker-f35tb.firebasestorage.app',
            },
            {
                protocol: 'https',
                hostname: 'avatars.steamstatic.com',
            },
        ],
    },
    async redirects() {
        return [
            // Legacy URL redirects to Letnia tournament
            { source: '/teams', destination: '/letnia/teams', permanent: true },
            { source: '/groups', destination: '/letnia/groups', permanent: true },
            { source: '/schedule', destination: '/letnia/schedule', permanent: true },
            { source: '/playoffs', destination: '/letnia/playoffs', permanent: true },
            { source: '/fantasy', destination: '/letnia/fantasy', permanent: true },
            { source: '/pickem', destination: '/letnia/pickem', permanent: true },
            { source: '/stats', destination: '/letnia/stats', permanent: true },
            { source: '/rules', destination: '/letnia/rules', permanent: true },
            { source: '/faq', destination: '/letnia/faq', permanent: true },
            { source: '/standins', destination: '/letnia/standins', permanent: true },
            { source: '/register', destination: '/letnia/register', permanent: true },
            { source: '/my-team', destination: '/letnia/my-team', permanent: true },
            { source: '/admin/:path*', destination: '/letnia/admin/:path*', permanent: true },
        ];
    },
};

export default withNextIntl(nextConfig);
