export const APP_CACHE_PREFIX = 'voeding-pwa-';

const SETTLED_WORKER_STATES = new Set(['activated', 'redundant']);

export function waitForWorkerActivation(worker, timeoutMs = 6000) {
  if (!worker || SETTLED_WORKER_STATES.has(worker.state)) return Promise.resolve();

  return new Promise((resolve) => {
    let timeoutId;
    const finish = () => {
      worker.removeEventListener?.('statechange', handleStateChange);
      globalThis.clearTimeout(timeoutId);
      resolve();
    };
    const handleStateChange = () => {
      if (SETTLED_WORKER_STATES.has(worker.state)) finish();
    };

    worker.addEventListener?.('statechange', handleStateChange);
    timeoutId = globalThis.setTimeout(finish, timeoutMs);
    handleStateChange();
  });
}

export async function clearAppCaches(cacheStorage = globalThis.caches) {
  if (!cacheStorage?.keys || !cacheStorage?.delete) return [];

  const cacheNames = await cacheStorage.keys();
  const appCacheNames = cacheNames.filter((name) => name.startsWith(APP_CACHE_PREFIX));
  await Promise.all(appCacheNames.map((name) => cacheStorage.delete(name)));
  return appCacheNames;
}

export async function refreshAppVersion({
  serviceWorker = globalThis.navigator?.serviceWorker,
  cacheStorage = globalThis.caches,
  isOnline = globalThis.navigator?.onLine !== false,
  reload = () => globalThis.location?.reload(),
} = {}) {
  if (!isOnline) {
    throw new Error('Maak eerst verbinding met internet om de nieuwste appversie te laden.');
  }

  const registration = await serviceWorker?.getRegistration?.();
  if (registration) {
    await registration.update();
    await waitForWorkerActivation(registration.installing ?? registration.waiting);
  }

  await clearAppCaches(cacheStorage);
  reload();
}

export function setupReloadButton({
  documentRef = globalThis.document,
  refresh = refreshAppVersion,
} = {}) {
  const button = documentRef?.querySelector?.('#reload-app');
  if (!button || button.dataset.reloadHandlerAttached === 'true') return null;

  const status = documentRef.querySelector('#app-update-status');
  button.dataset.reloadHandlerAttached = 'true';
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    if (status) status.textContent = 'Nieuwe versie controleren en app herladen…';

    try {
      await refresh();
    } catch (error) {
      console.error('App herladen mislukt.', error);
      if (status) status.textContent = error?.message ?? 'Herladen is mislukt. Probeer het opnieuw.';
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  });

  return button;
}

if (typeof document !== 'undefined') setupReloadButton();
