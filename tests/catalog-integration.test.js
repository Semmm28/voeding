import assert from 'node:assert/strict';
import test from 'node:test';

import { INGREDIENTS } from '../src/data/ingredients.js';
import { RECIPES } from '../src/data/recipes.js';
import { calculateRecipeNutrition } from '../src/engine/nutrition.js';
import { generateWeekPlan } from '../src/engine/planner.js';

const BASE_TARGETS = { kcal: 2200, protein: 150, carbs: 250, fat: 70 };

test('echte catalogus heeft brede dekking inclusief niet-vegetarische recepten', () => {
  assert.ok(INGREDIENTS.length >= 100);
  assert.ok(RECIPES.length >= 72);
  const nonVegetarian = RECIPES.filter((recipe) => (
    calculateRecipeNutrition(recipe, INGREDIENTS).flags.vegetarian === false
  ));
  assert.ok(nonVegetarian.length >= 25);
  for (const mealType of ['breakfast', 'lunch', 'dinner', 'snack']) {
    assert.ok(RECIPES.filter((recipe) => recipe.mealTypes.includes(mealType)).length >= 8);
  }
});

test('echte catalogus levert complete omnivore en vegetarische weekplannen', () => {
  for (const diet of ['all', 'vegetarian']) {
    const plan = generateWeekPlan({
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      days: 7,
      mealsPerDay: 4,
      targets: diet === 'all'
        ? BASE_TARGETS
        : { kcal: 2200, protein: 130, carbs: 260, fat: 70 },
      diet,
      maxPrepMinutes: 45,
      maxDailyBudget: 20,
      seed: `catalog-${diet}`,
    });
    assert.equal(plan.complete, true, `${diet} plan hoort compleet te zijn`);
    assert.equal(plan.summary.mealCount, 28);
    assert.equal(plan.warnings.filter((warning) => warning.severity === 'error').length, 0);
  }
});

test('vegan plan kan tegelijk melk en gluten uitsluiten', () => {
  const plan = generateWeekPlan({
    recipes: RECIPES,
    ingredients: INGREDIENTS,
    days: 3,
    mealsPerDay: 5,
    targets: { kcal: 2100, protein: 110, carbs: 260, fat: 65 },
    diet: 'vegan',
    excludedAllergens: ['melk', 'gluten'],
    maxPrepMinutes: 40,
    maxDailyBudget: 20,
    seed: 'catalog-vegan-glutenvrij',
  });
  assert.equal(plan.complete, true);
  assert.equal(plan.summary.mealCount, 15);
});

test('onhaalbaar laag budget geeft fouten in plaats van een misleidend plan', () => {
  const plan = generateWeekPlan({
    recipes: RECIPES,
    ingredients: INGREDIENTS,
    days: 1,
    mealsPerDay: 4,
    targets: BASE_TARGETS,
    maxDailyBudget: 0.5,
    seed: 'catalog-onhaalbaar',
  });
  assert.equal(plan.complete, false);
  assert.ok(plan.warnings.some((warning) => ['NO_CANDIDATES', 'BUDGET_INFEASIBLE'].includes(warning.code)));
});

