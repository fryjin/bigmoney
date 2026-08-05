import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Big Money',
        short_name: 'Big Money',
        description: '2.5D 本地多人回合制大富翁游戏',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#DCEBE6',
        theme_color: '#22343A',
        start_url: '/'
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,json,webp,png,woff2}']
      }
    })
  ],
  server: {
    host: true,
    port: 4173
  },
  preview: {
    host: true,
    port: 4173
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true
  }
});
