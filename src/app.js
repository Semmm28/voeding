import { INGREDIENTS } from './data/ingredients.js';
import { RECIPES } from './data/recipes.js';
import {
  calculatePlanNutrition,
  calculateRecipeNutrition,
} from './engine/nutrition.js';
import { adjustMeal, generateWeekPlan } from './engine/planner.js';
import { exportBackup, importBackup } from './storage/backup.js';
import { openDatabase, STORE_NAMES } from './storage/db.js';
import {
  planWarningViewModels,
  renderPlan,
  renderPlanStatus,
  renderRecipeDetails,
  renderRecipes,
  renderShoppingList,
  renderWarnings,
  setPlanDayExpanded,
  setActiveView,
  setConnectionStatus,
  showToast,
  UI_ACTIONS,
} from './ui/render.js';

const DEFAULT_SETTINGS = Object.freeze({
  targets: Object.freeze({ kcal: 2200, protein: 150, carbs: 250, fat: 70 }),
  days: 7,
  mealsPerDay: 4,
  diet: 'all',
  excludedAllergens: Object.freeze([]),
  excludedIngredientTerms: Object.freeze([]),
  excludedIngredientIds: Object.freeze([]),
  maxPrepMinutes: 45,
  maxDailyBudget: null,
});

const MEMORY_STORES = Object.fromEntries(
  Object.values(STORE_NAMES).map((storeName) => [storeName, []]),
);
const NUTRIENTS = ['kcal', 'protein', 'carbs', 'fat', 'fiber'];

const state = {
  database: null,
  settings: clone(DEFAULT_SETTINGS),
  ingredients: [...INGREDIENTS],
  recipes: [...RECIPES],
  ingredientIndex: new Map(),
  recipeIndex: new Map(),
  plan: null,
  planIsStale: false,
  shoppingChecked: new Set(),
  shoppingHidden: new Set(),
  expandedDayIds: new Set(),
  deferredInstallPrompt: null,
};

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function rebuildIndexes() {
  state.ingredientIndex = new Map(state.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  state.recipeIndex = new Map(state.recipes.map((recipe) => [recipe.id, recipe]));
}

function randomSeed() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function sumNutrition(meals) {
  const totals = Object.fromEntries(NUTRIENTS.map((key) => [key, 0]));
  for (const meal of meals) {
    for (const key of NUTRIENTS) totals[key] += Number(meal.nutrition?.[key]) || 0;
  }
  return Object.fromEntries(
    NUTRIENTS.map((key) => [key, Math.round(totals[key] * (key === 'kcal' ? 1 : 10)) / (key === 'kcal' ? 1 : 10)]),
  );
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateForDay(dayIndex, startDate) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(startDate ?? '')
    ? new Date(`${startDate}T12:00:00`)
    : new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + dayIndex);
  return localDateString(date);
}

function renderablePlan(plan) {
  if (!plan) return { days: [] };
  return {
    ...plan,
    days: plan.days.map((day, dayIndex) => ({
      ...day,
      id: `day-${dayIndex}`,
      label: `Dag ${dayIndex + 1}`,
      date: dateForDay(dayIndex, plan.startDate),
      totals: sumNutrition(day.meals),
      meals: day.meals.map((meal, mealIndex) => ({
        ...meal,
        id: `meal-${dayIndex}-${mealIndex}`,
      })),
    })),
  };
}

function macroConsistencyWarning(settings) {
  const { kcal, protein, carbs, fat } = settings.targets;
  const macroKcal = protein * 4 + carbs * 4 + fat * 9;
  const difference = Math.abs(macroKcal - kcal);
  if (difference < 150 || difference / kcal < 0.12) return null;
  return {
    type: 'warning',
    title: 'Doelen zijn niet volledig consistent',
    message: `Je macrodoelen leveren samen ongeveer ${Math.round(macroKcal)} kcal, terwijl je energiedoel ${Math.round(kcal)} kcal is. Daardoor kan de planner niet alle doelen tegelijk exact benaderen.`,
  };
}

