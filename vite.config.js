import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

/** @type {import('vite').UserConfig} */
export default { 
    build: { 
        sourcemap: true,
    },
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,json,mcm,woff2}'],
                // 5MB
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            },
            includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
            manifest: {
                name: pkg.displayName,
                short_name: pkg.productName,
                description: pkg.description,
                theme_color: '#ffffff',
                icons: [
                    {
                        src: '/images/pwa/bf_icon_128.png',
                        sizes: '128x128',
                        type: 'image/png',
                    },
                    {
                        src: '/images/pwa/bf_icon_192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: '/images/pwa/bf_icon_256.png',
                        sizes: '256x256',
                        type: 'image/png',
                    },
                ],
            },
        }),
    ],
}