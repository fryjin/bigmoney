export interface RuntimeHealth {
  online: boolean;
  serviceWorkerSupported: boolean;
  serviceWorkerControlled: boolean;
  indexedDbSupported: boolean;
  localStorageAvailable: boolean;
  standalone: boolean;
  viewport: string;
}

export interface RuntimeEnvironment {
  online: boolean;
  serviceWorkerSupported: boolean;
  serviceWorkerControlled: boolean;
  indexedDbSupported: boolean;
  localStorageAvailable: boolean;
  standalone: boolean;
  width: number;
  height: number;
}

export function evaluateRuntimeHealth(
  environment: RuntimeEnvironment
): RuntimeHealth {
  return {
    online: environment.online,
    serviceWorkerSupported: environment.serviceWorkerSupported,
    serviceWorkerControlled: environment.serviceWorkerControlled,
    indexedDbSupported: environment.indexedDbSupported,
    localStorageAvailable: environment.localStorageAvailable,
    standalone: environment.standalone,
    viewport: `${Math.max(0, Math.round(environment.width))}×${Math.max(
      0,
      Math.round(environment.height)
    )}`
  };
}

function canUseLocalStorage(): boolean {
  try {
    const key = '__bigmoney_runtime_probe__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function collectRuntimeHealth(): RuntimeHealth {
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };

  return evaluateRuntimeHealth({
    online: navigator.onLine,
    serviceWorkerSupported: 'serviceWorker' in navigator,
    serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
    indexedDbSupported: 'indexedDB' in window,
    localStorageAvailable: canUseLocalStorage(),
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      navigatorWithStandalone.standalone === true,
    width: window.innerWidth,
    height: window.innerHeight
  });
}