function renderCurrentPlan() {
  if (!state.plan) {
    renderPlan('#plan-results', { days: [] });
    renderWarnings('#plan-warnings', []);
    renderPlanStatus('#plan-status', {
      type: 'info',
      title: 'Nog geen schema',
      message: 'Controleer je doelen bij Instellingen en genereer daarna je schema.',
    });
    document.querySelector('#regenerate-plan').hidden = true;
    renderCurrentShoppingList();
    return;
  }

  renderPlan('#plan-results', renderablePlan(state.plan), {
    expandedDayIds: state.expandedDayIds,
  });
  const extraWarning = macroConsistencyWarning(state.settings);
  renderWarnings('#plan-warnings', [
    ...planWarningViewModels(state.plan.warnings),
    ...(extraWarning ? [extraWarning] : []),
  ]);
  document.querySelector('#regenerate-plan').hidden = false;

  if (state.planIsStale) {
    renderPlanStatus('#plan-status', {
      type: 'warning',
      title: 'Instellingen gewijzigd',
      message: 'Dit schema gebruikt je vorige instellingen. Genereer het opnieuw om de wijzigingen toe te passen.',
    });
  } else if (state.plan.complete) {
    const average = state.plan.summary.averagePerDay;
    renderPlanStatus('#plan-status', {
      type: 'success',
      title: 'Schema is berekend',
      message: `Gemiddeld ${Math.round(average.kcal)} kcal en ${Math.round(average.protein)} g eiwit per dag. Geschatte dagkosten: €${state.plan.summary.averageDailyCost.toFixed(2).replace('.', ',')}.`,
    });
  } else {
    renderPlanStatus('#plan-status', {
      type: 'warning',
      title: 'Schema is niet volledig haalbaar',
      message: 'Bekijk de meldingen en verruim zo nodig je budget, tijdslimiet, doelen of uitsluitingen.',
    });
  }
  renderCurrentShoppingList();
}

function recipeViewModels() {
  return state.recipes.map((recipe) => {
    const calculated = calculateRecipeNutrition(recipe, state.ingredientIndex);
    const ingredientNames = recipe.ingredients
      .map((line) => state.ingredientIndex.get(line.ingredientId)?.name)
      .filter(Boolean);
    const derivedTags = [
      ...(recipe.tags ?? []),
      ...(calculated.flags.vegan ? ['vegan'] : calculated.flags.vegetarian ? ['vegetarian'] : []),
      ...(calculated.flags.lactoseFree ? ['lactoseFree'] : []),
    ];
    return {
      ...recipe,
      mealType: recipe.mealTypes?.[0],
      nutrition: calculated.totals,
      cost: calculated.cost,
      flags: calculated.flags,
      tags: [...new Set(derivedTags)],
      ingredientNames,
      searchText: normalizeText([recipe.name, ...ingredientNames, ...derivedTags].join(' ')),
    };
  });
}

function renderFilteredRecipes() {
  const query = normalizeText(document.querySelector('#recipe-search')?.value);
  const mealType = document.querySelector('#recipe-meal-filter')?.value ?? 'all';
  const diet = document.querySelector('#recipe-diet-filter')?.value ?? 'all';
  const filtered = recipeViewModels().filter((recipe) => {
    if (query && !recipe.searchText.includes(query)) return false;
    if (mealType !== 'all' && !recipe.mealTypes.includes(mealType)) return false;
    if (diet !== 'all' && recipe.flags[diet] !== true) return false;
    return true;
  });
  renderRecipes('#recipe-results', filtered);
}

