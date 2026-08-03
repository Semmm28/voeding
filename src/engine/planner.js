import {
  NUTRIENT_KEYS,
  calculateMealNutrition,
  calculatePlanNutrition,
  calculateRecipeNutrition,
  createNutritionIndex,
} from './nutrition.js';

const MEAL_SLOTS = Object.freeze({
  3: [
    { slot: 'breakfast', mealType: 'breakfast' },
    { slot: 'lunch', mealType: 'lunch' },
    { slot: 'dinner', mealType: 'dinner' },
  ],
  4: [
    { slot: 'breakfast', mealType: 'breakfast' },
    { slot: 'lunch', mealType: 'lunch' },
    { slot: 'snack', mealType: 'snack' },
    { slot: 'dinner', mealType: 'dinner' },
  ],
  5: [
    { slot: 'breakfast', mealType: 'breakfast' },
    { slot: 'morning-snack', mealType: 'snack' },
    { slot: 'lunch', mealType: 'lunch' },
    { slot: 'afternoon-snack', mealType: 'snack' },
    { slot: 'dinner', mealType: 'dinner' },
  ],
});

const DEFAULT_TARGETS = Object.freeze({
  kcal: 2000,
  protein: 100,
  carbs: 250,
  fat: 67,
});

const SCORE_WEIGHTS = Object.freeze({
  kcal: 1,
  protein: 1.25,
  carbs: 0.7,
  fat: 0.8,
});

const DIET_FLAG_ALIASES = Object.freeze({
  vegetarian: 'vegetarian',
  vegetarisch: 'vegetarian',
  vegan: 'vegan',
  veganistisch: 'vegan',
  'lactose-free': 'lactoseFree',
  lactosefree: 'lactoseFree',
  lactosevrij: 'lactoseFree',
  'gluten-free': 'glutenFree',
  glutenfree: 'glutenFree',
  glutenvrij: 'glutenFree',
});

const SLOT_LABELS = Object.freeze({
  breakfast: 'ontbijt',
  lunch: 'lunch',
  dinner: 'avondeten',
  snack: 'tussendoortje',
});

const NUTRIENT_LABELS = Object.freeze({
  kcal: 'energie',
  protein: 'eiwit',
  carbs: 'koolhydraten',
  fat: 'vet',
});

const MAX_BEAM_STATES = 96;

function finite(value, fallback) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positive(value, fallback) {
  const number = finite(value, fallback);
  return number > 0 ? number : fallback;
}

function nonNegative(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = finite(value, fallback);
  return number >= 0 ? number : fallback;
}

