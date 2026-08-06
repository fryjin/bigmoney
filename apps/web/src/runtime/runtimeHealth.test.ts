import { describe, expect, it } from 'vitest';
import { evaluateRuntimeHealth } from './runtimeHealth';

describe('runtime health', () => {
  it('creates a stable deployment diagnostic snapshot', () => {
    expect(
      evaluateRuntimeHealth({
        online: true,
        serviceWorkerSupported: true,
        serviceWorkerControlled: false,
        indexedDbSupported: true,
        localStorageAvailable: true,
        standalone: false,
        width: 1194.4,
        height: 833.6
      })
    ).toEqual({
      online: true,
      serviceWorkerSupported: true,
      serviceWorkerControlled: false,
      indexedDbSupported: true,
      localStorageAvailable: true,
      standalone: false,
      viewport: '1194×834'
    });
  });

  it('clamps invalid viewport values', () => {
    expect(
      evaluateRuntimeHealth({
        online: false,
        serviceWorkerSupported: false,
        serviceWorkerControlled: false,
        indexedDbSupported: false,
        localStorageAvailable: false,
        standalone: false,
        width: -10,
        height: -1
      }).viewport
    ).toBe('0×0');
  });
});
