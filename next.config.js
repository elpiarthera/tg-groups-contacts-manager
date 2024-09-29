const withPWA = require('next-pwa');

/** @type {import('next').NextConfig} */
const nextConfig = withPWA({
    dest: 'public',
    register: true,
    skipWaiting: true,
})({
    // Your existing Next.js configuration options go here
});

module.exports = nextConfig;
