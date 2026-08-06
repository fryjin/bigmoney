import { describe, expect, it } from 'vitest';
import {
  getPresentationProfile,
  normalizePresentationPreferences
} from './preferences';

describe('presentation preferences', () => {
  it('normalizes supported values', () => {
    expect(normalizePresentationPreferences({
      motion: 'reduced',
      quality: 'economy'
    })).toEqual({
      motion: 'reduced',
      quality: 'economy'
    });
  });

  it('uses a short animation profile for reduced motion', () => {
    const profile = getPresentationProfile({
      motion: 'reduced',
      quality: 'high'
    });

    expect(profile.durationScale).toBeLessThan(0.25);
    expect(profile.showTraffic).toBe(true);
  });

  it('disables nonessential traffic in economy mode', () => {
    const profile = getPresentationProfile({
      motion: 'full',
      quality: 'economy'
    });

    expect(profile.showTraffic).toBe(false);
    expect(profile.showAmbientDetails).toBe(false);
  });
});