function hashSeed(input) {
  const text = String(input ?? 'voeding');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableNoise(seed) {
  let value = hashSeed(seed);
  value += 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function normalizeStringList(value) {
  return [...new Set(
    (Array.isArray(value) ? value : value ? [value] : [])
      .filter((item) => typeof item === 'string' && item.trim())
      .map((item) => item.trim()),
  )];
}

function normalizeDietRequirements(diet, filters) {
  const requested = normalizeStringList(diet);
  const flags = new Set();
  for (const item of requested) {
    const normalized = item.toLowerCase().replaceAll('_', '-').replaceAll(' ', '-');
    if (normalized === 'omnivore' || normalized === 'alleseter' || normalized === 'none') {
      continue;
    }
    const flag = DIET_FLAG_ALIASES[normalized];
    if (flag) flags.add(flag);
  }
  if (filters.lactoseFree === true) flags.add('lactoseFree');
  if (filters.glutenFree === true) flags.add('glutenFree');
  return [...flags];
}

function normalizeConfig(input) {
  const settings = input.settings ?? {};
  const filters = { ...(settings.filters ?? {}), ...(input.filters ?? {}) };
  const days = finite(input.days ?? settings.days, 7);
  const mealsPerDay = finite(input.mealsPerDay ?? settings.mealsPerDay, 4);
  if (!Number.isInteger(days) || days < 1 || days > 7) {
    throw new RangeError('Het aantal dagen moet een geheel getal van 1 tot en met 7 zijn.');
  }
  if (![3, 4, 5].includes(mealsPerDay)) {
    throw new RangeError('Het aantal eetmomenten moet 3, 4 of 5 zijn.');
  }

  const suppliedTargets = {
    ...DEFAULT_TARGETS,
    ...(settings.targets ?? {}),
    ...(input.targets ?? {}),
  };
  suppliedTargets.kcal = input.targetKcal ?? settings.targetKcal ?? suppliedTargets.kcal;
  suppliedTargets.protein = input.targetProtein ?? settings.targetProtein ?? suppliedTargets.protein;
  suppliedTargets.carbs = input.targetCarbs ?? settings.targetCarbs ?? suppliedTargets.carbs;
  suppliedTargets.fat = input.targetFat ?? settings.targetFat ?? suppliedTargets.fat;
  const targets = Object.fromEntries(
    Object.keys(DEFAULT_TARGETS).map((key) => [
      key,
      nonNegative(suppliedTargets[key], DEFAULT_TARGETS[key]),
    ]),
  );
  const maxDailyBudget = nonNegative(
    input.maxDailyBudget
      ?? settings.maxDailyBudget
      ?? filters.maxDailyBudget
      ?? input.dailyBudget
      ?? settings.dailyBudget
      ?? input.budget
      ?? settings.budget,
    Infinity,
  );

  return {
    days,
    mealsPerDay,
    targets,
    seed: String(input.seed ?? settings.seed ?? 'voeding'),
    diet: input.diet ?? settings.diet ?? filters.diet ?? 'omnivore',
    dietRequirements: normalizeDietRequirements(
      input.diet ?? settings.diet ?? filters.diet ?? 'omnivore',
      filters,
    ),
    excludedAllergens: normalizeStringList(
      input.excludedAllergens
        ?? input.allergens
        ?? settings.excludedAllergens
        ?? settings.allergens
        ?? filters.excludedAllergens,
    ),
    excludedIngredientIds: normalizeStringList(
      input.excludedIngredientIds
        ?? settings.excludedIngredientIds
        ?? filters.excludedIngredientIds,
    ),
    maxPrepMinutes: nonNegative(
      input.maxPrepMinutes ?? settings.maxPrepMinutes ?? filters.maxPrepMinutes,
      Infinity,
    ),
    maxDailyBudget,
  };
}

function serializeConfig(config) {
  return {
    days: config.days,
    mealsPerDay: config.mealsPerDay,
    targets: { ...config.targets },
    seed: config.seed,
    diet: Array.isArray(config.diet) ? [...config.diet] : config.diet,
    excludedAllergens: [...config.excludedAllergens],
    excludedIngredientIds: [...config.excludedIngredientIds],
    maxPrepMinutes: Number.isFinite(config.maxPrepMinutes) ? config.maxPrepMinutes : null,
    maxDailyBudget: Number.isFinite(config.maxDailyBudget) ? config.maxDailyBudget : null,
    dietRequirements: [...config.dietRequirements],
  };
}

function configFromPlan(plan, overrides = {}) {
  const stored = plan?.config ?? {};
  return normalizeConfig({
    ...stored,
    ...overrides,
    days: overrides.days ?? stored.days ?? plan?.days?.length ?? 7,
    targets: { ...(stored.targets ?? {}), ...(overrides.targets ?? {}) },
    maxPrepMinutes: overrides.maxPrepMinutes ?? stored.maxPrepMinutes ?? Infinity,
    maxDailyBudget: overrides.maxDailyBudget ?? stored.maxDailyBudget ?? Infinity,
  });
}

function recipeCandidate(recipe, ingredients) {
  const nutrition = calculateRecipeNutrition(recipe, ingredients);
  return {
    recipe,
    totals: nutrition.totals,
    cost: nutrition.cost,
    allergens: nutrition.allergens,
    flags: nutrition.flags,
    complete: nutrition.complete,
    priceComplete: nutrition.missingPriceIngredientIds.length === 0,
    prepMinutes: Math.max(0, finite(recipe.prepMinutes, 0)),
  };
}

function isRecipeAllowed(candidate, config) {
  if (!candidate.complete) return false;
  if (Number.isFinite(config.maxDailyBudget) && !candidate.priceComplete) return false;
  if (candidate.prepMinutes > config.maxPrepMinutes) return false;
  if (candidate.cost > config.maxDailyBudget) return false;

  for (const requirement of config.dietRequirements) {
    if (candidate.flags[requirement] !== true) return false;
  }

  const allergens = new Set(candidate.allergens.map((item) => item.toLocaleLowerCase('nl')));
  if (config.excludedAllergens.some((item) => allergens.has(item.toLocaleLowerCase('nl')))) {
    return false;
  }

  const excludedIds = new Set(config.excludedIngredientIds);
  if (candidate.recipe.ingredients?.some((line) => excludedIds.has(line.ingredientId))) {
    return false;
  }
  return true;
}

function buildCandidatePool(recipes, ingredients, config) {
  return recipes
    .filter((recipe) => recipe && typeof recipe.id === 'string')
    .map((recipe) => recipeCandidate(recipe, ingredients))
    .filter((candidate) => isRecipeAllowed(candidate, config));
}

function candidatesForSlot(pool, mealType) {
  return pool.filter((candidate) => {
    const mealTypes = (candidate.recipe.mealTypes ?? []).map((item) => String(item).toLowerCase());
    return mealTypes.includes(mealType) || mealTypes.includes('any') || mealTypes.includes('all');
  });
}

function addTotals(left, right) {
  return Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [key, (left[key] ?? 0) + (right[key] ?? 0)]),
  );
}

