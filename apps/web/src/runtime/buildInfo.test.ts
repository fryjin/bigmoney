import { describe, expect, it } from 'vitest';
import { createBuildInfo, shortCommit } from './buildInfo';

describe('build info', () => {
  it('normalizes missing build metadata', () => {
    expect(createBuildInfo({}, '0.3.0')).toEqual({
      version: '0.3.0',
      channel: 'local',
      commit: 'local',
      builtAt: null,
      debug: false
    });
  });

  it('reads CI metadata without exposing secrets', () => {
    const info = createBuildInfo(
      {
        VITE_BUILD_CHANNEL: 'ci',
        VITE_BUILD_COMMIT: '1234567890abcdef',
        VITE_BUILD_TIME: '2026-08-06T03:00:00Z',
        VITE_ENABLE_DEBUG: 'false'
      },
      '0.3.0'
    );

    expect(info.channel).toBe('ci');
    expect(info.builtAt).toBe('2026-08-06T03:00:00Z');
    expect(info.debug).toBe(false);
    expect(shortCommit(info.commit)).toBe('12345678');
  });
});