function aggregateShoppingList() {
  if (!state.plan) return [];
  const totals = new Map();
  for (const day of state.plan.days) {
    for (const meal of day.meals) {
      const recipe = state.recipeIndex.get(meal.recipeId);
      if (!recipe) continue;
      const servings = Number(meal.servings) || 1;
      for (const line of recipe.ingredients) {
        const ingredient = state.ingredientIndex.get(line.ingredientId);
        if (!ingredient) continue;
        const grams = Number(meal.ingredientGrams?.[line.ingredientId] ?? line.grams) * servings;
        const current = totals.get(ingredient.id) ?? {
          id: ingredient.id,
          name: ingredient.name,
          category: ingredient.category,
          amount: 0,
          unit: 'g',
        };
        current.amount += grams;
        totals.set(ingredient.id, current);
      }
    }
  }
  return [...totals.values()]
    .filter((item) => !state.shoppingHidden.has(item.id))
    .map((item) => {
      if (item.amount >= 1000) {
        return {
          ...item,
          amount: Math.round(item.amount / 10) / 100,
          unit: 'kg',
          checked: state.shoppingChecked.has(item.id),
        };
      }
      return {
        ...item,
        amount: Math.round(item.amount),
        checked: state.shoppingChecked.has(item.id),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'nl'));
}

function renderCurrentShoppingList() {
  renderShoppingList('#shopping-list', aggregateShoppingList());
}

function parseExcludedIngredients(terms) {
  const byNormalizedName = new Map();
  for (const ingredient of state.ingredients) {
    byNormalizedName.set(normalizeText(ingredient.name), ingredient.id);
    byNormalizedName.set(normalizeText(ingredient.id), ingredient.id);
  }
  const ids = [];
  const unknown = [];
  for (const term of terms) {
    const id = byNormalizedName.get(normalizeText(term));
    if (id) ids.push(id);
    else if (term.trim()) unknown.push(term.trim());
  }
  return { ids: [...new Set(ids)], unknown };
}

function readSettingsForm() {
  const form = document.querySelector('#settings-form');
  if (!form.reportValidity()) throw new Error('Controleer de gemarkeerde instellingen.');
  const data = new FormData(form);
  const excludedIngredientTerms = String(data.get('excludedIngredients') ?? '')
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean);
  const parsedExclusions = parseExcludedIngredients(excludedIngredientTerms);
  const budgetInput = String(data.get('dailyBudget') ?? '').trim();
  return {
    settings: {
      targets: {
        kcal: Number(data.get('targetKcal')),
        protein: Number(data.get('targetProtein')),
        carbs: Number(data.get('targetCarbs')),
        fat: Number(data.get('targetFat')),
      },
      days: Number(data.get('days')),
      mealsPerDay: Number(data.get('mealsPerDay')),
      diet: String(data.get('diet') ?? 'all'),
      excludedAllergens: data.getAll('allergens').map(String),
      excludedIngredientTerms,
      excludedIngredientIds: parsedExclusions.ids,
      maxPrepMinutes: Number(data.get('maxPrepMinutes')),
      maxDailyBudget: budgetInput ? Number(budgetInput) : null,
    },
    unknownExclusions: parsedExclusions.unknown,
  };
}

function writeSettingsForm(settings) {
  const form = document.querySelector('#settings-form');
  form.elements.targetKcal.value = settings.targets.kcal;
  form.elements.targetProtein.value = settings.targets.protein;
  form.elements.targetCarbs.value = settings.targets.carbs;
  form.elements.targetFat.value = settings.targets.fat;
  form.elements.days.value = String(settings.days);
  form.elements.mealsPerDay.value = String(settings.mealsPerDay);
  form.elements.diet.value = settings.diet;
  form.elements.maxPrepMinutes.value = settings.maxPrepMinutes;
  form.elements.dailyBudget.value = settings.maxDailyBudget ?? '';
  form.elements.excludedIngredients.value = (settings.excludedIngredientTerms ?? []).join(', ');
  for (const checkbox of form.querySelectorAll('input[name="allergens"]')) {
    checkbox.checked = settings.excludedAllergens.includes(checkbox.value);
  }
}

