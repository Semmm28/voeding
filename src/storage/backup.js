/** Safe JSON backup import/export with explicit schema validation. */

import { STORE_NAMES } from './db.js';

/** Current portable backup schema version. */
export const BACKUP_SCHEMA_VERSION = 1;
/** Hard import/export limit that bounds validation work and local memory use. */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const DATA_KEYS = Object.freeze(Object.values(STORE_NAMES));
const NUTRIENT_KEYS = Object.freeze(['kcal', 'protein', 'carbs', 'fat', 'fiber']);
const FLAG_KEYS = Object.freeze(['vegetarian', 'vegan', 'lactoseFree', 'glutenFree']);

/** Error type used for every rejected backup. */
export class BackupValidationError extends Error {
  constructor(message, path = '$') {
    super(`${message} (${path})`);
    this.name = 'BackupValidationError';
    this.path = path;
  }
}

function fail(message, path) {
  throw new BackupValidationError(message, path);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value, path) {
  if (!isPlainObject(value)) fail('Object verwacht', path);
}

function assertExactKeys(value, allowedKeys, path) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) fail(`Onbekend veld "${key}"`, `${path}.${key}`);
  }
  for (const key of allowedKeys) {
    if (!Object.hasOwn(value, key)) fail(`Verplicht veld "${key}" ontbreekt`, path);
  }
}

function assertString(value, path, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    fail('Niet-lege tekst verwacht', path);
  }
}

function assertFiniteNonNegative(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail('Niet-negatief eindig getal verwacht', path);
  }
}

function assertStringArray(value, path) {
  if (!Array.isArray(value)) fail('Lijst verwacht', path);
  for (const [index, item] of value.entries()) assertString(item, `${path}[${index}]`);
}

function inspectSafeJson(value, path = '$', depth = 0, seen = new Set()) {
  if (depth > 40) fail('Back-up is te diep genest', path);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('Niet-eindig getal is niet toegestaan', path);
    return;
  }
  if (typeof value !== 'object') fail('Alleen JSON-waarden zijn toegestaan', path);
  if (seen.has(value)) fail('Cyclische verwijzing is niet toegestaan', path);
  seen.add(value);

  if (Array.isArray(value)) {
    if (value.length > 50_000) fail('Lijst is te groot', path);
    for (const [index, item] of value.entries()) {
      inspectSafeJson(item, `${path}[${index}]`, depth + 1, seen);
    }
  } else {
    assertPlainObject(value, path);
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) fail(`Onveilig veld "${key}"`, `${path}.${key}`);
      inspectSafeJson(item, `${path}.${key}`, depth + 1, seen);
    }
  }
  seen.delete(value);
}

function safeClone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => safeClone(item));
  const clone = {};
  for (const [key, item] of Object.entries(value)) clone[key] = safeClone(item);
  return clone;
}

function validateKeyedRecord(record, path, keyName) {
  assertPlainObject(record, path);
  assertString(record[keyName], `${path}.${keyName}`);
}

function validateIngredient(record, path) {
  validateKeyedRecord(record, path, 'id');
  assertString(record.name, `${path}.name`);
  assertPlainObject(record.per100, `${path}.per100`);
  for (const nutrient of NUTRIENT_KEYS) {
    assertFiniteNonNegative(record.per100[nutrient], `${path}.per100.${nutrient}`);
  }
  assertFiniteNonNegative(record.pricePer100g, `${path}.pricePer100g`);
  assertStringArray(record.allergens, `${path}.allergens`);
  assertPlainObject(record.flags, `${path}.flags`);
  for (const flag of FLAG_KEYS) {
    if (typeof record.flags[flag] !== 'boolean') fail('Booleaanse waarde verwacht', `${path}.flags.${flag}`);
  }
}

function validateAdjustable(adjustable, path) {
  assertPlainObject(adjustable, path);
  for (const key of ['min', 'max', 'step']) {
    assertFiniteNonNegative(adjustable[key], `${path}.${key}`);
  }
  if (adjustable.max < adjustable.min) fail('Maximum moet minimaal gelijk zijn aan minimum', path);
  if (adjustable.step <= 0) fail('Stap moet groter zijn dan nul', `${path}.step`);
}

function validateRecipe(record, path) {
  validateKeyedRecord(record, path, 'id');
  assertString(record.name, `${path}.name`);
  assertStringArray(record.mealTypes, `${path}.mealTypes`);
  assertFiniteNonNegative(record.prepMinutes, `${path}.prepMinutes`);
  if (!Array.isArray(record.ingredients) || record.ingredients.length === 0) {
    fail('Recept moet minimaal één ingrediënt bevatten', `${path}.ingredients`);
  }
  for (const [index, line] of record.ingredients.entries()) {
    const linePath = `${path}.ingredients[${index}]`;
    assertPlainObject(line, linePath);
    assertString(line.ingredientId, `${linePath}.ingredientId`);
    assertFiniteNonNegative(line.grams, `${linePath}.grams`);
    if (line.adjustable !== undefined && line.adjustable !== null) {
      validateAdjustable(line.adjustable, `${linePath}.adjustable`);
    }
  }
}

function validatePlan(record, path) {
  validateKeyedRecord(record, path, 'id');
  if (!Array.isArray(record.days)) fail('Plan moet een dagenlijst bevatten', `${path}.days`);
  for (const [dayIndex, day] of record.days.entries()) {
    const dayPath = `${path}.days[${dayIndex}]`;
    assertPlainObject(day, dayPath);
    if (!Array.isArray(day.meals)) fail('Dag moet een maaltijdenlijst bevatten', `${dayPath}.meals`);
    for (const [mealIndex, meal] of day.meals.entries()) {
      const mealPath = `${dayPath}.meals[${mealIndex}]`;
      assertPlainObject(meal, mealPath);
      assertString(meal.recipeId, `${mealPath}.recipeId`);
    }
  }
}

