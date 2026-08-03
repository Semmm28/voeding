const numberFormatter = new Intl.NumberFormat('nl-NL', {
  maximumFractionDigits: 1
});

const calorieFormatter = new Intl.NumberFormat('nl-NL', {
  maximumFractionDigits: 0
});

const currencyFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long'
});

const ALLOWED_MESSAGE_TYPES = new Set(['info', 'success', 'warning', 'error']);

const MEAL_LABELS = {
  breakfast: 'Ontbijt',
  lunch: 'Lunch',
  dinner: 'Avondeten',
  snack: 'Snack'
};

const DIET_LABELS = {
  vegetarian: 'Vegetarisch',
  vegan: 'Veganistisch',
  lactoseFree: 'Lactosevrij',
  lactose_free: 'Lactosevrij'
};

const CATEGORY_LABELS = {
  produce: 'Groente en fruit',
  vegetables: 'Groente',
  fruit: 'Fruit',
  proteins: 'Eiwitbronnen',
  protein: 'Eiwitbronnen',
  grains: 'Graanproducten',
  carbohydrates: 'Koolhydraten',
  dairy: 'Zuivel en alternatieven',
  pantry: 'Voorraadkast',
  spices: 'Kruiden en smaakmakers',
  frozen: 'Diepvries',
  other: 'Overig'
};

/** Maak blijvende schemawaarschuwingen geschikt voor de UI. */
export function planWarningViewModels(warnings = []) {
  return warnings
    .filter((warning) => warning.code !== 'NO_ADJUSTMENT_AVAILABLE')
    .map((warning) => ({
      ...warning,
      type: warning.severity ?? warning.type ?? 'warning',
      title: warning.severity === 'error'
        ? 'Niet volledig haalbaar'
        : warning.severity === 'info'
          ? 'Informatie'
          : 'Let op'
    }));
}

export const UI_ACTIONS = Object.freeze({
  MORE_PROTEIN: 'more-protein',
  CHEAPER: 'cheaper',
  FASTER: 'faster',
  REPLACE_MEAL: 'replace',
  TOGGLE_DAY: 'toggle-day',
  VIEW_RECIPE: 'view-recipe',
  TOGGLE_SHOPPING_ITEM: 'toggle-shopping-item'
});

function resolveElement(target) {
  if (target instanceof Element) {
    return target;
  }

  if (typeof target === 'string') {
    return document.querySelector(target);
  }

  return null;
}

function requireElement(target, label) {
  const element = resolveElement(target);

  if (!element) {
    throw new TypeError(`${label} kon niet worden gevonden.`);
  }

  return element;
}

function text(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value, suffix = '') {
  const number = finiteNumber(value);
  return number === null ? '—' : `${numberFormatter.format(number)}${suffix}`;
}

function formatCalories(value) {
  const number = finiteNumber(value);
  return number === null ? '—' : calorieFormatter.format(number);
}

function formatMoney(value) {
  const number = finiteNumber(value);
  return number === null ? null : currencyFormatter.format(number);
}

function normalizeNutrition(source = {}) {
  return {
    kcal: source.kcal ?? source.calories ?? source.energyKcal,
    protein: source.protein ?? source.proteinGrams,
    carbs: source.carbs ?? source.carbohydrates ?? source.carbohydrateGrams,
    fat: source.fat ?? source.fats ?? source.fatGrams
  };
}

function element(tagName, options = {}) {
  const node = document.createElement(tagName);

  if (options.className) {
    node.className = options.className;
  }

  if (options.text !== undefined) {
    node.textContent = text(options.text);
  }

  if (options.attributes) {
    for (const [name, value] of Object.entries(options.attributes)) {
      if (value !== null && value !== undefined) {
        node.setAttribute(name, text(value));
      }
    }
  }

  return node;
}

function appendTextElement(parent, tagName, value, className) {
  const child = element(tagName, { text: value, className });
  parent.append(child);
  return child;
}

function createEmptyState(title, message, icon = '☷') {
  const wrapper = element('div', { className: 'empty-state' });
  wrapper.append(
    element('span', {
      className: 'empty-icon',
      text: icon,
      attributes: { 'aria-hidden': 'true' }
    }),
    element('h2', { text: title }),
    element('p', { text: message })
  );
  return wrapper;
}

