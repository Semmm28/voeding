import { INGREDIENTS } from '../src/data/ingredients.js';
import { RECIPES } from '../src/data/recipes.js';

const errors = [];
const warnings = [];
const ingredientIds = new Set();
const recipeIds = new Set();
const requiredMacros = ['kcal', 'protein', 'carbs', 'fat', 'fiber'];
const requiredFlags = ['vegetarian', 'vegan', 'lactoseFree', 'glutenFree'];

function requireCondition(condition, message) {
  if (!condition) errors.push(message);
}

for (const ingredient of INGREDIENTS) {
  requireCondition(typeof ingredient.id === 'string' && ingredient.id.length > 1,
    'Ingrediënt zonder geldige id.');
  requireCondition(!ingredientIds.has(ingredient.id),
    `Dubbele ingrediënt-id: ${ingredient.id}`);
  ingredientIds.add(ingredient.id);

  requireCondition(typeof ingredient.name === 'string' && ingredient.name.trim(),
    `Ingrediënt ${ingredient.id} mist een naam.`);
  requireCondition(Number.isFinite(ingredient.pricePer100g) && ingredient.pricePer100g >= 0,
    `Ingrediënt ${ingredient.id} heeft een ongeldige prijsindicatie.`);

  for (const macro of requiredMacros) {
    requireCondition(Number.isFinite(ingredient.per100?.[macro]) && ingredient.per100[macro] >= 0,
      `Ingrediënt ${ingredient.id} heeft een ongeldige waarde voor ${macro}.`);
  }
  for (const flag of requiredFlags) {
    requireCondition(typeof ingredient.flags?.[flag] === 'boolean',
      `Ingrediënt ${ingredient.id} mist boolean flag ${flag}.`);
  }
  requireCondition(Array.isArray(ingredient.allergens),
    `Ingrediënt ${ingredient.id} mist allergenenlijst.`);
  requireCondition(typeof ingredient.source?.status === 'string',
    `Ingrediënt ${ingredient.id} mist bronstatus.`);

  const macroEnergy = (ingredient.per100?.protein ?? 0) * 4
    + (ingredient.per100?.carbs ?? 0) * 4
    + (ingredient.per100?.fat ?? 0) * 9
    + (ingredient.per100?.fiber ?? 0) * 2;
  const statedEnergy = ingredient.per100?.kcal ?? 0;
  if (statedEnergy > 30 && Math.abs(macroEnergy - statedEnergy) / statedEnergy > 0.35) {
    warnings.push(`${ingredient.id}: energie wijkt >35% af van de macrocontrole; bron handmatig controleren.`);
  }
}

for (const ingredient of INGREDIENTS) {
  for (const substituteId of ingredient.substitutions ?? []) {
    requireCondition(ingredientIds.has(substituteId),
      `Ingrediënt ${ingredient.id} verwijst naar onbekende vervanger ${substituteId}.`);
  }
}

for (const recipe of RECIPES) {
  requireCondition(typeof recipe.id === 'string' && recipe.id.length > 1,
    'Recept zonder geldige id.');
  requireCondition(!recipeIds.has(recipe.id), `Dubbele recept-id: ${recipe.id}`);
  recipeIds.add(recipe.id);
  requireCondition(typeof recipe.name === 'string' && recipe.name.trim(),
    `Recept ${recipe.id} mist een naam.`);
  requireCondition(Array.isArray(recipe.mealTypes) && recipe.mealTypes.length > 0,
    `Recept ${recipe.id} mist maaltijdsoort.`);
  requireCondition(Number.isFinite(recipe.prepMinutes) && recipe.prepMinutes > 0,
    `Recept ${recipe.id} heeft ongeldige bereidingstijd.`);
  requireCondition(Array.isArray(recipe.instructions) && recipe.instructions.length > 0,
    `Recept ${recipe.id} mist bereidingsstappen.`);
  requireCondition(Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0,
    `Recept ${recipe.id} mist ingrediënten.`);

  for (const item of recipe.ingredients ?? []) {
    requireCondition(ingredientIds.has(item.ingredientId),
      `Recept ${recipe.id} verwijst naar onbekend ingrediënt ${item.ingredientId}.`);
    requireCondition(Number.isFinite(item.grams) && item.grams > 0,
      `Recept ${recipe.id} heeft ongeldige hoeveelheid voor ${item.ingredientId}.`);
    const adjustable = item.adjustable;
    if (adjustable) {
      requireCondition(
        Number.isFinite(adjustable.min)
          && Number.isFinite(adjustable.max)
          && Number.isFinite(adjustable.step)
          && adjustable.min >= 0
          && adjustable.min <= item.grams
          && adjustable.max >= item.grams
          && adjustable.step > 0,
        `Recept ${recipe.id} heeft ongeldige portiegrenzen voor ${item.ingredientId}.`,
      );
    }
  }
}

const mealCoverage = RECIPES.reduce((coverage, recipe) => {
  for (const mealType of recipe.mealTypes) {
    coverage[mealType] ??= [];
    coverage[mealType].push(recipe.id);
  }
  return coverage;
}, {});

for (const mealType of ['breakfast', 'lunch', 'dinner', 'snack']) {
  const count = mealCoverage[mealType]?.length ?? 0;
  requireCondition(count >= 8, `Te weinig recepten voor ${mealType}: ${count} (minimum 8).`);
}

if (errors.length) {
  console.error(`Datavalidatie mislukt met ${errors.length} fout(en):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Datavalidatie geslaagd: ${INGREDIENTS.length} ingrediënten en ${RECIPES.length} recepten.`);
}

if (warnings.length) {
  console.warn(`${warnings.length} voedingswaarde-waarschuwing(en):`);
  for (const warning of warnings.slice(0, 20)) console.warn(`- ${warning}`);
  if (warnings.length > 20) console.warn(`- … en nog ${warnings.length - 20}.`);
}
