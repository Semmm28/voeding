import test from 'node:test';
import assert from 'node:assert/strict';

import { adjustMeal, generateWeekPlan, regenerateDay } from '../src/engine/planner.js';

function ingredient(id, {
  kcal = 200,
  protein = 20,
  carbs = 20,
  fat = 4,
  price = 1,
  allergens = [],
  vegan = true,
} = {}) {
  return {
    id,
    name: id,
    per100: { kcal, protein, carbs, fat, fiber: 3 },
    pricePer100g: price,
    allergens,
    flags: {
      vegetarian: vegan,
      vegan,
      lactoseFree: true,
      glutenFree: true,
    },
  };
}

function recipe(id, mealType, ingredientId, {
  prepMinutes = 10,
  grams = 100,
  adjustable = { min: 50, max: 200, step: 50 },
} = {}) {
  return {
    id,
    name: id,
    mealTypes: [mealType],
    servings: 1,
    prepMinutes,
    ingredients: [{ ingredientId, grams, role: 'protein', adjustable }],
  };
}

const ingredients = [
  ingredient('vegan-base'),
  ingredient('vegan-high-protein', { protein: 45, carbs: 4, price: 1.2 }),
  ingredient('cheap', { price: 0.3, protein: 15 }),
  ingredient('meat', { vegan: false, protein: 30 }),
  ingredient('peanut', { allergens: ['pinda'] }),
  ingredient('excluded'),
];

const recipes = [
  recipe('breakfast-a', 'breakfast', 'vegan-base', { prepMinutes: 8 }),
  recipe('breakfast-b', 'breakfast', 'vegan-high-protein', { prepMinutes: 6 }),
  recipe('breakfast-meat', 'breakfast', 'meat'),
  recipe('lunch-safe', 'lunch', 'cheap', { prepMinutes: 5 }),
  recipe('lunch-peanut', 'lunch', 'peanut'),
  recipe('lunch-excluded', 'lunch', 'excluded'),
  recipe('dinner-a', 'dinner', 'vegan-base', { prepMinutes: 9 }),
  recipe('dinner-b', 'dinner', 'vegan-high-protein', { prepMinutes: 7 }),
];

const baseOptions = {
  recipes,
  ingredients,
  days: 3,
  mealsPerDay: 3,
  targets: { kcal: 600, protein: 70, carbs: 50, fat: 12 },
  seed: 'vaste-seed',
};

test('dezelfde seed levert exact hetzelfde plan op', () => {
  const first = generateWeekPlan(baseOptions);
  const second = generateWeekPlan(baseOptions);
  assert.deepEqual(first, second);
  assert.equal(first.days.length, 3);
  assert.equal(first.days.every((day) => day.meals.length === 3), true);
});

test('past dieet-, allergenen-, ingrediënt-, tijd- en budgetfilters toe', () => {
  const plan = generateWeekPlan({
    ...baseOptions,
    days: 1,
    diet: 'vegan',
    excludedAllergens: ['pinda'],
    excludedIngredientIds: ['excluded'],
    maxPrepMinutes: 9,
    maxDailyBudget: 3.5,
  });
  const ids = plan.days[0].meals.map((meal) => meal.recipeId);

  assert.equal(ids.includes('breakfast-meat'), false);
  assert.equal(ids.includes('lunch-peanut'), false);
  assert.equal(ids.includes('lunch-excluded'), false);
  assert.equal(plan.summary.totalCost <= 3.5, true);
  assert.equal(plan.complete, true);
});

test('geeft duidelijke Nederlandse waarschuwingen bij lege kandidaten en grote afwijkingen', () => {
  const impossible = generateWeekPlan({
    recipes: [recipe('meat-breakfast', 'breakfast', 'meat')],
    ingredients,
    days: 1,
    mealsPerDay: 3,
    diet: 'vegan',
    targets: { kcal: 5000, protein: 300, carbs: 500, fat: 150 },
    seed: 'onhaalbaar',
  });

  assert.equal(impossible.complete, false);
  assert.equal(impossible.warnings.some((warning) => warning.code === 'NO_CANDIDATES'), true);
  assert.equal(impossible.warnings.some((warning) => warning.code === 'LARGE_TARGET_DEVIATION'), true);
  assert.equal(impossible.warnings.every((warning) => typeof warning.message === 'string'), true);
});

test('regenereert een dag deterministisch vanuit hetzelfde plan', () => {
  const plan = generateWeekPlan(baseOptions);
  const first = regenerateDay({ plan, dayIndex: 1, recipes, ingredients });
  const second = regenerateDay({ plan, dayIndex: 1, recipes, ingredients });
  assert.deepEqual(first, second);
  assert.equal(first.revision, 1);
  assert.deepEqual(first.days[0], plan.days[0]);
});

test('meer-eiwit verhoogt begrensd één aanpasbaar ingrediënt', () => {
  const localRecipes = [
    recipe('only-breakfast', 'breakfast', 'vegan-high-protein', {
      grams: 100,
      adjustable: { min: 50, max: 150, step: 50 },
    }),
    recipe('only-lunch', 'lunch', 'cheap'),
    recipe('only-dinner', 'dinner', 'vegan-base'),
  ];
  const plan = generateWeekPlan({ ...baseOptions, recipes: localRecipes, days: 1 });
  const adjusted = adjustMeal({
    plan,
    dayIndex: 0,
    mealIndex: 0,
    action: 'more-protein',
    recipes: localRecipes,
    ingredients,
  });

  assert.equal(adjusted.adjustment.changed, true);
  assert.equal(adjusted.days[0].meals[0].ingredientGrams['vegan-high-protein'], 150);
  assert.equal(
    adjusted.days[0].meals[0].nutrition.protein > plan.days[0].meals[0].nutrition.protein,
    true,
  );
});

test('replace vervangt een maaltijd zonder herhaallus', () => {
  const plan = generateWeekPlan({ ...baseOptions, days: 1 });
  const adjusted = adjustMeal({
    plan,
    dayIndex: 0,
    mealIndex: 0,
    action: 'replace',
    recipes,
    ingredients,
  });
  assert.equal(adjusted.adjustment.changed, true);
  assert.notEqual(adjusted.days[0].meals[0].recipeId, plan.days[0].meals[0].recipeId);
});

test('mislukte maaltijdactie blijft tijdelijke feedback en geen schemawaarschuwing', () => {
  const localRecipes = [
    recipe('only-breakfast', 'breakfast', 'vegan-high-protein', {
      prepMinutes: 5,
      grams: 100,
      adjustable: { min: 50, max: 100, step: 50 },
    }),
    recipe('only-lunch', 'lunch', 'cheap', { prepMinutes: 5 }),
    recipe('only-dinner', 'dinner', 'vegan-base', { prepMinutes: 5 }),
  ];
  const plan = generateWeekPlan({ ...baseOptions, recipes: localRecipes, days: 1 });

  for (const action of ['more-protein', 'faster']) {
    const adjusted = adjustMeal({
      plan,
      dayIndex: 0,
      mealIndex: 0,
      action,
      recipes: localRecipes,
      ingredients,
    });

    assert.equal(adjusted.adjustment.changed, false);
    assert.equal(adjusted.revision, plan.revision);
    assert.deepEqual(adjusted.days[0].meals[0], plan.days[0].meals[0]);
    assert.equal(
      adjusted.warnings.some((warning) => warning.code === 'NO_ADJUSTMENT_AVAILABLE'),
      false,
    );
  }
});
