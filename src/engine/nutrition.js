/**
 * Pure nutrition calculations for the local recipe catalogue.
 *
 * All multiplication and addition is performed with unrounded values. Public
 * totals are rounded only after the complete recipe, meal or plan is summed.
 */

/** Canonical nutrient keys returned by every calculation. */
export const NUTRIENT_KEYS = Object.freeze([
  'kcal',
  'protein',
  'carbs',
  'fat',
  'fiber',
]);

const DIET_FLAG_KEYS = Object.freeze([
  'vegetarian',
  'vegan',
  'lactoseFree',
  'glutenFree',
]);

const DEFAULT_PRECISION = Object.freeze({
  kcal: 0,
  protein: 1,
  carbs: 1,
  fat: 1,
  fiber: 1,
  cost: 2,
});

function emptyTotals() {
  return Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, 0]));
}

function finiteNonNegative(value, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function round(value, decimals) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function finalizeTotals(rawTotals, precision = DEFAULT_PRECISION) {
  return Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [
      key,
      round(rawTotals[key] ?? 0, precision[key] ?? 1),
    ]),
  );
}

function toIndex(records) {
  if (records instanceof Map) return records;
  if (Array.isArray(records)) {
    return new Map(records.filter(Boolean).map((record) => [record.id, record]));
  }
  if (records && typeof records === 'object') {
    return new Map(Object.entries(records));
  }
  return new Map();
}

function mergeUnique(target, values) {
  for (const value of values ?? []) {
    if (typeof value === 'string' && value.trim()) target.add(value.trim());
  }
}

function lineGrams(line, overrides, lineIndex) {
  const byIndex = overrides?.[lineIndex];
  const byId = overrides?.[line.ingredientId];
  return finiteNonNegative(byIndex ?? byId ?? line.grams);
}

function calculateRecipeRaw(recipe, ingredientRecords, options = {}) {
  const ingredientIndex = toIndex(ingredientRecords);
  const desiredServings = finiteNonNegative(options.servings, 1);
  const baseServings = finiteNonNegative(recipe?.servings, 1) || 1;
  const servingFactor = desiredServings / baseServings;
  const totals = emptyTotals();
  const allergens = new Set();
  const missingIngredientIds = new Set();
  const missingPriceIngredientIds = new Set();
  const flags = Object.fromEntries(DIET_FLAG_KEYS.map((key) => [key, true]));
  let knownIngredientCount = 0;
  let cost = 0;

  for (const [lineIndex, line] of (recipe?.ingredients ?? []).entries()) {
    const ingredientId = line?.ingredientId;
    const ingredient = ingredientIndex.get(ingredientId);
    if (!ingredient) {
      if (typeof ingredientId === 'string' && ingredientId) {
        missingIngredientIds.add(ingredientId);
      }
      for (const flag of DIET_FLAG_KEYS) flags[flag] = false;
      continue;
    }

    knownIngredientCount += 1;
    const grams = lineGrams(line, options.ingredientGrams, lineIndex) * servingFactor;
    const multiplier = grams / 100;

    for (const nutrient of NUTRIENT_KEYS) {
      totals[nutrient] += finiteNonNegative(ingredient.per100?.[nutrient]) * multiplier;
    }

    if (Number.isFinite(ingredient.pricePer100g) && ingredient.pricePer100g >= 0) {
      cost += ingredient.pricePer100g * multiplier;
    } else {
      missingPriceIngredientIds.add(ingredient.id);
    }

    mergeUnique(allergens, ingredient.allergens);
    for (const flag of DIET_FLAG_KEYS) {
      flags[flag] = flags[flag] && ingredient.flags?.[flag] === true;
    }
  }

  if (knownIngredientCount === 0 || missingIngredientIds.size > 0) {
    for (const flag of DIET_FLAG_KEYS) flags[flag] = false;
  }

  return {
    totals,
    cost,
    allergens,
    flags,
    missingIngredientIds,
    missingPriceIngredientIds,
    lineCount: recipe?.ingredients?.length ?? 0,
    knownIngredientCount,
  };
}

function publicResult(raw, extra = {}, precision = DEFAULT_PRECISION) {
  const missingIngredientIds = [...raw.missingIngredientIds].sort();
  const missingPriceIngredientIds = [...raw.missingPriceIngredientIds].sort();
  return {
    ...extra,
    totals: finalizeTotals(raw.totals, precision),
    cost: round(raw.cost, precision.cost ?? 2),
    allergens: [...raw.allergens].sort((a, b) => a.localeCompare(b, 'nl')),
    flags: { ...raw.flags },
    missingIngredientIds,
    missingPriceIngredientIds,
    complete: missingIngredientIds.length === 0
      && raw.lineCount > 0
      && raw.knownIngredientCount === raw.lineCount,
  };
}

function mergeRaw(target, source) {
  for (const nutrient of NUTRIENT_KEYS) {
    target.totals[nutrient] += source.totals[nutrient];
  }
  target.cost += source.cost;
  target.lineCount += source.lineCount;
  target.knownIngredientCount += source.knownIngredientCount;
  mergeUnique(target.allergens, source.allergens);
  mergeUnique(target.missingIngredientIds, source.missingIngredientIds);
  mergeUnique(target.missingPriceIngredientIds, source.missingPriceIngredientIds);
  for (const flag of DIET_FLAG_KEYS) {
    target.flags[flag] = target.flags[flag] && source.flags[flag];
  }
  return target;
}