function nutritionScore(totals, targets, fraction = 1) {
  let score = 0;
  for (const [nutrient, weight] of Object.entries(SCORE_WEIGHTS)) {
    const expected = targets[nutrient] * fraction;
    if (expected <= 0) continue;
    const relativeDifference = (totals[nutrient] - expected) / expected;
    score += weight * relativeDifference ** 2;
  }
  return score;
}

function makeMeal(candidate, slot) {
  return {
    slot: slot.slot,
    mealType: slot.mealType,
    recipeId: candidate.recipe.id,
    name: candidate.recipe.name,
    servings: 1,
    ingredientGrams: {},
    prepMinutes: candidate.prepMinutes,
    nutrition: { ...candidate.totals },
    cost: candidate.cost,
  };
}

function buildDay({
  dayIndex,
  slots,
  pool,
  config,
  usage,
  avoidRecipeIds = new Set(),
  seed,
}) {
  const warnings = [];
  let states = [{
    meals: [],
    totals: Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, 0])),
    cost: 0,
    variationPenalty: 0,
    score: 0,
  }];

  for (const [slotIndex, slot] of slots.entries()) {
    const candidates = candidatesForSlot(pool, slot.mealType);
    if (candidates.length === 0) {
      warnings.push({
        code: 'NO_CANDIDATES',
        severity: 'error',
        day: dayIndex + 1,
        slot: slot.slot,
        message: `Geen geschikt recept gevonden voor ${SLOT_LABELS[slot.mealType]} op dag ${dayIndex + 1} binnen je voorkeuren.`,
      });
      continue;
    }

    const expanded = [];
    for (const state of states) {
      for (const candidate of candidates) {
        const nextCost = state.cost + candidate.cost;
        if (nextCost > config.maxDailyBudget + Number.EPSILON) continue;
        const duplicateInDay = state.meals.some((meal) => meal.recipeId === candidate.recipe.id);
        const variationPenalty = state.variationPenalty
          + (usage.get(candidate.recipe.id) ?? 0) * 0.16
          + (duplicateInDay ? 1.25 : 0)
          + (avoidRecipeIds.has(candidate.recipe.id) ? 0.35 : 0);
        const totals = addTotals(state.totals, candidate.totals);
        const fraction = (slotIndex + 1) / slots.length;
        const tieBreak = stableNoise(
          `${seed}|${dayIndex}|${slot.slot}|${candidate.recipe.id}|${state.meals.map((m) => m.recipeId).join(',')}`,
        ) * 1e-8;
        expanded.push({
          meals: [...state.meals, makeMeal(candidate, slot)],
          totals,
          cost: nextCost,
          variationPenalty,
          score: nutritionScore(totals, config.targets, fraction) + variationPenalty + tieBreak,
        });
      }
    }

    if (expanded.length === 0) {
      warnings.push({
        code: 'BUDGET_INFEASIBLE',
        severity: 'error',
        day: dayIndex + 1,
        slot: slot.slot,
        message: `Het dagbudget is te laag om op dag ${dayIndex + 1} ook ${SLOT_LABELS[slot.mealType]} toe te voegen.`,
      });
      continue;
    }

    expanded.sort((a, b) => a.score - b.score);
    states = expanded.slice(0, MAX_BEAM_STATES);
  }

  states.sort((a, b) => (
    nutritionScore(a.totals, config.targets)
      + a.variationPenalty
      - (nutritionScore(b.totals, config.targets) + b.variationPenalty)
  ));
  const best = states[0];
  return {
    day: dayIndex + 1,
    meals: best?.meals ?? [],
    warnings,
  };
}

