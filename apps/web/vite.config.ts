import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: '微缩小镇大富翁',
        short_name: '微缩小镇',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#DDEBE7',
        theme_color: '#DDEBE7'
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,json,png,jpg,jpeg,webp,avif,svg,ogg,mp3,m4a}']
      }
    })
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1400
  }
});
