export type MotionPreference = 'full' | 'reduced';
export type QualityPreference = 'high' | 'standard' | 'economy';

export interface PresentationPreferences {
  motion: MotionPreference;
  quality: QualityPreference;
}

export interface PresentationProfile {
  durationScale: number;
  showTraffic: boolean;
  showAmbientDetails: boolean;
}

const STORAGE_KEY = 'bigmoney.presentation-preferences.v1';

export function createDefaultPresentationPreferences(): PresentationPreferences {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    motion: prefersReducedMotion ? 'reduced' : 'full',
    quality: 'standard'
  };
}

export function normalizePresentationPreferences(
  value: unknown
): PresentationPreferences {
  const fallback = createDefaultPresentationPreferences();
  if (!value || typeof value !== 'object') return fallback;

  const record = value as Partial<Record<keyof PresentationPreferences, unknown>>;
  const motion: MotionPreference =
    record.motion === 'reduced' || record.motion === 'full'
      ? record.motion
      : fallback.motion;
  const quality: QualityPreference =
    record.quality === 'high' ||
    record.quality === 'standard' ||
    record.quality === 'economy'
      ? record.quality
      : fallback.quality;

  return { motion, quality };
}

export function loadPresentationPreferences(): PresentationPreferences {
  if (typeof window === 'undefined') return createDefaultPresentationPreferences();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultPresentationPreferences();
    return normalizePresentationPreferences(JSON.parse(raw));
  } catch {
    return createDefaultPresentationPreferences();
  }
}

export function savePresentationPreferences(
  preferences: PresentationPreferences
): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(normalizePresentationPreferences(preferences))
    );
  } catch {
    // 存储不可用时不影响游戏流程；当前会话仍使用内存中的设置。
  }
}

export function getPresentationProfile(
  preferences: PresentationPreferences
): PresentationProfile {
  const qualityProfile: Record<QualityPreference, Omit<PresentationProfile, 'durationScale'>> = {
    high: {
      showTraffic: true,
      showAmbientDetails: true
    },
    standard: {
      showTraffic: true,
      showAmbientDetails: true
    },
    economy: {
      showTraffic: false,
      showAmbientDetails: false
    }
  };

  const durationScale = preferences.motion === 'reduced'
    ? 0.18
    : preferences.quality === 'economy'
      ? 0.76
      : 1;

  return {
    durationScale,
    ...qualityProfile[preferences.quality]
  };
}
