/** IndexedDB persistence for user-owned settings, plans and catalogue copies. */

/** Default IndexedDB database name. */
export const DATABASE_NAME = 'voeding-planner';
/** Current IndexedDB schema version. */
export const DATABASE_VERSION = 1;

/** Stable public names for all user-data stores. */
export const STORE_NAMES = Object.freeze({
  settings: 'settings',
  plans: 'plans',
  customIngredients: 'customIngredients',
  customRecipes: 'customRecipes',
  meta: 'meta',
});

const STORE_DEFINITIONS = Object.freeze({
  [STORE_NAMES.settings]: { keyPath: 'key' },
  [STORE_NAMES.plans]: { keyPath: 'id' },
  [STORE_NAMES.customIngredients]: { keyPath: 'id' },
  [STORE_NAMES.customRecipes]: { keyPath: 'id' },
  [STORE_NAMES.meta]: { keyPath: 'key' },
});

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB-verzoek mislukt.'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB-transactie afgebroken.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB-transactie mislukt.'));
  });
}

function assertStoreName(storeName) {
  if (!Object.values(STORE_NAMES).includes(storeName)) {
    throw new RangeError(`Onbekende opslag: ${storeName}`);
  }
}

function assertRecord(record, keyName) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('Het opslagrecord moet een object zijn.');
  }
  if (typeof record[keyName] !== 'string' || !record[keyName].trim()) {
    throw new TypeError(`Het opslagrecord mist een geldige ${keyName}.`);
  }
}

function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function slug(value) {
  return String(value ?? 'item')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36) || 'item';
}

function uniqueSuffix() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normaliseProtectedIds(value = {}) {
  return {
    [STORE_NAMES.customIngredients]: new Set(
      value.ingredients ?? value.customIngredients ?? [],
    ),
    [STORE_NAMES.customRecipes]: new Set(
      value.recipes ?? value.customRecipes ?? [],
    ),
  };
}

function isBuiltInRecord(record) {
  return record?.builtIn === true
    || record?.isBuiltIn === true
    || record?.official === true
    || record?.origin === 'built-in';
}

/**
 * Promise-based facade around an open IndexedDB connection. Use
 * `openNutritionDatabase` rather than constructing this class directly.
 */
export class NutritionDatabase {
  constructor(database, { protectedIds = {} } = {}) {
    this.database = database;
    this.protectedIds = normaliseProtectedIds(protectedIds);
  }

  /** Closes this tab's database connection. */
  close() {
    this.database.close();
  }

  /** Reads a record by key. */
  async get(storeName, key) {
    assertStoreName(storeName);
    const transaction = this.database.transaction(storeName, 'readonly');
    const result = await requestToPromise(transaction.objectStore(storeName).get(key));
    await transactionDone(transaction);
    return result;
  }

  /** Reads all records from a store. */
  async getAll(storeName) {
    assertStoreName(storeName);
    const transaction = this.database.transaction(storeName, 'readonly');
    const result = await requestToPromise(transaction.objectStore(storeName).getAll());
    await transactionDone(transaction);
    return result;
  }

  /**
   * Writes one record. Built-in catalogue IDs and records are rejected in the
   * custom stores; create a personal copy with `createPersonalCopy` first.
   */
  async put(storeName, record) {
    assertStoreName(storeName);
    const keyName = STORE_DEFINITIONS[storeName].keyPath;
    assertRecord(record, keyName);
    this.#assertUserOwned(storeName, record);
    const transaction = this.database.transaction(storeName, 'readwrite');
    const result = await requestToPromise(transaction.objectStore(storeName).put(cloneValue(record)));
    await transactionDone(transaction);
    return result;
  }

  /** Deletes a user-owned record. */
  async delete(storeName, key) {
    assertStoreName(storeName);
    if (this.protectedIds[storeName]?.has(key)) {
      throw new Error('Een ingebouwd record kan niet worden verwijderd.');
    }
    const transaction = this.database.transaction(storeName, 'readwrite');
    await requestToPromise(transaction.objectStore(storeName).delete(key));
    await transactionDone(transaction);
  }

  /** Clears a store. Custom stores contain only personal records. */
  async clear(storeName) {
    assertStoreName(storeName);
    const transaction = this.database.transaction(storeName, 'readwrite');
    await requestToPromise(transaction.objectStore(storeName).clear());
    await transactionDone(transaction);
  }

  /** Saves the current settings value under a named profile key. */
  async saveSettings(value, key = 'profile') {
    return this.put(STORE_NAMES.settings, {
      key,
      value: cloneValue(value),
      updatedAt: new Date().toISOString(),
    });
  }

  /** Returns a settings value, or the supplied fallback when not stored. */
  async getSettings(key = 'profile', fallback = null) {
    const record = await this.get(STORE_NAMES.settings, key);
    return record ? record.value : fallback;
  }

  /** Saves a generated plan by its ID. */
  async savePlan(plan) {
    return this.put(STORE_NAMES.plans, plan);
  }

