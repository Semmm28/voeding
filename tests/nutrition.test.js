import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateMealNutrition,
  calculatePlanNutrition,
  calculateRecipeNutrition,
} from '../src/engine/nutrition.js';

const ingredients = [
  {
    id: 'oats',
    per100: { kcal: 370, protein: 13.2, carbs: 58.7, fat: 7, fiber: 10 },
    pricePer100g: 0.22,
    allergens: ['gluten'],
    flags: { vegetarian: true, vegan: true, lactoseFree: true, glutenFree: false },
  },
  {
    id: 'yoghurt',
    per100: { kcal: 50, protein: 4, carbs: 2.5, fat: 2, fiber: 0 },
    pricePer100g: 0.4,
    allergens: ['soja'],
    flags: { vegetarian: true, vegan: true, lactoseFree: true, glutenFree: true },
  },
];

const recipe = {
  id: 'oat-bowl',
  servings: 1,
  ingredients: [
    { ingredientId: 'oats', grams: 60 },
    { ingredientId: 'yoghurt', grams: 150 },
  ],
};

test('berekent receptwaarden dynamisch uit grammen en leidt labels af', () => {
  const result = calculateRecipeNutrition(recipe, ingredients);

  assert.deepEqual(result.totals, {
    kcal: 297,
    protein: 13.9,
    carbs: 39,
    fat: 7.2,
    fiber: 6,
  });
  assert.equal(result.cost, 0.73);
  assert.deepEqual(result.allergens, ['gluten', 'soja']);
  assert.deepEqual(result.flags, {
    vegetarian: true,
    vegan: true,
    lactoseFree: true,
    glutenFree: false,
  });
  assert.equal(result.complete, true);
});

test('past gramoverschrijvingen toe en meldt ontbrekende ingrediënten transparant', () => {
  const incomplete = {
    ...recipe,
    ingredients: [...recipe.ingredients, { ingredientId: 'unknown', grams: 50 }],
  };
  const result = calculateRecipeNutrition(incomplete, ingredients, {
    ingredientGrams: { oats: 100 },
  });

  assert.equal(result.totals.kcal, 445);
  assert.deepEqual(result.missingIngredientIds, ['unknown']);
  assert.equal(result.complete, false);
  assert.equal(result.flags.vegan, false);
});

test('rondt pas af nadat het volledige plan is opgeteld', () => {
  const tinyIngredient = [{
    id: 'tiny',
    per100: { kcal: 49, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    pricePer100g: 0,
    allergens: [],
    flags: { vegetarian: true, vegan: true, lactoseFree: true, glutenFree: true },
  }];
  const tinyRecipe = {
    id: 'tiny-recipe',
    servings: 1,
    ingredients: [{ ingredientId: 'tiny', grams: 1 }],
  };
  assert.equal(calculateRecipeNutrition(tinyRecipe, tinyIngredient).totals.kcal, 0);

  const plan = {
    days: [{
      meals: [{ recipeId: 'tiny-recipe' }, { recipeId: 'tiny-recipe' }],
    }],
  };
  assert.equal(calculatePlanNutrition(plan, [tinyRecipe], tinyIngredient).totals.kcal, 1);
});

test('meldt een ontbrekend recept in een maaltijd', () => {
  const result = calculateMealNutrition({ recipeId: 'missing' }, [recipe], ingredients);
  assert.deepEqual(result.missingRecipeIds, ['missing']);
  assert.equal(result.complete, false);
});

