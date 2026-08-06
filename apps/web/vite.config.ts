import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

const webPackage = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string };

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '');
  const debugBuild = environment.VITE_ENABLE_DEBUG === 'true';

  return {
    define: {
      __BIGMONEY_VERSION__: JSON.stringify(webPackage.version)
    },
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          id: '/',
          name: 'Big Money',
          short_name: 'Big Money',
          description: '2.5D 本地多人回合制大富翁游戏',
          lang: 'zh-CN',
          display: 'standalone',
          orientation: 'landscape',
          background_color: '#DCEBE6',
          theme_color: '#22343A',
          start_url: '/',
          scope: '/',
          categories: ['games', 'entertainment']
        },
        workbox: {
          navigateFallback: '/index.html',
          globPatterns: ['**/*.{js,css,html,svg,json,webp,png,woff2}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true
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
      sourcemap: debugBuild,
      outDir: 'dist',
      emptyOutDir: true
    }
  };
});