  /** Saves a personal ingredient. Built-in IDs cannot be reused. */
  async saveCustomIngredient(ingredient) {
    return this.put(STORE_NAMES.customIngredients, {
      ...cloneValue(ingredient),
      origin: 'custom',
    });
  }

  /** Saves a personal recipe. Built-in IDs cannot be reused. */
  async saveCustomRecipe(recipe) {
    return this.put(STORE_NAMES.customRecipes, {
      ...cloneValue(recipe),
      origin: 'custom',
    });
  }

  /** Exports all user stores in the shape expected by the backup module. */
  async exportData() {
    const entries = await Promise.all(
      Object.values(STORE_NAMES).map(async (storeName) => [storeName, await this.getAll(storeName)]),
    );
    return Object.fromEntries(entries);
  }

  /**
   * Imports validated backup data. `replace` clears user stores first; `merge`
   * updates records with matching keys. Built-in overwrite checks still apply.
   */
  async importData(data, { mode = 'merge' } = {}) {
    if (!['merge', 'replace'].includes(mode)) {
      throw new RangeError('Importmodus moet merge of replace zijn.');
    }
    const storeNames = Object.values(STORE_NAMES);
    for (const storeName of storeNames) {
      if (!Array.isArray(data?.[storeName])) {
        throw new TypeError(`Back-upopslag ${storeName} ontbreekt of is ongeldig.`);
      }
      for (const record of data[storeName]) this.#assertUserOwned(storeName, record);
    }

    const transaction = this.database.transaction(storeNames, 'readwrite');
    try {
      for (const storeName of storeNames) {
        const store = transaction.objectStore(storeName);
        if (mode === 'replace') store.clear();
        for (const record of data[storeName]) store.put(cloneValue(record));
      }
      await transactionDone(transaction);
    } catch (error) {
      try { transaction.abort(); } catch { /* Transaction may already be closed. */ }
      throw error;
    }
  }

  #assertUserOwned(storeName, record) {
    if (![STORE_NAMES.customIngredients, STORE_NAMES.customRecipes].includes(storeName)) return;
    const id = record?.id;
    if (isBuiltInRecord(record) || this.protectedIds[storeName]?.has(id)) {
      throw new Error('Een ingebouwd record kan niet worden overschreven. Maak eerst een persoonlijke kopie.');
    }
  }
}

/**
 * Opens and upgrades the app database. Version 1 creates separate stores for
 * settings, plans, personal catalogue records and migration metadata.
 *
 * @param {object} [options]
 * @param {IDBFactory} [options.indexedDB=globalThis.indexedDB] Injectable factory.
 * @param {string} [options.name='voeding-planner'] Database name.
 * @param {object} [options.protectedIds] Built-in ingredient/recipe ID arrays.
 * @param {Function} [options.onBlocked] Called when another tab blocks upgrade.
 * @returns {Promise<NutritionDatabase>} Open database facade.
 */
export function openNutritionDatabase({
  indexedDB = globalThis.indexedDB,
  name = DATABASE_NAME,
  protectedIds = {},
  onBlocked,
} = {}) {
  if (!indexedDB?.open) {
    return Promise.reject(new Error('IndexedDB is niet beschikbaar in deze browser.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DATABASE_VERSION);
    request.onblocked = () => onBlocked?.();
    request.onerror = () => reject(request.error ?? new Error('De lokale database kon niet worden geopend.'));
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const [storeName, definition] of Object.entries(STORE_DEFINITIONS)) {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, definition);
        }
      }
      const transaction = request.transaction;
      if (transaction && transaction.objectStoreNames.contains(STORE_NAMES.meta)) {
        transaction.objectStore(STORE_NAMES.meta).put({
          key: 'schemaVersion',
          value: DATABASE_VERSION,
        });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(new NutritionDatabase(database, { protectedIds }));
    };
  });
}

/** Alias kept intentionally short for app bootstrap code. */
export const openDatabase = openNutritionDatabase;

/**
 * Creates an editable personal copy without mutating the built-in source.
 * Callers may provide a stable `id`; otherwise a unique custom ID is generated.
 *
 * @param {object} builtInRecord Source ingredient or recipe.
 * @param {object} [overrides] Personal changes, optionally including a new ID.
 * @returns {object} User-owned record with `sourceId` provenance.
 */
export function createPersonalCopy(builtInRecord, overrides = {}) {
  if (!builtInRecord || typeof builtInRecord !== 'object' || !builtInRecord.id) {
    throw new TypeError('Een geldig ingebouwd record is verplicht.');
  }
  const source = cloneValue(builtInRecord);
  const id = overrides.id
    ?? `custom-${slug(source.name ?? source.id)}-${uniqueSuffix()}`;
  if (id === source.id) {
    throw new Error('Een persoonlijke kopie moet een nieuw ID krijgen.');
  }
  return {
    ...source,
    ...cloneValue(overrides),
    id,
    origin: 'custom',
    builtIn: false,
    isBuiltIn: false,
    official: false,
    sourceId: source.id,
  };
}
