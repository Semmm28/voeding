import assert from 'node:assert/strict';
import test from 'node:test';

import {
  APP_CACHE_PREFIX,
  clearAppCaches,
  refreshAppVersion,
} from '../src/pwa-update.js';

test('verwijdert uitsluitend caches van de Voeding-PWA', async () => {
  const removed = [];
  const cacheStorage = {
    async keys() {
      return [`${APP_CACHE_PREFIX}static-v2`, 'andere-app-cache', `${APP_CACHE_PREFIX}static-v3`];
    },
    async delete(name) {
      removed.push(name);
      return true;
    },
  };

  const cleared = await clearAppCaches(cacheStorage);

  assert.deepEqual(cleared, [`${APP_CACHE_PREFIX}static-v2`, `${APP_CACHE_PREFIX}static-v3`]);
  assert.deepEqual(removed, cleared);
});

test('controleert de serviceworker, wist de appcache en herlaadt daarna', async () => {
  const events = [];
  const registration = {
    installing: null,
    waiting: null,
    async update() {
      events.push('update');
    },
  };
  const cacheStorage = {
    async keys() {
      events.push('keys');
      return [`${APP_CACHE_PREFIX}static-v2`, 'andere-app-cache'];
    },
    async delete(name) {
      events.push(`delete:${name}`);
      return true;
    },
  };

  await refreshAppVersion({
    serviceWorker: {
      async getRegistration() {
        events.push('registration');
        return registration;
      },
    },
    cacheStorage,
    isOnline: true,
    reload: () => events.push('reload'),
  });

  assert.deepEqual(events, [
    'registration',
    'update',
    'keys',
    `delete:${APP_CACHE_PREFIX}static-v2`,
    'reload',
  ]);
});

test('wist geen cache wanneer het apparaat offline is', async () => {
  let cacheRead = false;
  let reloaded = false;

  await assert.rejects(
    refreshAppVersion({
      isOnline: false,
      cacheStorage: {
        async keys() {
          cacheRead = true;
          return [];
        },
      },
      reload: () => {
        reloaded = true;
      },
    }),
    /verbinding met internet/,
  );

  assert.equal(cacheRead, false);
  assert.equal(reloaded, false);
});
