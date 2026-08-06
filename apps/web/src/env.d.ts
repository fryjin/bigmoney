/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUILD_CHANNEL?: string;
  readonly VITE_BUILD_COMMIT?: string;
  readonly VITE_BUILD_TIME?: string;
  readonly VITE_ENABLE_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __BIGMONEY_VERSION__: string;