async function getAll(storeName) {
  if (state.database) return state.database.getAll(storeName);
  return clone(MEMORY_STORES[storeName]);
}

async function put(storeName, record) {
  if (state.database) return state.database.put(storeName, record);
  const keyName = [STORE_NAMES.settings, STORE_NAMES.meta].includes(storeName) ? 'key' : 'id';
  const index = MEMORY_STORES[storeName].findIndex((item) => item[keyName] === record[keyName]);
  if (index >= 0) MEMORY_STORES[storeName][index] = clone(record);
  else MEMORY_STORES[storeName].push(clone(record));
  return record[keyName];
}

async function persistSettings() {
  if (state.database) return state.database.saveSettings(state.settings);
  return put(STORE_NAMES.settings, {
    key: 'profile',
    value: clone(state.settings),
    updatedAt: new Date().toISOString(),
  });
}

async function persistPlan() {
  if (!state.plan) return;
  const storedPlan = { ...clone(state.plan), updatedAt: new Date().toISOString() };
  state.plan = storedPlan;
  if (state.database) {
    await state.database.savePlan(storedPlan);
    const plans = await state.database.getAll(STORE_NAMES.plans);
    plans.sort((left, right) => String(right.updatedAt ?? '').localeCompare(String(left.updatedAt ?? '')));
    await Promise.all(plans.slice(10).map((plan) => state.database.delete(STORE_NAMES.plans, plan.id)));
  } else {
    await put(STORE_NAMES.plans, storedPlan);
    MEMORY_STORES[STORE_NAMES.plans].sort(
      (left, right) => String(right.updatedAt ?? '').localeCompare(String(left.updatedAt ?? '')),
    );
    MEMORY_STORES[STORE_NAMES.plans] = MEMORY_STORES[STORE_NAMES.plans].slice(0, 10);
  }
}

async function persistShoppingState() {
  await put(STORE_NAMES.meta, {
    key: 'shoppingState',
    value: {
      checked: [...state.shoppingChecked],
      hidden: [...state.shoppingHidden],
    },
    updatedAt: new Date().toISOString(),
  });
}

function resetShoppingState() {
  state.shoppingChecked.clear();
  state.shoppingHidden.clear();
}

async function generatePlan({ regenerate = false } = {}) {
  const { settings, unknownExclusions } = readSettingsForm();
  state.settings = settings;
  await persistSettings();
  const generatedPlan = generateWeekPlan({
    recipes: state.recipes,
    ingredients: state.ingredients,
    ...settings,
    seed: regenerate ? randomSeed() : state.plan?.seed ?? randomSeed(),
  });
  state.plan = {
    ...generatedPlan,
    startDate: state.plan?.startDate ?? localDateString(),
    createdAt: new Date().toISOString(),
  };
  state.planIsStale = false;
  resetShoppingState();
  state.expandedDayIds.clear();
  await Promise.all([persistPlan(), persistShoppingState()]);
  renderCurrentPlan();
  setActiveView('planner');
  window.location.hash = 'planner';
  if (unknownExclusions.length) {
    showToast(`Niet herkend en daarom niet uitgesloten: ${unknownExclusions.join(', ')}`, { type: 'warning', duration: 6500 });
  } else {
    showToast(regenerate ? 'Nieuw schema gegenereerd.' : 'Schema gegenereerd.', { type: 'success' });
  }
}