function createMacro(label, value, suffix, isCalories = false) {
  const wrapper = element('div', { className: 'macro' });
  appendTextElement(wrapper, 'span', isCalories ? formatCalories(value) : formatNumber(value, suffix));
  appendTextElement(wrapper, 'small', label);
  return wrapper;
}

function createMacroRow(nutritionSource, className = 'macro-row') {
  const nutrition = normalizeNutrition(nutritionSource);
  const row = element('div', {
    className,
    attributes: { 'aria-label': 'Voedingswaarden' }
  });

  row.append(
    createMacro('kcal', nutrition.kcal, '', true),
    createMacro('eiwit', nutrition.protein, ' g'),
    createMacro('koolh.', nutrition.carbs, ' g'),
    createMacro('vet', nutrition.fat, ' g')
  );

  return row;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const asString = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(asString)
    ? new Date(`${asString}T12:00:00`)
    : new Date(asString);

  return Number.isNaN(date.getTime()) ? null : date;
}

function mealLabel(value) {
  return MEAL_LABELS[value] || text(value, 'Maaltijd');
}

function createMealMeta(meal, recipe) {
  const meta = element('p', { className: 'meal-meta' });
  const nutrition = normalizeNutrition(meal.nutrition || recipe.nutrition || meal);
  const duration = finiteNumber(
    meal.durationMinutes
      ?? meal.prepMinutes
      ?? recipe.durationMinutes
      ?? recipe.prepMinutes
  );
  const cost = formatMoney(meal.cost ?? meal.estimatedCost ?? recipe.cost ?? recipe.estimatedCost);

  const parts = [];

  if (finiteNumber(nutrition.kcal) !== null) {
    parts.push(`${formatCalories(nutrition.kcal)} kcal`);
  }

  if (finiteNumber(nutrition.protein) !== null) {
    parts.push(`${formatNumber(nutrition.protein, ' g')} eiwit`);
  }

  if (duration !== null) {
    parts.push(`${numberFormatter.format(duration)} min`);
  }

  if (cost) {
    parts.push(cost);
  }

  if (parts.length === 0) {
    parts.push('Details worden berekend');
  }

  for (const part of parts) {
    appendTextElement(meta, 'span', part);
  }

  return meta;
}

function actionButton(label, action, mealId, dayId, dayIndex, mealIndex, recipeId) {
  const button = element('button', {
    className: 'meal-action',
    text: label,
    attributes: {
      type: 'button',
      'data-action': action,
      'data-meal-id': mealId,
      'data-day-id': dayId,
      'data-day-index': dayIndex,
      'data-meal-index': mealIndex,
      'aria-label': `${label}: pas maaltijd aan`
    }
  });

  if (recipeId !== null && recipeId !== undefined) {
    button.dataset.recipeId = text(recipeId);
  }

  return button;
}

function createMealCard(meal, dayId, dayIndex, index) {
  const recipe = meal.recipe || {};
  const mealId = meal.id ?? `${dayId}-meal-${index + 1}`;
  const recipeId = meal.recipeId ?? recipe.id;
  const name = meal.name ?? recipe.name ?? `Maaltijd ${index + 1}`;
  const type = meal.type ?? meal.mealType ?? recipe.mealType;
  const card = element('article', {
    className: 'meal-card',
    attributes: {
      'data-meal-id': mealId,
      'data-day-id': dayId,
      'data-day-index': dayIndex,
      'data-meal-index': index
    }
  });
  const hasRecipe = recipeId !== null && recipeId !== undefined;
  const recipeActionAttributes = hasRecipe
    ? {
        'data-action': UI_ACTIONS.VIEW_RECIPE,
        'data-recipe-id': recipeId,
        'data-day-index': dayIndex,
        'data-meal-index': index
      }
    : {};
  const details = element('div', {
    className: hasRecipe ? 'meal-summary is-clickable' : 'meal-summary',
    attributes: recipeActionAttributes
  });
  const topLine = element('div', { className: 'meal-topline' });
  const titleBlock = element('div');

  appendTextElement(titleBlock, 'p', mealLabel(type), 'meal-type');
  appendTextElement(titleBlock, 'h3', name);
  topLine.append(titleBlock);

  if (hasRecipe) {
    topLine.append(element('button', {
      className: 'meal-recipe-link',
      text: 'Bekijk recept',
      attributes: {
        type: 'button',
        ...recipeActionAttributes,
        'aria-label': `Bekijk recept: ${text(name)}`
      }
    }));
  }

  details.append(topLine, createMealMeta(meal, recipe));

  const actions = element('div', {
    className: 'meal-actions',
    attributes: { 'aria-label': `Pas ${text(name)} aan` }
  });

  actions.append(
    actionButton('Meer eiwit', UI_ACTIONS.MORE_PROTEIN, mealId, dayId, dayIndex, index, recipeId),
    actionButton('Goedkoper', UI_ACTIONS.CHEAPER, mealId, dayId, dayIndex, index, recipeId),
    actionButton('Sneller', UI_ACTIONS.FASTER, mealId, dayId, dayIndex, index, recipeId),
    actionButton('Vervang', UI_ACTIONS.REPLACE_MEAL, mealId, dayId, dayIndex, index, recipeId)
  );

  card.append(details, actions);
  return card;
}