function averageTotals(totals, dayCount) {
  const divisor = Math.max(1, dayCount);
  return Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [key, Math.round((totals[key] / divisor) * 10) / 10]),
  );
}

function deviationWarnings(average, config) {
  const warnings = [];
  for (const nutrient of Object.keys(DEFAULT_TARGETS)) {
    const target = config.targets[nutrient];
    if (target <= 0) continue;
    const relative = (average[nutrient] - target) / target;
    const threshold = nutrient === 'kcal' ? 0.2 : 0.25;
    if (Math.abs(relative) < threshold) continue;
    const percent = Math.round(Math.abs(relative) * 100);
    const direction = relative < 0 ? 'onder' : 'boven';
    warnings.push({
      code: 'LARGE_TARGET_DEVIATION',
      severity: 'warning',
      nutrient,
      message: `Het gemiddelde voor ${NUTRIENT_LABELS[nutrient]} ligt ${percent}% ${direction} je dagdoel. Pas je doel, filters of maaltijden aan.`,
    });
  }
  return warnings;
}

function refreshPlan(plan, recipes, ingredients, plannerWarnings = []) {
  const config = configFromPlan(plan);
  const days = plan.days.map((day, index) => {
    const nutrition = calculatePlanNutrition({ days: [day] }, recipes, ingredients);
    return {
      ...day,
      day: day.day ?? index + 1,
      label: day.label ?? `Dag ${index + 1}`,
      totals: nutrition.totals,
      cost: nutrition.cost,
    };
  });
  const workingPlan = { ...plan, days };
  const nutrition = calculatePlanNutrition(workingPlan, recipes, ingredients);
  const dayCount = Math.max(1, days.length);
  const average = averageTotals(nutrition.totals, dayCount);
  const warnings = [...plannerWarnings, ...deviationWarnings(average, config)];

  if (nutrition.missingIngredientIds.length > 0 || nutrition.missingRecipeIds.length > 0) {
    warnings.push({
      code: 'MISSING_DATA',
      severity: 'error',
      message: 'Een of meer recepten of ingrediënten ontbreken. De getoonde totalen zijn daardoor onvolledig.',
    });
  }
  if (nutrition.missingPriceIngredientIds.length > 0) {
    warnings.push({
      code: 'MISSING_PRICES',
      severity: 'warning',
      message: 'Voor een of meer ingrediënten ontbreekt een prijs. Het berekende budget is daardoor onvolledig.',
    });
  }

  const expectedMeals = config.mealsPerDay * days.length;
  const actualMeals = days.reduce((sum, day) => sum + day.meals.length, 0);
  if (actualMeals < expectedMeals && !warnings.some((warning) => (
    warning.code === 'NO_CANDIDATES' || warning.code === 'BUDGET_INFEASIBLE'
  ))) {
    warnings.push({
      code: 'PLAN_INCOMPLETE',
      severity: 'error',
      message: 'Het schema is onvolledig omdat niet voor ieder eetmoment een passend recept beschikbaar is.',
    });
  }
  return {
    ...workingPlan,
    complete: nutrition.complete && actualMeals === expectedMeals,
    summary: {
      totals: nutrition.totals,
      averagePerDay: average,
      totalCost: nutrition.cost,
      averageDailyCost: Math.round((nutrition.cost / dayCount) * 100) / 100,
      targets: { ...config.targets },
      mealCount: nutrition.mealCount,
    },
    warnings,
  };
}

