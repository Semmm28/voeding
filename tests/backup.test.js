import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BACKUP_SCHEMA_VERSION,
  BackupValidationError,
  exportBackup,
  importBackup,
  validateBackup,
} from '../src/storage/backup.js';

function validData() {
  return {
    settings: [{ key: 'profile', value: { mealsPerDay: 4 } }],
    plans: [{ id: 'plan-1', days: [{ meals: [{ recipeId: 'custom-recipe' }] }] }],
    customIngredients: [{
      id: 'custom-protein',
      name: 'Eigen proteïne',
      per100: { kcal: 350, protein: 75, carbs: 5, fat: 4, fiber: 2 },
      pricePer100g: 2.5,
      allergens: [],
      flags: { vegetarian: true, vegan: true, lactoseFree: true, glutenFree: true },
      origin: 'custom',
    }],
    customRecipes: [{
      id: 'custom-recipe',
      name: 'Eigen shake',
      mealTypes: ['snack'],
      prepMinutes: 2,
      ingredients: [{
        ingredientId: 'custom-protein',
        grams: 30,
        adjustable: { min: 20, max: 50, step: 5 },
      }],
      origin: 'custom',
    }],
    meta: [{ key: 'schemaVersion', value: 1 }],
  };
}

test('exporteert en importeert een gevalideerde, versievaste back-up', () => {
  const json = exportBackup(validData(), {
    now: '2026-08-03T12:00:00.000Z',
    pretty: false,
  });
  const imported = importBackup(json);

  assert.equal(imported.schemaVersion, BACKUP_SCHEMA_VERSION);
  assert.equal(imported.exportedAt, '2026-08-03T12:00:00.000Z');
  assert.deepEqual(imported.data, validData());
  assert.equal(validateBackup(imported), true);
});

test('weigert prototype pollution-velden', () => {
  const malicious = '{"schemaVersion":1,"exportedAt":"2026-08-03T12:00:00.000Z","data":{"settings":[],"plans":[],"customIngredients":[],"customRecipes":[],"meta":[],"__proto__":{"polluted":true}}}';
  assert.throws(() => importBackup(malicious), BackupValidationError);
  assert.equal({}.polluted, undefined);
});

test('weigert onvolledige custom records en dubbele IDs', () => {
  const data = validData();
  data.customIngredients[0].per100.protein = -1;
  assert.throws(
    () => exportBackup(data),
    (error) => error instanceof BackupValidationError && error.path.includes('protein'),
  );

  const duplicate = validData();
  duplicate.settings.push({ key: 'profile', value: {} });
  assert.throws(() => exportBackup(duplicate), /Dubbele sleutel/);
});

test('weigert back-ups uit een nieuwere schemaversie', () => {
  const future = {
    schemaVersion: BACKUP_SCHEMA_VERSION + 1,
    exportedAt: '2026-08-03T12:00:00.000Z',
    data: validData(),
  };
  assert.throws(() => importBackup(future), /nieuwere appversie/);
});