/**
 * Render een gegenereerd plan. Verwacht `plan.days[]`; iedere dag mag `totals`
 * of `nutrition` en `meals[]` bevatten. Gebruikersdata wordt uitsluitend via
 * `textContent` en DOM-attributen geplaatst.
 */
export function renderPlan(target, plan, options = {}) {
  const container = requireElement(target, 'Plancontainer');
  const days = Array.isArray(plan?.days) ? plan.days : [];
  const expandedDayIds = options.expandedDayIds instanceof Set
    ? options.expandedDayIds
    : new Set(options.expandedDayIds ?? []);
  const fragment = document.createDocumentFragment();

  if (days.length === 0) {
    fragment.append(createEmptyState(
      'Je schema verschijnt hier',
      'Controleer je instellingen en kies daarna Genereer schema.',
      '☷'
    ));
    container.replaceChildren(fragment);
    return;
  }

  days.forEach((day, dayIndex) => {
    const dayId = day.id ?? `day-${dayIndex + 1}`;
    const normalizedDayId = text(dayId);
    const date = parseDate(day.date);
    const title = day.label ?? day.name ?? `Dag ${dayIndex + 1}`;
    const isExpanded = expandedDayIds.has(normalizedDayId);
    const mealListId = `plan-day-meals-${dayIndex}`;
    const dayCard = element('section', {
      className: isExpanded ? 'plan-day is-expanded' : 'plan-day',
      attributes: {
        'data-day-id': normalizedDayId,
        'data-day-index': dayIndex,
        'aria-labelledby': `plan-day-heading-${dayIndex}`
      }
    });
    const header = element('header', {
      className: 'day-header',
      attributes: {
        'data-action': UI_ACTIONS.TOGGLE_DAY,
        'data-day-id': normalizedDayId
      }
    });
    const titleBlock = element('div', { className: 'day-title-block' });
    const heading = element('h2', {
      attributes: { id: `plan-day-heading-${dayIndex}` }
    });
    const toggleButton = element('button', {
      className: 'day-toggle',
      attributes: {
        type: 'button',
        'data-action': UI_ACTIONS.TOGGLE_DAY,
        'data-day-id': normalizedDayId,
        'aria-expanded': isExpanded,
        'aria-controls': mealListId,
        'aria-label': `${isExpanded ? 'Klap in' : 'Klap uit'}: ${text(title)}`
      }
    });

    toggleButton.append(
      element('span', { text: title }),
      element('span', {
        className: 'day-toggle-icon',
        text: '⌄',
        attributes: { 'aria-hidden': 'true' }
      })
    );
    heading.append(toggleButton);

    titleBlock.append(heading);

    if (date) {
      appendTextElement(titleBlock, 'p', dateFormatter.format(date), 'day-date');
    }

    header.append(titleBlock, createMacroRow(day.totals || day.nutrition || {}));

    const meals = Array.isArray(day.meals) ? day.meals : [];
    const mealList = element('div', {
      className: 'meal-list',
      attributes: { id: mealListId }
    });
    mealList.hidden = !isExpanded;

    if (meals.length === 0) {
      mealList.append(element('p', {
        className: 'notice-card',
        text: 'Voor deze dag zijn nog geen maaltijden beschikbaar.'
      }));
    } else {
      meals.forEach((meal, mealIndex) => {
        mealList.append(createMealCard(meal, dayId, dayIndex, mealIndex));
      });
    }

    dayCard.append(header, mealList);
    fragment.append(dayCard);
  });

  container.replaceChildren(fragment);
}