/**
 * Generates a deterministic local meal plan for one to seven days. The beam
 * search optimises energy, all requested macros and catalogue variation while
 * enforcing diet, allergen, ingredient, preparation-time and budget filters.
 *
 * @param {object} options
 * @param {object[]} options.recipes Recipe catalogue.
 * @param {object[]} options.ingredients Ingredient catalogue.
 * @param {number} [options.days=7] Integer from 1 through 7.
 * @param {3|4|5} [options.mealsPerDay=4] Number of daily eating moments.
 * @param {object} [options.targets] Daily kcal/protein/carbs/fat targets.
 * @param {string|string[]} [options.diet='omnivore'] Diet requirements.
 * @param {string[]} [options.excludedAllergens] Allergens to exclude.
 * @param {string[]} [options.excludedIngredientIds] Ingredient IDs to exclude.
 * @param {number} [options.maxPrepMinutes] Maximum preparation time per recipe.
 * @param {number} [options.maxDailyBudget] Hard daily budget ceiling.
 * @param {string|number} [options.seed='voeding'] Deterministic seed.
 * @returns {object} Plan with days, meals, totals, completion state and Dutch warnings.
 */
export function generateWeekPlan(options = {}) {
  const recipes = Array.isArray(options.recipes) ? options.recipes : [];
  const ingredients = createNutritionIndex(options.ingredients ?? []);
  const config = normalizeConfig(options);
  const pool = buildCandidatePool(recipes, ingredients, config);
  const slots = MEAL_SLOTS[config.mealsPerDay];
  const usage = new Map();
  const days = [];
  const warnings = [];

  for (let dayIndex = 0; dayIndex < config.days; dayIndex += 1) {
    const day = buildDay({
      dayIndex,
      slots,
      pool,
      config,
      usage,
      seed: config.seed,
    });
    days.push({ day: day.day, meals: day.meals });
    warnings.push(...day.warnings);
    for (const meal of day.meals) {
      usage.set(meal.recipeId, (usage.get(meal.recipeId) ?? 0) + 1);
    }
  }

  const basePlan = {
    id: `plan-${hashSeed(`${config.seed}|${config.days}|${config.mealsPerDay}`).toString(16)}`,
    seed: config.seed,
    revision: 0,
    config: serializeConfig(config),
    days,
  };
  return refreshPlan(basePlan, recipes, ingredients, warnings);
}

/**
 * Regenerates one zero-based day while preserving the rest of a plan. Each
 * subsequent call increments a revision so a new deterministic alternative is
 * selected without retry loops.
 *
 * @param {object} options
 * @param {object} options.plan Existing generated plan.
 * @param {number} options.dayIndex Zero-based day index.
 * @param {object[]} options.recipes Recipe catalogue.
 * @param {object[]} options.ingredients Ingredient catalogue.
 * @param {string|number} [options.seed] Optional replacement seed.
 * @returns {object} Updated plan.
 */
export function regenerateDay({ plan, dayIndex, recipes = [], ingredients = [], seed } = {}) {
  if (!plan || !Array.isArray(plan.days)) throw new TypeError('Een geldig plan is verplicht.');
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= plan.days.length) {
    throw new RangeError('De gekozen dag bestaat niet in dit plan.');
  }

  const config = configFromPlan(plan, seed === undefined ? {} : { seed: String(seed) });
  const ingredientIndex = createNutritionIndex(ingredients);
  const pool = buildCandidatePool(recipes, ingredientIndex, config);
  const usage = new Map();
  const avoidRecipeIds = new Set(plan.days[dayIndex].meals.map((meal) => meal.recipeId));
  for (const [index, day] of plan.days.entries()) {
    if (index === dayIndex) continue;
    for (const meal of day.meals) usage.set(meal.recipeId, (usage.get(meal.recipeId) ?? 0) + 1);
  }

  const revision = finite(plan.revision, 0) + 1;
  const rebuilt = buildDay({
    dayIndex,
    slots: MEAL_SLOTS[config.mealsPerDay],
    pool,
    config,
    usage,
    avoidRecipeIds,
    seed: `${config.seed}|regenerate|${revision}`,
  });
  const days = plan.days.map((day, index) => (
    index === dayIndex ? { day: rebuilt.day, meals: rebuilt.meals } : day
  ));
  const updated = {
    ...plan,
    seed: config.seed,
    revision,
    config: serializeConfig(config),
    days,
  };
  return refreshPlan(updated, recipes, ingredientIndex, rebuilt.warnings);
}