function emptyRaw() {
  return {
    totals: emptyTotals(),
    cost: 0,
    allergens: new Set(),
    flags: Object.fromEntries(DIET_FLAG_KEYS.map((key) => [key, true])),
    missingIngredientIds: new Set(),
    missingPriceIngredientIds: new Set(),
    lineCount: 0,
    knownIngredientCount: 0,
  };
}

/**
 * Calculates one serving (or a requested number of servings) directly from a
 * recipe's ingredient weights.
 *
 * @param {object} recipe Recipe with `ingredients[].ingredientId` and `grams`.
 * @param {Array|Map|object} ingredients Ingredient catalogue or ID index.
 * @param {object} [options]
 * @param {number} [options.servings=1] Number of portions to calculate.
 * @param {object} [options.ingredientGrams] Per-ID or per-line gram overrides.
 * @param {object} [options.precision] Decimal precision per returned value.
 * @returns {{totals: object, cost: number, allergens: string[], flags: object,
 *   missingIngredientIds: string[], missingPriceIngredientIds: string[], complete: boolean}}
 */
export function calculateRecipeNutrition(recipe, ingredients, options = {}) {
  const raw = calculateRecipeRaw(recipe, ingredients, options);
  return publicResult(
    raw,
    {
      recipeId: recipe?.id ?? null,
      servings: finiteNonNegative(options.servings, 1),
    },
    { ...DEFAULT_PRECISION, ...options.precision },
  );
}

/**
 * Calculates a planned meal. A meal references a recipe by `recipeId` and may
 * contain `servings` and `ingredientGrams` overrides.
 *
 * @param {object} meal Planned meal.
 * @param {Array|Map|object} recipes Recipe catalogue or ID index.
 * @param {Array|Map|object} ingredients Ingredient catalogue or ID index.
 * @param {object} [options] Calculation options, including precision.
 * @returns {object} Rounded meal totals and transparent missing-record lists.
 */
export function calculateMealNutrition(meal, recipes, ingredients, options = {}) {
  const recipeIndex = toIndex(recipes);
  const recipe = recipeIndex.get(meal?.recipeId);
  if (!recipe) {
    const raw = emptyRaw();
    return {
      ...publicResult(raw, { recipeId: meal?.recipeId ?? null }, {
        ...DEFAULT_PRECISION,
        ...options.precision,
      }),
      missingRecipeIds: meal?.recipeId ? [meal.recipeId] : [],
      complete: false,
    };
  }

  const raw = calculateRecipeRaw(recipe, ingredients, {
    servings: meal?.servings ?? 1,
    ingredientGrams: meal?.ingredientGrams,
  });
  return {
    ...publicResult(raw, { recipeId: recipe.id }, {
      ...DEFAULT_PRECISION,
      ...options.precision,
    }),
    missingRecipeIds: [],
  };
}

/**
 * Calculates all meals in a plan without summing already-rounded meal values.
 * The plan may be `{days:[{meals:[]}]}`, a day object, or a meal array.
 *
 * @param {object|Array} plan Plan, day, or array of meals.
 * @param {Array|Map|object} recipes Recipe catalogue or ID index.
 * @param {Array|Map|object} ingredients Ingredient catalogue or ID index.
 * @param {object} [options] Calculation options, including precision.
 * @returns {object} Rounded plan totals, cost, flags and missing IDs.
 */
export function calculatePlanNutrition(plan, recipes, ingredients, options = {}) {
  const recipeIndex = toIndex(recipes);
  const days = Array.isArray(plan)
    ? [{ meals: plan }]
    : Array.isArray(plan?.days)
      ? plan.days
      : [{ meals: plan?.meals ?? [] }];
  const raw = emptyRaw();
  const missingRecipeIds = new Set();
  let mealCount = 0;

  for (const day of days) {
    for (const meal of day?.meals ?? []) {
      const recipe = recipeIndex.get(meal?.recipeId);
      if (!recipe) {
        if (meal?.recipeId) missingRecipeIds.add(meal.recipeId);
        continue;
      }
      mealCount += 1;
      mergeRaw(
        raw,
        calculateRecipeRaw(recipe, ingredients, {
          servings: meal?.servings ?? 1,
          ingredientGrams: meal?.ingredientGrams,
        }),
      );
    }
  }

  const result = publicResult(raw, { mealCount }, {
    ...DEFAULT_PRECISION,
    ...options.precision,
  });
  result.missingRecipeIds = [...missingRecipeIds].sort();
  result.complete = result.complete && result.missingRecipeIds.length === 0;
  return result;
}

/**
 * Returns an ID-index Map for callers that repeatedly calculate catalogue data.
 *
 * @param {Array|Map|object} records Records to index.
 * @returns {Map} ID-indexed records.
 */
export function createNutritionIndex(records) {
  return toIndex(records);
}