/** Werk één dagweergave bij zonder het schema opnieuw te renderen. */
export function setPlanDayExpanded(control, expanded) {
  const dayCard = control?.closest?.('.plan-day');
  if (!dayCard) return false;

  const toggleButton = dayCard.querySelector(`.day-toggle[data-action="${UI_ACTIONS.TOGGLE_DAY}"]`);
  const mealList = dayCard.querySelector('.meal-list');
  if (!toggleButton || !mealList) return false;

  const isExpanded = Boolean(expanded);
  dayCard.classList.toggle('is-expanded', isExpanded);
  toggleButton.setAttribute('aria-expanded', text(isExpanded));
  toggleButton.setAttribute('aria-label', `${isExpanded ? 'Klap in' : 'Klap uit'}: ${toggleButton.textContent.replace('⌄', '').trim()}`);
  mealList.hidden = !isExpanded;
  return true;
}

function normalizeTags(recipe) {
  const tags = [];
  const candidates = Array.isArray(recipe.tags) ? recipe.tags : [];

  for (const candidate of candidates) {
    const label = DIET_LABELS[candidate] || text(candidate).trim();
    if (label && !tags.includes(label)) {
      tags.push(label);
    }
  }

  if (recipe.vegan === true && !tags.includes('Veganistisch')) {
    tags.push('Veganistisch');
  } else if (recipe.vegetarian === true && !tags.includes('Vegetarisch')) {
    tags.push('Vegetarisch');
  }

  if ((recipe.lactoseFree === true || recipe.lactose_free === true) && !tags.includes('Lactosevrij')) {
    tags.push('Lactosevrij');
  }

  return tags.slice(0, 5);
}

function createRecipeCard(recipe, index) {
  const recipeId = recipe.id ?? `recipe-${index + 1}`;
  const name = recipe.name ?? `Recept ${index + 1}`;
  const card = element('article', {
    className: 'recipe-card',
    attributes: { 'data-recipe-id': recipeId }
  });
  const header = element('div');
  appendTextElement(header, 'p', mealLabel(recipe.mealType ?? recipe.type), 'meal-type');
  appendTextElement(header, 'h2', name);

  const meta = element('p', { className: 'recipe-meta' });
  const duration = finiteNumber(recipe.durationMinutes ?? recipe.prepMinutes ?? recipe.totalMinutes);
  const cost = formatMoney(recipe.cost ?? recipe.estimatedCost);
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : null;

  if (duration !== null) {
    appendTextElement(meta, 'span', `${numberFormatter.format(duration)} min`);
  }

  if (ingredients !== null) {
    appendTextElement(meta, 'span', `${ingredients} ingrediënt${ingredients === 1 ? '' : 'en'}`);
  }

  if (cost) {
    appendTextElement(meta, 'span', `circa ${cost}`);
  }

  const tags = normalizeTags(recipe);
  const tagList = element('ul', {
    className: 'tag-list',
    attributes: { 'aria-label': 'Kenmerken' }
  });

  for (const tag of tags) {
    const item = element('li', { className: 'tag', text: tag });
    tagList.append(item);
  }

  const button = element('button', {
    className: 'button button-secondary',
    text: 'Bekijk recept',
    attributes: {
      type: 'button',
      'data-action': UI_ACTIONS.VIEW_RECIPE,
      'data-recipe-id': recipeId,
      'aria-label': `Bekijk recept: ${text(name)}`
    }
  });

  card.append(header);

  if (meta.childElementCount > 0) {
    card.append(meta);
  }

  if (tagList.childElementCount > 0) {
    card.append(tagList);
  }

  card.append(createMacroRow(recipe.nutrition || recipe, 'recipe-macros'), button);
  return card;
}

