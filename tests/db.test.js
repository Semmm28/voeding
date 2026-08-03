import test from 'node:test';
import assert from 'node:assert/strict';

import { createPersonalCopy, openNutritionDatabase } from '../src/storage/db.js';

test('meldt duidelijk wanneer IndexedDB niet beschikbaar is', async () => {
  await assert.rejects(
    openNutritionDatabase({ indexedDB: null }),
    /IndexedDB is niet beschikbaar/,
  );
});

test('maakt een losstaande persoonlijke kopie met herkomst', () => {
  const builtIn = {
    id: 'oats',
    name: 'Havermout',
    builtIn: true,
    per100: { kcal: 370 },
  };
  const copy = createPersonalCopy(builtIn, {
    id: 'my-oats',
    name: 'Mijn havermout',
  });

  assert.equal(copy.id, 'my-oats');
  assert.equal(copy.sourceId, 'oats');
  assert.equal(copy.origin, 'custom');
  assert.equal(copy.builtIn, false);
  copy.per100.kcal = 380;
  assert.equal(builtIn.per100.kcal, 370);
});

test('persoonlijke kopie mag het ingebouwde ID niet hergebruiken', () => {
  assert.throws(
    () => createPersonalCopy({ id: 'tofu', name: 'Tofu' }, { id: 'tofu' }),
    /nieuw ID/,
  );
});