function replacementCandidates(pool, current, mealType) {
  return candidatesForSlot(pool, mealType).filter(
    (candidate) => candidate.recipe.id !== current.recipeId,
  );
}

function updateMealFromRecipe(candidate, current) {
  return {
    ...makeMeal(candidate, { slot: current.slot, mealType: current.mealType }),
  };
}

function increaseProtein(current, recipe, ingredientIndex) {
  const possible = (recipe.ingredients ?? []).map((line, index) => {
    const ingredient = ingredientIndex.get(line.ingredientId);
    const adjustable = line.adjustable;
    const currentGrams = finite(current.ingredientGrams?.[line.ingredientId], line.grams);
    const maximum = finite(adjustable?.max, currentGrams);
    const step = positive(adjustable?.step, 0);
    return {
      line,
      index,
      currentGrams,
      maximum,
      step,
      proteinDensity: finite(ingredient?.per100?.protein, 0),
      kcalDensity: positive(ingredient?.per100?.kcal, 1),
    };
  }).filter((item) => (
    item.step > 0
    && item.currentGrams < item.maximum
    && item.proteinDensity > 0
  ));

  possible.sort((a, b) => (
    (b.proteinDensity / b.kcalDensity) - (a.proteinDensity / a.kcalDensity)
  ));
  const chosen = possible[0];
  if (!chosen) return null;
  const nextGrams = Math.min(chosen.maximum, chosen.currentGrams + chosen.step);
  return {
    ...current,
    ingredientGrams: {
      ...(current.ingredientGrams ?? {}),
      [chosen.line.ingredientId]: nextGrams,
    },
  };
}

function refreshMeal(meal, recipes, ingredients) {
  const recipeIndex = createNutritionIndex(recipes);
  const recipe = recipeIndex.get(meal.recipeId);
  const calculated = calculateMealNutrition(meal, recipeIndex, ingredients);
  return {
    ...meal,
    name: recipe?.name ?? meal.name,
    prepMinutes: Math.max(0, finite(recipe?.prepMinutes, meal.prepMinutes ?? 0)),
    nutrition: calculated.totals,
    cost: calculated.cost,
  };
}

/**
 * Adjusts one meal with `more-protein`, `cheaper`, `faster`, or `replace`.
 * The function changes at most one ingredient or one recipe and always exits
 * after a finite catalogue pass.
 *
 * @param {object} options
 * @param {object} options.plan Existing plan.
 * @param {number} options.dayIndex Zero-based day index.
 * @param {number} options.mealIndex Zero-based meal index.
 * @param {'more-protein'|'cheaper'|'faster'|'replace'} options.action Action.
 * @param {object[]} options.recipes Recipe catalogue.
 * @param {object[]} options.ingredients Ingredient catalogue.
 * @param {string|number} [options.seed] Optional deterministic replacement seed.
 * @returns {object} Updated plan with an `adjustment` result.
 */