/** Render een lijst recepten en werk optioneel een resultaatteller bij. */
export function renderRecipes(target, recipes, options = {}) {
  const container = requireElement(target, 'Receptencontainer');
  const list = Array.isArray(recipes) ? recipes : [];
  const fragment = document.createDocumentFragment();

  container.setAttribute('aria-busy', 'false');

  if (list.length === 0) {
    fragment.append(createEmptyState(
      'Geen recepten gevonden',
      'Probeer een andere zoekterm of maak één of meer filters minder streng.',
      '⌕'
    ));
  } else {
    list.forEach((recipe, index) => fragment.append(createRecipeCard(recipe, index)));
  }

  container.replaceChildren(fragment);

  const countElement = resolveElement(options.countElement || '#recipe-results-count');
  if (countElement) {
    countElement.textContent = list.length === 1 ? '1 recept gevonden' : `${list.length} recepten gevonden`;
  }
}

function ingredientLineAmount(line) {
  const amount = line.grams ?? line.amount ?? line.quantity;
  const unit = line.grams !== undefined ? 'g' : text(line.unit).trim();
  const number = finiteNumber(amount);
  const formatted = number === null ? text(amount).trim() : numberFormatter.format(number);
  return [formatted, unit].filter(Boolean).join(' ');
}

/**
 * Vul het receptdialoog met ingrediënten en bereidingsstappen. App.js kan na
 * deze call `document.querySelector('#recipe-dialog').showModal()` uitvoeren.
 * Ingrediëntregels mogen vooraf met een `name` worden verrijkt; anders wordt
 * het opgeslagen ingrediënt-ID transparant getoond.
 */
export function renderRecipeDetails(target, recipe, options = {}) {
  const container = requireElement(target, 'Receptdetailcontainer');
  const titleElement = resolveElement(options.titleElement || '#recipe-dialog-title');
  const name = recipe?.name || 'Receptdetails';
  const fragment = document.createDocumentFragment();

  if (titleElement) {
    titleElement.textContent = text(name);
  }

  if (!recipe) {
    fragment.append(createEmptyState(
      'Recept niet beschikbaar',
      'Dit recept kon niet in de lokale database worden gevonden.',
      '!'
    ));
    container.replaceChildren(fragment);
    return;
  }

  const summary = element('section', { className: 'dialog-section' });
  const meta = element('p', { className: 'recipe-meta' });
  const duration = finiteNumber(recipe.durationMinutes ?? recipe.prepMinutes ?? recipe.totalMinutes);
  const servings = finiteNumber(recipe.servings);
  const cost = formatMoney(recipe.cost ?? recipe.estimatedCost);

  if (duration !== null) appendTextElement(meta, 'span', `${numberFormatter.format(duration)} min`);
  if (servings !== null) appendTextElement(meta, 'span', `${numberFormatter.format(servings)} portie${servings === 1 ? '' : 's'}`);
  if (cost) appendTextElement(meta, 'span', `circa ${cost}`);
  if (meta.childElementCount > 0) summary.append(meta);
  summary.append(element('h3', { text: 'Voedingswaarden per portie' }));
  summary.append(createMacroRow(recipe.nutrition || recipe, 'recipe-macros'));
  fragment.append(summary);

  const ingredientSection = element('section', { className: 'dialog-section' });
  ingredientSection.append(element('h3', { text: 'Ingrediënten' }));
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

  if (ingredients.length > 0) {
    const list = element('ul', { className: 'ingredient-list' });
    ingredients.forEach((line, index) => {
      const ingredientName = line.name
        ?? line.ingredientName
        ?? line.label
        ?? line.ingredientId
        ?? `Ingrediënt ${index + 1}`;
      const amount = ingredientLineAmount(line);
      list.append(element('li', {
        text: amount ? `${amount} ${text(ingredientName)}` : ingredientName
      }));
    });
    ingredientSection.append(list);
  } else {
    ingredientSection.append(element('p', { text: 'Geen ingrediënten vastgelegd.' }));
  }
  fragment.append(ingredientSection);

  const steps = Array.isArray(recipe.steps)
    ? recipe.steps
    : Array.isArray(recipe.instructions)
      ? recipe.instructions
      : [];
  const stepSection = element('section', { className: 'dialog-section' });
  stepSection.append(element('h3', { text: 'Bereiding' }));

  if (steps.length > 0) {
    const list = element('ol', { className: 'step-list' });
    steps.forEach((step) => {
      const description = typeof step === 'string' ? step : step?.text ?? step?.description;
      if (description) list.append(element('li', { text: description }));
    });
    stepSection.append(list.childElementCount > 0
      ? list
      : element('p', { text: 'Geen bereidingsstappen vastgelegd.' }));
  } else {
    stepSection.append(element('p', { text: 'Geen bereidingsstappen vastgelegd.' }));
  }
  fragment.append(stepSection);

  const allergens = Array.isArray(recipe.allergens)
    ? recipe.allergens
    : Array.isArray(recipe.nutrition?.allergens)
      ? recipe.nutrition.allergens
      : [];
  const sourceMessage = allergens.length > 0
    ? `Opgeslagen allergenen: ${allergens.join(', ')}. Controleer altijd de productetiketten.`
    : 'Controleer productetiketten altijd zelf op allergenen en kruisbesmetting.';
  fragment.append(element('p', { className: 'recipe-source-note', text: sourceMessage }));

  container.replaceChildren(fragment);
}

