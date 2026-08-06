export interface BuildEnvironment {
  VITE_BUILD_CHANNEL?: string;
  VITE_BUILD_COMMIT?: string;
  VITE_BUILD_TIME?: string;
  VITE_ENABLE_DEBUG?: string;
}

export interface BuildInfo {
  version: string;
  channel: string;
  commit: string;
  builtAt: string | null;
  debug: boolean;
}

function clean(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

export function createBuildInfo(
  environment: BuildEnvironment,
  version: string
): BuildInfo {
  return {
    version: clean(version, '0.0.0'),
    channel: clean(environment.VITE_BUILD_CHANNEL, 'local'),
    commit: clean(environment.VITE_BUILD_COMMIT, 'local'),
    builtAt: environment.VITE_BUILD_TIME?.trim() || null,
    debug: environment.VITE_ENABLE_DEBUG === 'true'
  };
}

export const BUILD_INFO = createBuildInfo(import.meta.env, __BIGMONEY_VERSION__);

export function shortCommit(commit: string): string {
  return commit === 'local' ? commit : commit.slice(0, 8);
}