async function handleMealAdjustment(button) {
  if (!state.plan) return;
  const dayIndex = Number(button.dataset.dayIndex);
  const mealIndex = Number(button.dataset.mealIndex);
  const action = button.dataset.action;
  const restoreFocus = document.activeElement === button;
  state.plan = adjustMeal({
    plan: state.plan,
    dayIndex,
    mealIndex,
    action,
    recipes: state.recipes,
    ingredients: state.ingredients,
    seed: randomSeed(),
  });
  state.planIsStale = false;
  resetShoppingState();
  await Promise.all([persistPlan(), persistShoppingState()]);
  renderCurrentPlan();
  if (restoreFocus) {
    const replacementButton = [...document.querySelectorAll('.meal-action')].find((candidate) => (
      candidate.dataset.action === action
      && Number(candidate.dataset.dayIndex) === dayIndex
      && Number(candidate.dataset.mealIndex) === mealIndex
    ));
    replacementButton?.focus({ preventScroll: true });
  }
  const changed = state.plan.adjustment?.changed;
  showToast(changed ? 'Maaltijd aangepast.' : 'Geen betere optie gevonden binnen je huidige voorkeuren.', {
    type: changed ? 'success' : 'info',
  });
}

function toggleDay(control) {
  const dayId = control.dataset.dayId;
  if (!dayId) return;
  const expanded = !state.expandedDayIds.has(dayId);
  if (expanded) state.expandedDayIds.add(dayId);
  else state.expandedDayIds.delete(dayId);
  setPlanDayExpanded(control, expanded);
}

function showRecipeDetails(recipeId, context = {}) {
  const recipe = state.recipeIndex.get(recipeId);
  if (!recipe) return;
  const dayIndex = Number(context.dayIndex);
  const mealIndex = Number(context.mealIndex);
  const plannedMeal = Number.isInteger(dayIndex) && Number.isInteger(mealIndex)
    ? state.plan?.days?.[dayIndex]?.meals?.[mealIndex]
    : null;
  const matchingMeal = plannedMeal?.recipeId === recipeId ? plannedMeal : null;
  const calculated = calculateRecipeNutrition(recipe, state.ingredientIndex);
  renderRecipeDetails('#recipe-dialog-content', {
    ...recipe,
    servings: matchingMeal?.servings ?? recipe.servings,
    nutrition: matchingMeal?.nutrition ?? calculated.totals,
    cost: matchingMeal?.cost ?? calculated.cost,
    allergens: calculated.allergens,
    ingredients: recipe.ingredients.map((line) => ({
      ...line,
      grams: matchingMeal?.ingredientGrams?.[line.ingredientId] ?? line.grams,
      name: state.ingredientIndex.get(line.ingredientId)?.name ?? line.ingredientId,
    })),
  });
  const dialog = document.querySelector('#recipe-dialog');
  if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
}