function categoryLabel(value) {
  const normalized = text(value, 'other');
  return CATEGORY_LABELS[normalized] || normalized || CATEGORY_LABELS.other;
}

function shoppingAmount(item) {
  const rawAmount = item.amount ?? item.quantity;
  const number = finiteNumber(rawAmount);
  const amount = number === null ? text(rawAmount).trim() : numberFormatter.format(number);
  const unit = text(item.unit).trim();

  if (!amount && !unit) {
    return '';
  }

  return [amount, unit].filter(Boolean).join(' ');
}

function createShoppingGroup(category, items, groupIndex) {
  const section = element('section', {
    className: 'shopping-group',
    attributes: { 'aria-labelledby': `shopping-category-${groupIndex}` }
  });
  const heading = element('h2', {
    text: category,
    attributes: { id: `shopping-category-${groupIndex}` }
  });
  const list = element('ul', { className: 'shopping-items' });

  items.forEach((item, itemIndex) => {
    const itemId = item.id ?? `shopping-${groupIndex}-${itemIndex}`;
    const name = item.name ?? item.ingredientName ?? `Boodschap ${itemIndex + 1}`;
    const inputId = `shopping-check-${groupIndex}-${itemIndex}`;
    const checked = item.checked === true;
    const listItem = element('li', {
      className: checked ? 'shopping-item is-checked' : 'shopping-item',
      attributes: { 'data-item-id': itemId }
    });
    const label = element('label', {
      className: 'shopping-check',
      attributes: { for: inputId }
    });
    const checkbox = element('input', {
      attributes: {
        id: inputId,
        type: 'checkbox',
        'data-action': UI_ACTIONS.TOGGLE_SHOPPING_ITEM,
        'data-item-id': itemId,
        'aria-label': `${checked ? 'Markeer als niet gekocht' : 'Markeer als gekocht'}: ${text(name)}`
      }
    });
    checkbox.checked = checked;

    label.append(
      checkbox,
      element('span', { className: 'shopping-name', text: name }),
      element('span', { className: 'shopping-amount', text: shoppingAmount(item) })
    );
    listItem.append(label);
    list.append(listItem);
  });

  section.append(heading, list);
  return section;
}

/** Render een boodschappenlijst, gegroepeerd op `item.category`. */
export function renderShoppingList(target, items, options = {}) {
  const container = requireElement(target, 'Boodschappencontainer');
  const list = Array.isArray(items) ? items : [];
  const fragment = document.createDocumentFragment();

  if (list.length === 0) {
    fragment.append(createEmptyState(
      'Je lijst is leeg',
      'Genereer eerst een schema; de benodigde ingrediënten verschijnen daarna hier.',
      '✓'
    ));
  } else {
    const grouped = new Map();

    for (const item of list) {
      const category = categoryLabel(item.category);
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category).push(item);
    }

    [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'nl'))
      .forEach(([category, groupItems], index) => {
        fragment.append(createShoppingGroup(category, groupItems, index));
      });
  }

  container.replaceChildren(fragment);

  const progressElement = resolveElement(options.progressElement || '#shopping-progress');
  if (progressElement) {
    const checked = list.filter((item) => item.checked === true).length;
    const title = list.length === 0
      ? 'Nog geen boodschappen'
      : `${checked} van ${list.length} afgevinkt`;
    const detail = list.length === 0
      ? 'Genereer eerst een schema.'
      : checked === list.length
        ? 'Alles is afgevinkt.'
        : `${list.length - checked} nog te gaan`;

    const wrapper = element('div');
    wrapper.append(
      element('strong', { text: title }),
      element('span', { text: detail })
    );
    progressElement.replaceChildren(wrapper);
  }
}