export function adjustMeal({
  plan,
  dayIndex,
  mealIndex,
  action,
  recipes = [],
  ingredients = [],
  seed,
} = {}) {
  const allowedActions = new Set(['more-protein', 'cheaper', 'faster', 'replace']);
  if (!allowedActions.has(action)) throw new RangeError('Onbekende maaltijdaanpassing.');
  if (!plan?.days?.[dayIndex]?.meals?.[mealIndex]) {
    throw new RangeError('De gekozen maaltijd bestaat niet in dit plan.');
  }

  const config = configFromPlan(plan, seed === undefined ? {} : { seed: String(seed) });
  const ingredientIndex = createNutritionIndex(ingredients);
  const recipeIndex = createNutritionIndex(recipes);
  const pool = buildCandidatePool(recipes, ingredientIndex, config);
  const current = plan.days[dayIndex].meals[mealIndex];
  const currentRecipe = recipeIndex.get(current.recipeId);
  const currentNutrition = calculateMealNutrition(current, recipeIndex, ingredientIndex);
  const dayNutrition = calculatePlanNutrition(
    { days: [plan.days[dayIndex]] },
    recipeIndex,
    ingredientIndex,
  );
  const remainingMealBudget = config.maxDailyBudget - (dayNutrition.cost - currentNutrition.cost);
  const alternatives = replacementCandidates(pool, current, current.mealType)
    .filter((candidate) => candidate.cost <= remainingMealBudget + Number.EPSILON);
  let nextMeal = null;

  if (action === 'more-protein' && currentRecipe) {
    nextMeal = increaseProtein(current, currentRecipe, ingredientIndex);
    if (nextMeal) {
      const increased = calculateMealNutrition(nextMeal, recipeIndex, ingredientIndex);
      if (increased.cost > remainingMealBudget + Number.EPSILON) nextMeal = null;
    }
    if (!nextMeal) {
      const currentProtein = currentNutrition.totals.protein;
      alternatives.sort((a, b) => (
        b.totals.protein - a.totals.protein
        || nutritionScore(a.totals, config.targets, 1 / config.mealsPerDay)
          - nutritionScore(b.totals, config.targets, 1 / config.mealsPerDay)
      ));
      const candidate = alternatives.find((item) => item.totals.protein > currentProtein);
      if (candidate) nextMeal = updateMealFromRecipe(candidate, current);
    }
  }

  if (action === 'cheaper') {
    alternatives.sort((a, b) => a.cost - b.cost || a.recipe.id.localeCompare(b.recipe.id));
    const candidate = alternatives.find((item) => item.cost < currentNutrition.cost - 0.005);
    if (candidate) nextMeal = updateMealFromRecipe(candidate, current);
  }

  if (action === 'faster') {
    alternatives.sort((a, b) => a.prepMinutes - b.prepMinutes || a.recipe.id.localeCompare(b.recipe.id));
    const currentPrepMinutes = Math.max(0, finite(currentRecipe?.prepMinutes, current.prepMinutes ?? 0));
    const candidate = alternatives.find((item) => item.prepMinutes < currentPrepMinutes);
    if (candidate) nextMeal = updateMealFromRecipe(candidate, current);
  }

  if (action === 'replace' && alternatives.length > 0) {
    alternatives.sort((a, b) => {
      const scoreDifference = nutritionScore(a.totals, config.targets, 1 / config.mealsPerDay)
        - nutritionScore(b.totals, config.targets, 1 / config.mealsPerDay);
      if (Math.abs(scoreDifference) > 1e-12) return scoreDifference;
      return stableNoise(`${config.seed}|${plan.revision}|${dayIndex}|${mealIndex}|${a.recipe.id}`)
        - stableNoise(`${config.seed}|${plan.revision}|${dayIndex}|${mealIndex}|${b.recipe.id}`);
    });
    nextMeal = updateMealFromRecipe(alternatives[0], current);
  }

  const changed = Boolean(nextMeal);
  const adjustmentWarning = changed ? [] : [{
    code: 'NO_ADJUSTMENT_AVAILABLE',
    severity: 'info',
    day: dayIndex + 1,
    slot: current.slot,
    message: 'Binnen je huidige voorkeuren is voor deze actie geen betere aanpassing beschikbaar.',
  }];
  const days = plan.days.map((day, currentDayIndex) => {
    if (currentDayIndex !== dayIndex) return day;
    return {
      ...day,
      meals: day.meals.map((meal, currentMealIndex) => (
        currentMealIndex === mealIndex
          ? refreshMeal(nextMeal ?? meal, recipeIndex, ingredientIndex)
          : meal
      )),
    };
  });
  const updated = refreshPlan({
    ...plan,
    revision: finite(plan.revision, 0) + (changed ? 1 : 0),
    days,
  }, recipeIndex, ingredientIndex, adjustmentWarning);
  updated.adjustment = { action, changed, dayIndex, mealIndex };
  return updated;
}