async function exportUserBackup() {
  const data = state.database
    ? await state.database.exportData()
    : Object.fromEntries(Object.entries(MEMORY_STORES).map(([key, value]) => [key, clone(value)]));
  const json = exportBackup(data);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `voeding-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('Back-up geëxporteerd.', { type: 'success' });
}

async function importUserBackup(file) {
  if (!file) return;
  const parsed = importBackup(await file.text());
  if (state.database) {
    await state.database.importData(parsed.data, { mode: 'replace' });
  } else {
    for (const storeName of Object.values(STORE_NAMES)) {
      MEMORY_STORES[storeName] = clone(parsed.data[storeName]);
    }
  }
  await loadStoredState();
  writeSettingsForm(state.settings);
  renderEverything();
  showToast('Back-up hersteld.', { type: 'success' });
}

async function clearAllData() {
  if (!window.confirm('Weet je zeker dat je alle lokale instellingen, schema’s en persoonlijke gegevens wilt wissen?')) return;
  if (state.database) {
    await Promise.all(Object.values(STORE_NAMES).map((storeName) => state.database.clear(storeName)));
  } else {
    for (const storeName of Object.values(STORE_NAMES)) MEMORY_STORES[storeName] = [];
  }
  state.settings = clone(DEFAULT_SETTINGS);
  state.ingredients = [...INGREDIENTS];
  state.recipes = [...RECIPES];
  state.plan = null;
  state.planIsStale = false;
  state.expandedDayIds.clear();
  resetShoppingState();
  rebuildIndexes();
  writeSettingsForm(state.settings);
  renderEverything();
  showToast('Alle lokale gegevens zijn gewist.', { type: 'success' });
}

async function loadStoredState() {
  const [settingsRecords, plans, customIngredients, customRecipes, meta] = await Promise.all([
    getAll(STORE_NAMES.settings),
    getAll(STORE_NAMES.plans),
    getAll(STORE_NAMES.customIngredients),
    getAll(STORE_NAMES.customRecipes),
    getAll(STORE_NAMES.meta),
  ]);
  const storedSettings = settingsRecords.find((record) => record.key === 'profile')?.value;
  state.settings = {
    ...clone(DEFAULT_SETTINGS),
    ...(storedSettings ?? {}),
    targets: { ...clone(DEFAULT_SETTINGS.targets), ...(storedSettings?.targets ?? {}) },
    excludedAllergens: [...(storedSettings?.excludedAllergens ?? [])],
    excludedIngredientTerms: [...(storedSettings?.excludedIngredientTerms ?? [])],
    excludedIngredientIds: [...(storedSettings?.excludedIngredientIds ?? [])],
  };
  state.ingredients = [...INGREDIENTS, ...customIngredients];
  state.recipes = [...RECIPES, ...customRecipes];
  rebuildIndexes();
  plans.sort((left, right) => String(left.updatedAt ?? '').localeCompare(String(right.updatedAt ?? '')));
  state.plan = plans.at(-1) ?? null;
  state.planIsStale = false;
  state.expandedDayIds.clear();
  const shopping = meta.find((record) => record.key === 'shoppingState')?.value;
  state.shoppingChecked = new Set(shopping?.checked ?? []);
  state.shoppingHidden = new Set(shopping?.hidden ?? []);
}

function renderEverything() {
  renderCurrentPlan();
  renderFilteredRecipes();
}

async function withBusy(button, task) {
  const originalText = button?.textContent;
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  }
  try {
    await task();
  } catch (error) {
    console.error(error);
    showToast(error?.message ?? 'Er ging iets mis.', { type: 'error', duration: 6500 });
  } finally {
    if (button) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = originalText;
    }
  }
}

function setupNavigation() {
  document.addEventListener('click', (event) => {
    const viewControl = event.target.closest('[data-view]');
    if (viewControl) {
      event.preventDefault();
      const view = setActiveView(viewControl.dataset.view);
      window.location.hash = view;
    }
  });
  const initialView = window.location.hash.slice(1);
  setActiveView(initialView || 'planner');
  window.addEventListener('hashchange', () => setActiveView(window.location.hash.slice(1)));
}

function setupEventHandlers() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'generate-plan') {
      withBusy(button, () => generatePlan());
    } else if (action === 'regenerate-plan') {
      withBusy(button, () => generatePlan({ regenerate: true }));
    } else if (action === UI_ACTIONS.TOGGLE_DAY) {
      toggleDay(button);
    } else if ([UI_ACTIONS.MORE_PROTEIN, UI_ACTIONS.CHEAPER, UI_ACTIONS.FASTER, UI_ACTIONS.REPLACE_MEAL].includes(action)) {
      withBusy(button, () => handleMealAdjustment(button));
    } else if (action === UI_ACTIONS.VIEW_RECIPE) {
      showRecipeDetails(button.dataset.recipeId, {
        dayIndex: button.dataset.dayIndex,
        mealIndex: button.dataset.mealIndex,
      });
    } else if (action === 'clear-checked-shopping') {
      for (const id of state.shoppingChecked) state.shoppingHidden.add(id);
      state.shoppingChecked.clear();
      persistShoppingState().then(renderCurrentShoppingList);
    } else if (action === 'export-backup') {
      withBusy(button, exportUserBackup);
    } else if (action === 'reset-data') {
      withBusy(button, clearAllData);
    }
  });

  document.querySelector('#settings-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const button = event.submitter;
    withBusy(button, async () => {
      const { settings, unknownExclusions } = readSettingsForm();
      state.settings = settings;
      state.planIsStale = Boolean(state.plan);
      await persistSettings();
      renderCurrentPlan();
      document.querySelector('#settings-save-status').textContent = 'Opgeslagen op dit apparaat.';
      showToast(unknownExclusions.length
        ? `Opgeslagen. Niet herkend: ${unknownExclusions.join(', ')}`
        : 'Instellingen opgeslagen.', { type: unknownExclusions.length ? 'warning' : 'success' });
    });
  });

  document.querySelector('#import-backup').addEventListener('change', (event) => {
    const [file] = event.target.files;
    withBusy(null, () => importUserBackup(file));
    event.target.value = '';
  });

  document.querySelector('#shopping-list').addEventListener('change', (event) => {
    const checkbox = event.target.closest(`[data-action="${UI_ACTIONS.TOGGLE_SHOPPING_ITEM}"]`);
    if (!checkbox) return;
    if (checkbox.checked) state.shoppingChecked.add(checkbox.dataset.itemId);
    else state.shoppingChecked.delete(checkbox.dataset.itemId);
    persistShoppingState().then(renderCurrentShoppingList);
  });

  const filterForm = document.querySelector('#recipe-filter-form');
  filterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    renderFilteredRecipes();
  });
  filterForm.addEventListener('input', renderFilteredRecipes);
  filterForm.addEventListener('change', renderFilteredRecipes);
  filterForm.addEventListener('reset', () => window.setTimeout(renderFilteredRecipes));

  const recipeDialog = document.querySelector('#recipe-dialog');
  recipeDialog.addEventListener('click', (event) => {
    if (event.target === recipeDialog) recipeDialog.close();
  });
}

function setupConnectivity() {
  const update = () => setConnectionStatus(navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

function setupInstallPrompt() {
  const installButton = document.querySelector('#install-button');
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener('click', async () => {
    if (!state.deferredInstallPrompt) return;
    await state.deferredInstallPrompt.prompt();
    state.deferredInstallPrompt = null;
    installButton.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    state.deferredInstallPrompt = null;
    installButton.hidden = true;
    showToast('Voeding is geïnstalleerd.', { type: 'success' });
  });
}

async function setupServiceWorker() {
  if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return;
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          showToast('Een nieuwe appversie is offline beschikbaar na herladen.', { type: 'info', duration: 6000 });
        }
      });
    });
  } catch (error) {
    console.error('Serviceworkerregistratie mislukt.', error);
    showToast('Offline installatie kon niet worden geactiveerd.', { type: 'warning' });
  }
}

async function bootstrap() {
  rebuildIndexes();
  setupNavigation();
  setupEventHandlers();
  setupConnectivity();
  setupInstallPrompt();

  try {
    state.database = await openDatabase({
      protectedIds: {
        ingredients: INGREDIENTS.map((ingredient) => ingredient.id),
        recipes: RECIPES.map((recipe) => recipe.id),
      },
      onBlocked: () => showToast('Sluit andere geopende versies van de app om de opslag bij te werken.', { type: 'warning' }),
    });
  } catch (error) {
    console.error(error);
    showToast('Lokale opslag is niet beschikbaar; wijzigingen verdwijnen na het sluiten van dit tabblad.', {
      type: 'warning',
      duration: 7000,
    });
  }

  await loadStoredState();
  writeSettingsForm(state.settings);
  renderEverything();
  await setupServiceWorker();
}

window.addEventListener('unhandledrejection', (event) => {
  console.error(event.reason);
  showToast(event.reason?.message ?? 'Er ging onverwacht iets mis.', { type: 'error' });
});

bootstrap().catch((error) => {
  console.error(error);
  renderPlanStatus('#plan-status', {
    type: 'error',
    title: 'App kon niet starten',
    message: error?.message ?? 'Controleer de bestanden en herlaad de pagina.',
  });
});