function normalizeMessageType(value) {
  return ALLOWED_MESSAGE_TYPES.has(value) ? value : 'info';
}

function messageIcon(type) {
  if (type === 'success') return '✓';
  if (type === 'warning') return '!';
  if (type === 'error') return '×';
  return 'i';
}

/**
 * Render haalbaarheids- en foutmeldingen. Een melding mag een string zijn of
 * `{ type, title, message }`, waarbij type info/success/warning/error is.
 */
export function renderWarnings(target, warnings) {
  const container = requireElement(target, 'Meldingencontainer');
  const list = Array.isArray(warnings) ? warnings : warnings ? [warnings] : [];
  const fragment = document.createDocumentFragment();

  list.forEach((warning) => {
    const normalized = typeof warning === 'string'
      ? { type: 'warning', title: 'Let op', message: warning }
      : warning || {};
    const type = normalizeMessageType(normalized.type || normalized.severity);
    const wrapper = element('div', {
      className: `message message-${type}`,
      attributes: { role: type === 'error' ? 'alert' : 'status' }
    });
    const content = element('div');

    content.append(
      element('strong', { text: normalized.title || (type === 'error' ? 'Niet gelukt' : 'Let op') }),
      element('p', { text: normalized.message || '' })
    );
    wrapper.append(
      element('span', {
        className: 'message-icon',
        text: messageIcon(type),
        attributes: { 'aria-hidden': 'true' }
      }),
      content
    );
    fragment.append(wrapper);
  });

  container.replaceChildren(fragment);
}

/** Werk de vaste planstatus bij met dezelfde veilige meldingstypen. */
export function renderPlanStatus(target, status = {}) {
  const container = requireElement(target, 'Planstatus');
  const type = normalizeMessageType(status.type);
  const content = element('div');

  content.append(
    element('strong', { text: status.title || 'Status' }),
    element('p', { text: status.message || '' })
  );
  container.className = `status-panel status-${type}`;
  container.replaceChildren(
    element('span', {
      className: 'status-icon',
      text: messageIcon(type),
      attributes: { 'aria-hidden': 'true' }
    }),
    content
  );
}

/** Toon één kort bericht in de live-regio. */
export function showToast(message, options = {}) {
  const region = requireElement(options.region || '#toast-region', 'Toastregio');
  const type = normalizeMessageType(options.type);
  const duration = Math.max(1500, finiteNumber(options.duration) ?? 3500);
  const toast = element('div', {
    className: `toast toast-${type}`,
    text: message,
    attributes: { role: type === 'error' ? 'alert' : 'status' }
  });

  if (region._toastTimeout) {
    window.clearTimeout(region._toastTimeout);
  }

  region.replaceChildren(toast);
  region._toastTimeout = window.setTimeout(() => {
    if (toast.isConnected) {
      toast.remove();
    }
  }, duration);

  return toast;
}

/** Toon precies één hoofdview en synchroniseer de onderste navigatie. */
export function setActiveView(viewName, root = document) {
  const allowedViews = new Set(['planner', 'recipes', 'shopping', 'settings']);
  const selected = allowedViews.has(viewName) ? viewName : 'planner';

  root.querySelectorAll('[data-view-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== selected;
  });

  root.querySelectorAll('.bottom-nav [data-view]').forEach((button) => {
    const isActive = button.dataset.view === selected;
    button.classList.toggle('is-active', isActive);
    if (isActive) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  });

  return selected;
}

/** Synchroniseer de zichtbare online/offline-indicator. */
export function setConnectionStatus(isOnline, target = '#online-status') {
  const status = requireElement(target, 'Verbindingsstatus');
  const label = status.querySelector('[data-status-label]');

  status.classList.toggle('is-offline', !isOnline);
  status.setAttribute('aria-label', isOnline ? 'App is online' : 'App is offline');

  if (label) {
    label.textContent = isOnline ? 'Online' : 'Offline';
  }
}