function validateUniqueIds(records, path, keyName) {
  const seen = new Set();
  for (const [index, record] of records.entries()) {
    const key = record[keyName];
    if (seen.has(key)) fail(`Dubbele sleutel "${key}"`, `${path}[${index}].${keyName}`);
    seen.add(key);
  }
}

function validateData(data, path) {
  assertPlainObject(data, path);
  assertExactKeys(data, DATA_KEYS, path);
  for (const key of DATA_KEYS) {
    if (!Array.isArray(data[key])) fail('Lijst met records verwacht', `${path}.${key}`);
  }

  for (const [index, record] of data.settings.entries()) {
    validateKeyedRecord(record, `${path}.settings[${index}]`, 'key');
  }
  for (const [index, record] of data.meta.entries()) {
    validateKeyedRecord(record, `${path}.meta[${index}]`, 'key');
  }
  for (const [index, record] of data.plans.entries()) {
    validatePlan(record, `${path}.plans[${index}]`);
  }
  for (const [index, record] of data.customIngredients.entries()) {
    validateIngredient(record, `${path}.customIngredients[${index}]`);
  }
  for (const [index, record] of data.customRecipes.entries()) {
    validateRecipe(record, `${path}.customRecipes[${index}]`);
  }

  validateUniqueIds(data.settings, `${path}.settings`, 'key');
  validateUniqueIds(data.meta, `${path}.meta`, 'key');
  validateUniqueIds(data.plans, `${path}.plans`, 'id');
  validateUniqueIds(data.customIngredients, `${path}.customIngredients`, 'id');
  validateUniqueIds(data.customRecipes, `${path}.customRecipes`, 'id');
}

// Add `version: (backup) => migratedBackup` entries when the schema advances.
const MIGRATIONS = new Map();

/**
 * Migrates an older structurally safe backup to the current version. New schema
 * releases can add one bounded migration function per prior version.
 */
export function migrateBackup(backup) {
  let current = safeClone(backup);
  if (!Number.isInteger(current.schemaVersion) || current.schemaVersion < 1) {
    fail('Ongeldige schemaversie', '$.schemaVersion');
  }
  if (current.schemaVersion > BACKUP_SCHEMA_VERSION) {
    fail('Deze back-up komt uit een nieuwere appversie', '$.schemaVersion');
  }
  let migrationSteps = 0;
  while (current.schemaVersion < BACKUP_SCHEMA_VERSION) {
    migrationSteps += 1;
    if (migrationSteps > 20) fail('Te veel migratiestappen in back-up', '$.schemaVersion');
    const previousVersion = current.schemaVersion;
    const migration = MIGRATIONS.get(current.schemaVersion);
    if (!migration) fail('Geen migratie beschikbaar voor deze oude back-up', '$.schemaVersion');
    current = migration(current);
    if (!Number.isInteger(current?.schemaVersion) || current.schemaVersion <= previousVersion) {
      fail('Back-upmigratie heeft de versie niet verhoogd', '$.schemaVersion');
    }
  }
  return current;
}

/**
 * Strictly validates a parsed, current-version backup. It returns `true` or
 * throws `BackupValidationError` containing the failing JSON path.
 */
export function validateBackup(backup) {
  inspectSafeJson(backup);
  assertPlainObject(backup, '$');
  assertExactKeys(backup, ['schemaVersion', 'exportedAt', 'data'], '$');
  if (backup.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    fail(`Schemaversie ${BACKUP_SCHEMA_VERSION} verwacht`, '$.schemaVersion');
  }
  assertString(backup.exportedAt, '$.exportedAt');
  const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!isoTimestamp.test(backup.exportedAt) || Number.isNaN(Date.parse(backup.exportedAt))) {
    fail('Geldige ISO-datum verwacht', '$.exportedAt');
  }
  validateData(backup.data, '$.data');
  return true;
}

/**
 * Serialises data returned by `NutritionDatabase.exportData` to safe JSON.
 *
 * @param {object} data Store arrays keyed by `STORE_NAMES`.
 * @param {object} [options]
 * @param {Date|string|number} [options.now=new Date()] Export timestamp.
 * @param {boolean} [options.pretty=true] Pretty-print JSON for inspectability.
 * @returns {string} Validated backup JSON.
 */
export function exportBackup(data, { now = new Date(), pretty = true } = {}) {
  inspectSafeJson(data, '$.data');
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new TypeError('Ongeldige exportdatum.');
  const backup = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: date.toISOString(),
    data: safeClone(data),
  };
  validateBackup(backup);
  const json = JSON.stringify(backup, null, pretty ? 2 : 0);
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) {
    throw new BackupValidationError('Back-up is groter dan de toegestane 5 MB', '$');
  }
  return json;
}

/**
 * Parses, safety-checks, migrates and validates an uploaded backup. No imported
 * value is evaluated as code and dangerous prototype keys are rejected.
 *
 * @param {string|object} input JSON text or an already parsed JSON object.
 * @returns {object} A detached, current-version backup object.
 */
export function importBackup(input) {
  let parsed;
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).byteLength > MAX_BACKUP_BYTES) {
      throw new BackupValidationError('Back-up is groter dan de toegestane 5 MB', '$');
    }
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new BackupValidationError('Bestand bevat geen geldige JSON', '$');
    }
  } else {
    parsed = input;
  }
  inspectSafeJson(parsed);
  const migrated = migrateBackup(parsed);
  validateBackup(migrated);
  return safeClone(migrated);
}
