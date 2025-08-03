
/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
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
};

export default nextConfig;
