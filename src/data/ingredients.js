const GENERIC_REFERENCE_URL = "https://www.rivm.nl/nederlands-voedingsstoffenbestand";

export const DATA_NOTICE = `Deze lokale catalogus bevat generieke, afgeronde startwaarden per 100 gram. Ze zijn niet aan verzonnen NEVO-codes gekoppeld en zijn niet geschikt als definitieve productclaim. Controleer voor definitief gebruik iedere waarde in de actuele NEVO-database of op het etiket van het daadwerkelijk gebruikte product; bij merkproducten is het etiket leidend. Bereiding, uitlekken en productvariant kunnen de uitkomst veranderen. Allergenenlabels zijn een conservatieve start en het productetiket blijft leidend. pricePer100g is uitsluitend een indicatieve startprijs en geen actuele winkelprijs.`;

const VEGAN = { vegetarian: true, vegan: true, lactoseFree: true, glutenFree: true };
const VEGETARIAN = { vegetarian: true, vegan: false, lactoseFree: false, glutenFree: true };
const ANIMAL = { vegetarian: false, vegan: false, lactoseFree: true, glutenFree: true };

function makeSource(status, note) {
  if (status === "label-dependent") {
    return {
      label: "Productetiket vereist",
      url: "",
      status,
      note: `${note} Samenstelling en allergenen verschillen per merk; vervang deze startwaarde door het etiket van het gekozen product.`,
    };
  }

  return {
    label: "Generieke referentiewaarde — controle vereist",
    url: GENERIC_REFERENCE_URL,
    status: "generic-reference",
    note: `${note} Afgeronde generieke startwaarde; niet gekoppeld aan een specifieke NEVO-code. Controleer in de actuele NEVO-database.`,
  };
}

function ingredient({
  id,
  name,
  category,
  state,
  per100,
  pricePer100g,
  allergens = [],
  flags = VEGAN,
  substitutions = [],
  sourceStatus = "generic-reference",
  sourceNote = "",
}) {
  return {
    id,
    name,
    category,
    state,
    per100,
    pricePer100g,
    allergens,
    flags: { ...flags },
    substitutions,
    source: makeSource(sourceStatus, sourceNote),
  };
}

export const INGREDIENTS = [
  // Granen, brood en zetmeel. Droge producten worden droog afgewogen.
  ingredient({ id: "oats", name: "Havermout", category: "granen", state: "droog", per100: { kcal: 370, protein: 13.5, carbs: 59, fat: 7, fiber: 10 }, pricePer100g: 0.18, allergens: ["gluten"], flags: { ...VEGAN, glutenFree: false }, substitutions: ["flour_wholegrain", "granola"] }),
  ingredient({ id: "bread_wholegrain", name: "Volkorenbrood", category: "brood", state: "zoals verkocht", per100: { kcal: 247, protein: 9.7, carbs: 41, fat: 3.5, fiber: 6.5 }, pricePer100g: 0.3, allergens: ["gluten"], flags: { ...VEGAN, glutenFree: false }, substitutions: ["pita_wholegrain", "wrap_wholegrain"], sourceStatus: "label-dependent", sourceNote: "Waarden voor een generiek volkorenbrood." }),
  ingredient({ id: "wrap_wholegrain", name: "Volkorenwrap", category: "brood", state: "zoals verkocht", per100: { kcal: 310, protein: 9, carbs: 51, fat: 7, fiber: 6 }, pricePer100g: 0.55, allergens: ["gluten"], flags: { ...VEGAN, glutenFree: false }, substitutions: ["pita_wholegrain", "tortilla_corn"], sourceStatus: "label-dependent", sourceNote: "Waarden voor een generieke tarwewrap." }),
  ingredient({ id: "tortilla_corn", name: "Maïstortilla", category: "brood", state: "zoals verkocht", per100: { kcal: 218, protein: 5.7, carbs: 44.6, fat: 2.9, fiber: 6.3 }, pricePer100g: 0.65, substitutions: ["wrap_wholegrain"], sourceStatus: "label-dependent", sourceNote: "Glutenvrij alleen wanneer het etiket dit bevestigt." }),
  ingredient({ id: "pita_wholegrain", name: "Volkorenpitabrood", category: "brood", state: "zoals verkocht", per100: { kcal: 260, protein: 9, carbs: 48, fat: 3, fiber: 6 }, pricePer100g: 0.42, allergens: ["gluten"], flags: { ...VEGAN, glutenFree: false }, substitutions: ["bread_wholegrain", "wrap_wholegrain"], sourceStatus: "label-dependent", sourceNote: "Waarden voor een generiek volkorenpitabrood." }),
  ingredient({ id: "rice_basmati_dry", name: "Basmatirijst", category: "granen", state: "droog/ongekookt", per100: { kcal: 350, protein: 8, carbs: 77, fat: 1, fiber: 1.5 }, pricePer100g: 0.25, substitutions: ["rice_brown_dry", "quinoa_dry", "bulgur_dry"] }),
  ingredient({ id: "rice_brown_dry", name: "Zilvervliesrijst", category: "granen", state: "droog/ongekookt", per100: { kcal: 353, protein: 8, carbs: 73, fat: 2.8, fiber: 3.5 }, pricePer100g: 0.28, substitutions: ["rice_basmati_dry", "quinoa_dry"] }),
  ingredient({ id: "pasta_white_dry", name: "Witte pasta", category: "granen", state: "droog/ongekookt", per100: { kcal: 355, protein: 12, carbs: 72, fat: 1.5, fiber: 3 }, pricePer100g: 0.18, allergens: ["gluten"], flags: { ...VEGAN, glutenFree: false }, substitutions: ["pasta_wholewheat_dry", "rice_noodles_dry"] }),
  ingredient({ id: "pasta_wholewheat_dry", name: "Volkorenpasta", category: "granen", state: "droog/ongekookt", per100: { kcal: 350, protein: 13, carbs: 65, fat: 2.5, fiber: 8 }, pricePer100g: 0.22, allergens: ["gluten"], flags: { ...VEGAN, glutenFree: false }, substitutions: ["pasta_white_dry", "bulgur_dry"] }),
  ingredient({ id: "rice_noodles_dry", name: "Rijstnoedels", category: "granen", state: "droog/ongekookt", per100: { kcal: 360, protein: 6, carbs: 80, fat: 0.8, fiber: 1.5 }, pricePer100g: 0.55, substitutions: ["pasta_white_dry", "rice_basmati_dry"], sourceStatus: "label-dependent", sourceNote: "Controleer of uitsluitend rijst is gebruikt bij een glutenvrij dieet." }),
  ingredient({ id: "couscous_dry", name: "Couscous", category: "granen", state: "droog/ongekookt", per100: { kcal: 360, protein: 12, carbs: 72, fat: 1.5, fiber: 5 }, pricePer100g: 0.28, allergens: ["gluten"], flags: { ...VEGAN, glutenFree: false }, substitutions: ["bulgur_dry", "quinoa_dry"] }),
  ingredient({ id: "quinoa_dry", name: "Quinoa", category: "granen", state: "droog/ongekookt", per100: { kcal: 370, protein: 14, carbs: 64, fat: 6, fiber: 7 }, pricePer100g: 0.75, substitutions: ["rice_brown_dry", "bulgur_dry"] }),
  ingredient({ id: "bulgur_dry", name: "Bulgur", category: "granen", state: "droog/ongekookt", per100: { kcal: 342, protein: 12, carbs: 63, fat: 1.3, fiber: 12 }, pricePer100g: 0.35, allergens: ["gluten"], flags: { ...VEGAN, glutenFree: false }, substitutions: ["couscous_dry", "quinoa_dry"] }),
  ingredient({ id: "potato_raw", name: "Aardappel", category: "aardappelen", state: "rauw", per100: { kcal: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2 }, pricePer100g: 0.16, substitutions: ["sweet_potato_raw", "rice_basmati_dry"] }),
  ingredient({ id: "sweet_potato_raw", name: "Zoete aardappel", category: "aardappelen", state: "rauw", per100: { kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3 }, pricePer100g: 0.35, substitutions: ["potato_raw", "pumpkin"] }),
  ingredient({ id: "rice_cakes", name: "Rijstwafels", category: "brood", state: "zoals verkocht", per100: { kcal: 387, protein: 8, carbs: 81, fat: 3, fiber: 3.5 }, pricePer100g: 0.75, substitutions: ["bread_wholegrain"], sourceStatus: "label-dependent", sourceNote: "Waarden en formaat verschillen per merk." }),
  ingredient({ id: "granola", name: "Granola", category: "granen", state: "zoals verkocht", per100: { kcal: 450, protein: 10, carbs: 61, fat: 17, fiber: 8 }, pricePer100g: 0.7, allergens: ["gluten"], flags: { ...VEGAN, glutenFree: false }, substitutions: ["oats"], sourceStatus: "label-dependent", sourceNote: "Suiker, olie, noten en allergenen verschillen sterk per product." }),
  ingredient({ id: "flour_wholegrain", name: "Volkorenmeel", category: "granen", state: "droog", per100: { kcal: 340, protein: 13, carbs: 61, fat: 2.5, fiber: 10 }, pricePer100g: 0.18, allergens: ["gluten"], flags: { ...VEGAN, glutenFree: false }, substitutions: ["oats"] }),

  // Zuivel, alternatieven en poeders.
  ingredient({ id: "milk_semi_skimmed", name: "Halfvolle melk", category: "zuivel", state: "zoals verkocht", per100: { kcal: 47, protein: 3.5, carbs: 4.7, fat: 1.5, fiber: 0 }, pricePer100g: 0.12, allergens: ["melk"], flags: VEGETARIAN, substitutions: ["soy_milk_unsweetened", "oat_milk_unsweetened"], sourceStatus: "label-dependent", sourceNote: "Melk bevat van nature lactose." }),
  ingredient({ id: "soy_milk_unsweetened", name: "Ongezoete sojadrink", category: "plantaardige zuivel", state: "zoals verkocht", per100: { kcal: 33, protein: 3.3, carbs: 0.7, fat: 1.8, fiber: 0.6 }, pricePer100g: 0.17, allergens: ["soja"], substitutions: ["oat_milk_unsweetened", "milk_semi_skimmed"], sourceStatus: "label-dependent", sourceNote: "Verrijking en samenstelling verschillen per merk." }),
  ingredient({ id: "oat_milk_unsweetened", name: "Ongezoete haverdrink", category: "plantaardige zuivel", state: "zoals verkocht", per100: { kcal: 40, protein: 1, carbs: 6.7, fat: 1.4, fiber: 0.8 }, pricePer100g: 0.2, allergens: ["gluten"], flags: { ...VEGAN, glutenFree: false }, substitutions: ["soy_milk_unsweetened"], sourceStatus: "label-dependent", sourceNote: "Glutenvrij alleen als het etiket dit bevestigt." }),
  ingredient({ id: "soy_yogurt_unsweetened", name: "Ongezoete sojayoghurt", category: "plantaardige zuivel", state: "zoals verkocht", per100: { kcal: 45, protein: 4, carbs: 2, fat: 2.3, fiber: 0.8 }, pricePer100g: 0.32, allergens: ["soja"], substitutions: ["skyr_lactose_free", "greek_yogurt_lactose_free"], sourceStatus: "label-dependent", sourceNote: "Verrijking en samenstelling verschillen per merk." }),
  ingredient({ id: "skyr_lactose_free", name: "Lactosevrije skyr", category: "zuivel", state: "zoals verkocht", per100: { kcal: 62, protein: 10.5, carbs: 4, fat: 0.3, fiber: 0 }, pricePer100g: 0.48, allergens: ["melk"], flags: { ...VEGETARIAN, lactoseFree: true }, substitutions: ["quark_lactose_free", "soy_yogurt_unsweetened"], sourceStatus: "label-dependent", sourceNote: "Alleen lactosevrij wanneer het productetiket dit bevestigt; ongeschikt bij melkallergie." }),
  ingredient({ id: "quark_lactose_free", name: "Lactosevrije magere kwark", category: "zuivel", state: "zoals verkocht", per100: { kcal: 60, protein: 10, carbs: 4, fat: 0.3, fiber: 0 }, pricePer100g: 0.38, allergens: ["melk"], flags: { ...VEGETARIAN, lactoseFree: true }, substitutions: ["skyr_lactose_free", "greek_yogurt_lactose_free"], sourceStatus: "label-dependent", sourceNote: "Alleen lactosevrij wanneer het productetiket dit bevestigt; ongeschikt bij melkallergie." }),
  ingredient({ id: "greek_yogurt_lactose_free", name: "Lactosevrije Griekse yoghurt", category: "zuivel", state: "zoals verkocht", per100: { kcal: 73, protein: 8.5, carbs: 4, fat: 2.5, fiber: 0 }, pricePer100g: 0.45, allergens: ["melk"], flags: { ...VEGETARIAN, lactoseFree: true }, substitutions: ["skyr_lactose_free", "soy_yogurt_unsweetened"], sourceStatus: "label-dependent", sourceNote: "Vetgehalte verschilt per product; ongeschikt bij melkallergie." }),
  ingredient({ id: "cheese_30plus", name: "30+ kaas", category: "zuivel", state: "zoals verkocht", per100: { kcal: 280, protein: 32, carbs: 0, fat: 17, fiber: 0 }, pricePer100g: 1.2, allergens: ["melk"], flags: VEGETARIAN, substitutions: ["feta"], sourceStatus: "label-dependent", sourceNote: "Lactosegehalte en voedingswaarden verschillen per kaas." }),
  ingredient({ id: "feta", name: "Feta", category: "zuivel", state: "zoals verkocht", per100: { kcal: 265, protein: 14, carbs: 4, fat: 21, fiber: 0 }, pricePer100g: 1.25, allergens: ["melk"], flags: VEGETARIAN, substitutions: ["cheese_30plus"], sourceStatus: "label-dependent", sourceNote: "Samenstelling verschilt per product; witte kaas is niet altijd feta." }),
  ingredient({ id: "whey_protein", name: "Whey-proteïnepoeder", category: "supplement", state: "poeder", per100: { kcal: 390, protein: 78, carbs: 8, fat: 6, fiber: 1 }, pricePer100g: 2.4, allergens: ["melk"], flags: VEGETARIAN, substitutions: ["pea_protein"], sourceStatus: "label-dependent", sourceNote: "Concentraat en isolaat verschillen; lactosevrij uitsluitend bij expliciete etiketvermelding." }),
  ingredient({ id: "pea_protein", name: "Erwtenproteïnepoeder", category: "supplement", state: "poeder", per100: { kcal: 380, protein: 78, carbs: 7, fat: 5, fiber: 4 }, pricePer100g: 2.1, substitutions: ["whey_protein"], sourceStatus: "label-dependent", sourceNote: "Aminozuurprofiel, toevoegingen en waarden verschillen per merk." }),

  // Eieren, plantaardige eiwitten en peulvruchten.
  ingredient({ id: "egg", name: "Heel ei", category: "eieren", state: "rauw, eetbaar deel", per100: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0 }, pricePer100g: 0.48, allergens: ["ei"], flags: { ...VEGETARIAN, lactoseFree: true }, substitutions: ["egg_white", "tofu_firm"] }),
  ingredient({ id: "egg_white", name: "Vloeibaar eiwit", category: "eieren", state: "rauw/gepasteuriseerd", per100: { kcal: 48, protein: 10.5, carbs: 0.7, fat: 0.2, fiber: 0 }, pricePer100g: 0.65, allergens: ["ei"], flags: { ...VEGETARIAN, lactoseFree: true }, substitutions: ["egg"], sourceStatus: "label-dependent", sourceNote: "Waarde voor vloeibaar eiwit zonder smaaktoevoeging." }),
  ingredient({ id: "tofu_firm", name: "Stevige tofu", category: "plantaardig eiwit", state: "uitgelekt/zoals verkocht", per100: { kcal: 145, protein: 15, carbs: 2, fat: 8.5, fiber: 1.5 }, pricePer100g: 0.75, allergens: ["soja"], substitutions: ["tempeh", "seitan", "chicken_breast_raw"], sourceStatus: "label-dependent", sourceNote: "Watergehalte en stollingsmiddel verschillen sterk per merk." }),
  ingredient({ id: "tofu_silken", name: "Zijden tofu", category: "plantaardig eiwit", state: "zoals verkocht", per100: { kcal: 60, protein: 6, carbs: 1.5, fat: 3.5, fiber: 0.5 }, pricePer100g: 0.85, allergens: ["soja"], substitutions: ["tofu_firm", "soy_yogurt_unsweetened"], sourceStatus: "label-dependent", sourceNote: "Watergehalte verschilt per merk." }),
  ingredient({ id: "tempeh", name: "Tempeh", category: "plantaardig eiwit", state: "zoals verkocht", per100: { kcal: 195, protein: 19, carbs: 8, fat: 11, fiber: 5 }, pricePer100g: 1, allergens: ["soja"], substitutions: ["tofu_firm", "seitan"] }),
  ingredient({ id: "seitan", name: "Seitan", category: "plantaardig eiwit", state: "zoals verkocht", per100: { kcal: 150, protein: 25, carbs: 8, fat: 2, fiber: 1 }, pricePer100g: 1.25, allergens: ["gluten"], flags: { ...VEGAN, glutenFree: false }, substitutions: ["tofu_firm", "tempeh"], sourceStatus: "label-dependent", sourceNote: "Marinade en receptuur verschillen per product." }),
  ingredient({ id: "edamame", name: "Edamame", category: "peulvruchten", state: "gekookt/gedopt", per100: { kcal: 122, protein: 11.5, carbs: 8.9, fat: 5.2, fiber: 5.2 }, pricePer100g: 0.75, allergens: ["soja"], substitutions: ["green_peas", "chickpeas_drained"] }),
  ingredient({ id: "chickpeas_drained", name: "Kikkererwten", category: "peulvruchten", state: "uitgelekt", per100: { kcal: 139, protein: 7.3, carbs: 18.7, fat: 2.4, fiber: 6.4 }, pricePer100g: 0.35, substitutions: ["lentils_drained", "white_beans_drained"] }),
  ingredient({ id: "lentils_drained", name: "Linzen", category: "peulvruchten", state: "uitgelekt", per100: { kcal: 116, protein: 8.8, carbs: 14, fat: 0.7, fiber: 7.9 }, pricePer100g: 0.35, substitutions: ["chickpeas_drained", "kidney_beans_drained"] }),
  ingredient({ id: "kidney_beans_drained", name: "Kidneybonen", category: "peulvruchten", state: "uitgelekt", per100: { kcal: 110, protein: 7.5, carbs: 14.5, fat: 0.6, fiber: 6.5 }, pricePer100g: 0.32, substitutions: ["black_beans_drained", "white_beans_drained"] }),
  ingredient({ id: "black_beans_drained", name: "Zwarte bonen", category: "peulvruchten", state: "uitgelekt", per100: { kcal: 115, protein: 7.6, carbs: 16, fat: 0.6, fiber: 6.9 }, pricePer100g: 0.42, substitutions: ["kidney_beans_drained", "chickpeas_drained"] }),
  ingredient({ id: "white_beans_drained", name: "Witte bonen", category: "peulvruchten", state: "uitgelekt", per100: { kcal: 106, protein: 7, carbs: 14, fat: 0.5, fiber: 6.3 }, pricePer100g: 0.32, substitutions: ["kidney_beans_drained", "chickpeas_drained"] }),
  ingredient({ id: "green_peas", name: "Doperwten", category: "peulvruchten", state: "gekookt", per100: { kcal: 81, protein: 5.4, carbs: 10.5, fat: 0.4, fiber: 5.1 }, pricePer100g: 0.25, substitutions: ["edamame", "corn"] }),

  // Vlees: alle waarden gelden voor het rauwe product tenzij anders vermeld.
  ingredient({ id: "chicken_breast_raw", name: "Kipfilet", category: "vlees", state: "rauw", per100: { kcal: 110, protein: 23, carbs: 0, fat: 1.5, fiber: 0 }, pricePer100g: 1.05, flags: ANIMAL, substitutions: ["turkey_mince_raw", "tofu_firm", "cod_raw"] }),
  ingredient({ id: "chicken_thigh_raw", name: "Kippendij zonder vel", category: "vlees", state: "rauw", per100: { kcal: 145, protein: 19, carbs: 0, fat: 7.5, fiber: 0 }, pricePer100g: 0.85, flags: ANIMAL, substitutions: ["chicken_breast_raw", "pork_tenderloin_raw"] }),
  ingredient({ id: "turkey_mince_raw", name: "Mager kalkoengehakt", category: "vlees", state: "rauw", per100: { kcal: 150, protein: 21, carbs: 0, fat: 7, fiber: 0 }, pricePer100g: 1.15, flags: ANIMAL, substitutions: ["chicken_breast_raw", "beef_mince_lean_raw"] }),
  ingredient({ id: "turkey_slices", name: "Kalkoenfiletbeleg", category: "vleeswaren", state: "zoals verkocht", per100: { kcal: 110, protein: 20, carbs: 2, fat: 2, fiber: 0 }, pricePer100g: 1.8, flags: ANIMAL, substitutions: ["chicken_breast_raw", "tuna_water_drained"], sourceStatus: "label-dependent", sourceNote: "Zout, bindmiddelen en allergenen verschillen sterk per vleeswaar." }),
  ingredient({ id: "beef_mince_lean_raw", name: "Mager rundergehakt", category: "vlees", state: "rauw", per100: { kcal: 175, protein: 21, carbs: 0, fat: 10, fiber: 0 }, pricePer100g: 1.25, flags: ANIMAL, substitutions: ["turkey_mince_raw", "pork_mince_lean_raw", "lentils_drained"] }),
  ingredient({ id: "beef_strips_raw", name: "Runderreepjes", category: "vlees", state: "rauw", per100: { kcal: 145, protein: 22, carbs: 0, fat: 6, fiber: 0 }, pricePer100g: 1.65, flags: ANIMAL, substitutions: ["chicken_breast_raw", "seitan"] }),
  ingredient({ id: "pork_tenderloin_raw", name: "Varkenshaas", category: "vlees", state: "rauw", per100: { kcal: 120, protein: 22, carbs: 0, fat: 3.5, fiber: 0 }, pricePer100g: 1.35, flags: ANIMAL, substitutions: ["chicken_breast_raw", "beef_strips_raw"] }),
  ingredient({ id: "pork_mince_lean_raw", name: "Mager varkensgehakt", category: "vlees", state: "rauw", per100: { kcal: 190, protein: 20, carbs: 0, fat: 12, fiber: 0 }, pricePer100g: 0.95, flags: ANIMAL, substitutions: ["turkey_mince_raw", "beef_mince_lean_raw"] }),

  // Vis en zeevruchten.
  ingredient({ id: "salmon_raw", name: "Zalmfilet", category: "vis", state: "rauw", per100: { kcal: 208, protein: 20, carbs: 0, fat: 13.5, fiber: 0 }, pricePer100g: 2.1, allergens: ["vis"], flags: ANIMAL, substitutions: ["mackerel_raw", "cod_raw"] }),
  ingredient({ id: "cod_raw", name: "Kabeljauwfilet", category: "vis", state: "rauw", per100: { kcal: 82, protein: 18, carbs: 0, fat: 0.7, fiber: 0 }, pricePer100g: 1.75, allergens: ["vis"], flags: ANIMAL, substitutions: ["tilapia_raw", "chicken_breast_raw"] }),
  ingredient({ id: "tuna_water_drained", name: "Tonijn in water", category: "vis", state: "uitgelekt", per100: { kcal: 116, protein: 26, carbs: 0, fat: 1, fiber: 0 }, pricePer100g: 1.55, allergens: ["vis"], flags: ANIMAL, substitutions: ["chicken_breast_raw", "sardines_drained"], sourceStatus: "label-dependent", sourceNote: "Waarden en zout verschillen per merk; gebruik uitgelekt gewicht." }),
  ingredient({ id: "shrimp_raw", name: "Garnalen", category: "schaaldieren", state: "rauw/gepeld", per100: { kcal: 85, protein: 20, carbs: 0.5, fat: 0.5, fiber: 0 }, pricePer100g: 1.9, allergens: ["schaaldieren"], flags: ANIMAL, substitutions: ["cod_raw", "chicken_breast_raw"] }),
  ingredient({ id: "mackerel_raw", name: "Makreelfilet", category: "vis", state: "rauw", per100: { kcal: 205, protein: 19, carbs: 0, fat: 14, fiber: 0 }, pricePer100g: 1.6, allergens: ["vis"], flags: ANIMAL, substitutions: ["salmon_raw", "sardines_drained"] }),
  ingredient({ id: "tilapia_raw", name: "Tilapiafilet", category: "vis", state: "rauw", per100: { kcal: 96, protein: 20, carbs: 0, fat: 1.7, fiber: 0 }, pricePer100g: 1.3, allergens: ["vis"], flags: ANIMAL, substitutions: ["cod_raw"] }),
  ingredient({ id: "mussels_cooked", name: "Mosselen", category: "weekdieren", state: "gekookt, zonder schelp", per100: { kcal: 172, protein: 24, carbs: 7, fat: 4.5, fiber: 0 }, pricePer100g: 1.25, allergens: ["weekdieren"], flags: ANIMAL, substitutions: ["shrimp_raw", "cod_raw"] }),
  ingredient({ id: "sardines_drained", name: "Sardines uit blik", category: "vis", state: "uitgelekt", per100: { kcal: 208, protein: 25, carbs: 0, fat: 11, fiber: 0 }, pricePer100g: 1.35, allergens: ["vis"], flags: ANIMAL, substitutions: ["mackerel_raw", "tuna_water_drained"], sourceStatus: "label-dependent", sourceNote: "Olie, saus, graat en zout verschillen per product; gebruik uitgelekt gewicht." }),
  ingredient({ id: "smoked_salmon", name: "Gerookte zalm", category: "vis", state: "zoals verkocht", per100: { kcal: 180, protein: 22, carbs: 0, fat: 10, fiber: 0 }, pricePer100g: 3.1, allergens: ["vis"], flags: ANIMAL, substitutions: ["salmon_raw", "mackerel_raw"], sourceStatus: "label-dependent", sourceNote: "Zout en vetgehalte verschillen per product." }),
  ingredient({ id: "pollock_raw", name: "Koolvisfilet", category: "vis", state: "rauw", per100: { kcal: 92, protein: 19, carbs: 0, fat: 1.3, fiber: 0 }, pricePer100g: 1.1, allergens: ["vis"], flags: ANIMAL, substitutions: ["cod_raw", "tilapia_raw"] }),

  // Groenten.
  ingredient({ id: "broccoli", name: "Broccoli", category: "groenten", state: "rauw", per100: { kcal: 34, protein: 2.8, carbs: 4, fat: 0.4, fiber: 2.6 }, pricePer100g: 0.35, substitutions: ["cauliflower", "green_beans"] }),
  ingredient({ id: "cauliflower", name: "Bloemkool", category: "groenten", state: "rauw", per100: { kcal: 25, protein: 1.9, carbs: 3, fat: 0.3, fiber: 2 }, pricePer100g: 0.3, substitutions: ["broccoli", "zucchini"] }),
  ingredient({ id: "spinach", name: "Spinazie", category: "groenten", state: "rauw", per100: { kcal: 23, protein: 2.9, carbs: 1.4, fat: 0.4, fiber: 2.2 }, pricePer100g: 0.55, substitutions: ["lettuce", "cabbage_white"] }),
  ingredient({ id: "lettuce", name: "Sla", category: "groenten", state: "rauw", per100: { kcal: 15, protein: 1.4, carbs: 1.5, fat: 0.2, fiber: 1.3 }, pricePer100g: 0.4, substitutions: ["spinach", "cabbage_white"] }),
  ingredient({ id: "tomato", name: "Tomaat", category: "groenten", state: "rauw", per100: { kcal: 18, protein: 0.9, carbs: 2.6, fat: 0.2, fiber: 1.2 }, pricePer100g: 0.35, substitutions: ["bell_pepper", "cucumber"] }),
  ingredient({ id: "cucumber", name: "Komkommer", category: "groenten", state: "rauw", per100: { kcal: 15, protein: 0.7, carbs: 2.2, fat: 0.1, fiber: 0.5 }, pricePer100g: 0.22, substitutions: ["tomato", "zucchini"] }),
  ingredient({ id: "bell_pepper", name: "Paprika", category: "groenten", state: "rauw", per100: { kcal: 28, protein: 1, carbs: 4.5, fat: 0.3, fiber: 2 }, pricePer100g: 0.55, substitutions: ["zucchini", "tomato"] }),
  ingredient({ id: "zucchini", name: "Courgette", category: "groenten", state: "rauw", per100: { kcal: 17, protein: 1.2, carbs: 2.2, fat: 0.3, fiber: 1 }, pricePer100g: 0.3, substitutions: ["eggplant", "bell_pepper"] }),
  ingredient({ id: "eggplant", name: "Aubergine", category: "groenten", state: "rauw", per100: { kcal: 25, protein: 1, carbs: 3, fat: 0.2, fiber: 3 }, pricePer100g: 0.42, substitutions: ["zucchini", "mushrooms"] }),
  ingredient({ id: "carrot", name: "Wortel", category: "groenten", state: "rauw", per100: { kcal: 41, protein: 0.9, carbs: 7, fat: 0.2, fiber: 2.8 }, pricePer100g: 0.16, substitutions: ["pumpkin", "beet"] }),
  ingredient({ id: "onion", name: "Ui", category: "groenten", state: "rauw", per100: { kcal: 40, protein: 1.1, carbs: 8, fat: 0.1, fiber: 1.7 }, pricePer100g: 0.14, substitutions: ["leek"] }),
  ingredient({ id: "garlic", name: "Knoflook", category: "groenten", state: "rauw", per100: { kcal: 149, protein: 6.4, carbs: 30, fat: 0.5, fiber: 2.1 }, pricePer100g: 0.75, substitutions: [] }),
  ingredient({ id: "mushrooms", name: "Champignons", category: "groenten", state: "rauw", per100: { kcal: 22, protein: 3.1, carbs: 0.5, fat: 0.3, fiber: 1 }, pricePer100g: 0.45, substitutions: ["zucchini", "eggplant"] }),
  ingredient({ id: "green_beans", name: "Sperziebonen", category: "groenten", state: "rauw", per100: { kcal: 31, protein: 1.8, carbs: 4.5, fat: 0.2, fiber: 3.4 }, pricePer100g: 0.38, substitutions: ["broccoli", "asparagus"] }),
  ingredient({ id: "corn", name: "Maïs", category: "groenten", state: "uitgelekt", per100: { kcal: 86, protein: 3.2, carbs: 16, fat: 1.2, fiber: 2.7 }, pricePer100g: 0.32, substitutions: ["green_peas", "edamame"] }),
  ingredient({ id: "cabbage_white", name: "Witte kool", category: "groenten", state: "rauw", per100: { kcal: 25, protein: 1.3, carbs: 3.5, fat: 0.1, fiber: 2.5 }, pricePer100g: 0.16, substitutions: ["lettuce", "spinach"] }),
  ingredient({ id: "celery", name: "Bleekselderij", category: "groenten", state: "rauw", per100: { kcal: 16, protein: 0.7, carbs: 1.4, fat: 0.2, fiber: 1.6 }, pricePer100g: 0.3, allergens: ["selderij"], substitutions: ["cucumber"] }),
  ingredient({ id: "leek", name: "Prei", category: "groenten", state: "rauw", per100: { kcal: 31, protein: 1.5, carbs: 4.5, fat: 0.3, fiber: 1.8 }, pricePer100g: 0.28, substitutions: ["onion"] }),
  ingredient({ id: "pumpkin", name: "Pompoen", category: "groenten", state: "rauw", per100: { kcal: 26, protein: 1, carbs: 5, fat: 0.1, fiber: 0.5 }, pricePer100g: 0.3, substitutions: ["sweet_potato_raw", "carrot"] }),
  ingredient({ id: "beet", name: "Rode biet", category: "groenten", state: "gekookt", per100: { kcal: 44, protein: 1.7, carbs: 8, fat: 0.2, fiber: 2 }, pricePer100g: 0.3, substitutions: ["carrot", "pumpkin"] }),
  ingredient({ id: "stirfry_vegetables", name: "Roerbakgroentenmix", category: "groenten", state: "rauw/diepvries", per100: { kcal: 35, protein: 2, carbs: 4.5, fat: 0.5, fiber: 2.5 }, pricePer100g: 0.4, substitutions: ["broccoli", "bell_pepper"], sourceStatus: "label-dependent", sourceNote: "De exacte groentesamenstelling verschilt per zak." }),
  ingredient({ id: "asparagus", name: "Asperges", category: "groenten", state: "rauw", per100: { kcal: 20, protein: 2.2, carbs: 2, fat: 0.1, fiber: 2.1 }, pricePer100g: 0.85, substitutions: ["green_beans", "broccoli"] }),

  // Fruit.
  ingredient({ id: "banana", name: "Banaan", category: "fruit", state: "rauw, zonder schil", per100: { kcal: 89, protein: 1.1, carbs: 20, fat: 0.3, fiber: 2.6 }, pricePer100g: 0.2, substitutions: ["apple", "mango"] }),
  ingredient({ id: "apple", name: "Appel", category: "fruit", state: "rauw", per100: { kcal: 52, protein: 0.3, carbs: 11.6, fat: 0.2, fiber: 2.4 }, pricePer100g: 0.25, substitutions: ["orange", "banana"] }),
  ingredient({ id: "strawberry", name: "Aardbei", category: "fruit", state: "rauw", per100: { kcal: 32, protein: 0.7, carbs: 5.7, fat: 0.3, fiber: 2 }, pricePer100g: 0.75, substitutions: ["blueberry", "mixed_berries"] }),
  ingredient({ id: "blueberry", name: "Blauwe bes", category: "fruit", state: "rauw", per100: { kcal: 57, protein: 0.7, carbs: 12, fat: 0.3, fiber: 2.4 }, pricePer100g: 1.1, substitutions: ["strawberry", "mixed_berries"] }),
  ingredient({ id: "mixed_berries", name: "Gemengd rood fruit", category: "fruit", state: "diepvries/rauw", per100: { kcal: 45, protein: 1, carbs: 8, fat: 0.4, fiber: 4 }, pricePer100g: 0.6, substitutions: ["strawberry", "blueberry"], sourceStatus: "label-dependent", sourceNote: "De fruitmix verschilt per product." }),
  ingredient({ id: "mango", name: "Mango", category: "fruit", state: "rauw, zonder schil/pit", per100: { kcal: 60, protein: 0.8, carbs: 13.5, fat: 0.4, fiber: 1.6 }, pricePer100g: 0.65, substitutions: ["pineapple", "banana"] }),
  ingredient({ id: "pineapple", name: "Ananas", category: "fruit", state: "rauw, eetbaar deel", per100: { kcal: 50, protein: 0.5, carbs: 11.8, fat: 0.1, fiber: 1.4 }, pricePer100g: 0.45, substitutions: ["mango", "orange"] }),
  ingredient({ id: "orange", name: "Sinaasappel", category: "fruit", state: "rauw, zonder schil", per100: { kcal: 47, protein: 0.9, carbs: 9.4, fat: 0.1, fiber: 2.4 }, pricePer100g: 0.25, substitutions: ["kiwi", "apple"] }),
  ingredient({ id: "kiwi", name: "Kiwi", category: "fruit", state: "rauw, zonder schil", per100: { kcal: 61, protein: 1.1, carbs: 11.7, fat: 0.5, fiber: 3 }, pricePer100g: 0.55, substitutions: ["orange", "strawberry"] }),
  ingredient({ id: "grapes", name: "Druiven", category: "fruit", state: "rauw", per100: { kcal: 69, protein: 0.7, carbs: 17, fat: 0.2, fiber: 0.9 }, pricePer100g: 0.45, substitutions: ["apple", "blueberry"] }),
  ingredient({ id: "dates", name: "Dadels", category: "fruit", state: "gedroogd, zonder pit", per100: { kcal: 282, protein: 2.5, carbs: 68, fat: 0.4, fiber: 8 }, pricePer100g: 0.85, substitutions: ["maple_syrup"] }),
  ingredient({ id: "lemon", name: "Citroen", category: "fruit", state: "rauw, sap en vruchtvlees", per100: { kcal: 29, protein: 1.1, carbs: 6.5, fat: 0.3, fiber: 2.8 }, pricePer100g: 0.45, substitutions: [] }),

  // Vetten, noten en zaden.
  ingredient({ id: "olive_oil", name: "Olijfolie", category: "vetten", state: "zoals verkocht", per100: { kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0 }, pricePer100g: 1.1, substitutions: ["rapeseed_oil"], sourceStatus: "label-dependent", sourceNote: "Prijs en type olie verschillen; energiewaarde is een generieke olie-startwaarde." }),
  ingredient({ id: "rapeseed_oil", name: "Koolzaadolie", category: "vetten", state: "zoals verkocht", per100: { kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0 }, pricePer100g: 0.55, substitutions: ["olive_oil"], sourceStatus: "label-dependent", sourceNote: "Prijs en type olie verschillen; energiewaarde is een generieke olie-startwaarde." }),
  ingredient({ id: "peanut_butter", name: "Pindakaas", category: "notenpasta", state: "zoals verkocht", per100: { kcal: 620, protein: 26, carbs: 12, fat: 50, fiber: 8 }, pricePer100g: 0.65, allergens: ["pinda"], substitutions: ["almonds", "cashews"], sourceStatus: "label-dependent", sourceNote: "Toegevoegde olie, suiker en zout verschillen per merk." }),
  ingredient({ id: "almonds", name: "Amandelen", category: "noten", state: "ongezouten", per100: { kcal: 579, protein: 21, carbs: 9, fat: 50, fiber: 12.5 }, pricePer100g: 1.3, allergens: ["noten"], substitutions: ["walnuts", "cashews"] }),
  ingredient({ id: "walnuts", name: "Walnoten", category: "noten", state: "ongezouten", per100: { kcal: 654, protein: 15, carbs: 7, fat: 65, fiber: 6.7 }, pricePer100g: 1.4, allergens: ["noten"], substitutions: ["almonds", "cashews"] }),
  ingredient({ id: "cashews", name: "Cashewnoten", category: "noten", state: "ongezouten", per100: { kcal: 553, protein: 18, carbs: 27, fat: 44, fiber: 3.3 }, pricePer100g: 1.35, allergens: ["noten"], substitutions: ["almonds", "walnuts"] }),
  ingredient({ id: "chia_seeds", name: "Chiazaad", category: "zaden", state: "droog", per100: { kcal: 486, protein: 17, carbs: 8, fat: 31, fiber: 34 }, pricePer100g: 1, substitutions: ["flaxseed"] }),
  ingredient({ id: "flaxseed", name: "Lijnzaad", category: "zaden", state: "droog", per100: { kcal: 534, protein: 18, carbs: 2, fat: 42, fiber: 27 }, pricePer100g: 0.65, substitutions: ["chia_seeds"] }),
  ingredient({ id: "sesame_seeds", name: "Sesamzaad", category: "zaden", state: "droog", per100: { kcal: 573, protein: 18, carbs: 12, fat: 50, fiber: 12 }, pricePer100g: 0.85, allergens: ["sesam"], substitutions: ["chia_seeds"] }),
  ingredient({ id: "avocado", name: "Avocado", category: "vetrijke vruchten", state: "rauw, zonder schil/pit", per100: { kcal: 160, protein: 2, carbs: 1.8, fat: 14.7, fiber: 6.7 }, pricePer100g: 0.8, substitutions: ["olive_oil", "hummus"] }),

  // Sauzen, smaakmakers en voorraadproducten.
  ingredient({ id: "passata", name: "Passata", category: "sauzen", state: "zoals verkocht", per100: { kcal: 30, protein: 1.5, carbs: 4.5, fat: 0.2, fiber: 1.5 }, pricePer100g: 0.18, substitutions: ["diced_tomatoes"], sourceStatus: "label-dependent", sourceNote: "Zout en concentratie verschillen per merk." }),
  ingredient({ id: "diced_tomatoes", name: "Tomatenblokjes uit blik", category: "conserven", state: "zoals verkocht", per100: { kcal: 24, protein: 1.2, carbs: 3.5, fat: 0.2, fiber: 1.5 }, pricePer100g: 0.2, substitutions: ["passata", "tomato"], sourceStatus: "label-dependent", sourceNote: "Zout en hoeveelheid sap verschillen per merk." }),
  ingredient({ id: "coconut_milk_light", name: "Lichte kokosmelk", category: "sauzen", state: "zoals verkocht", per100: { kcal: 75, protein: 0.8, carbs: 2.5, fat: 7, fiber: 0.5 }, pricePer100g: 0.45, substitutions: ["tofu_silken", "soy_yogurt_unsweetened"], sourceStatus: "label-dependent", sourceNote: "Vetgehalte varieert sterk; gebruik exact het etiket." }),
  ingredient({ id: "hummus", name: "Hummus", category: "sauzen", state: "zoals verkocht", per100: { kcal: 240, protein: 7, carbs: 14, fat: 17, fiber: 6 }, pricePer100g: 0.75, allergens: ["sesam"], substitutions: ["avocado", "chickpeas_drained"], sourceStatus: "label-dependent", sourceNote: "Olie-, tahin- en zoutgehalte verschillen sterk per merk." }),
  ingredient({ id: "soy_sauce", name: "Sojasaus", category: "sauzen", state: "zoals verkocht", per100: { kcal: 55, protein: 6, carbs: 5, fat: 0.1, fiber: 0 }, pricePer100g: 0.65, allergens: ["soja", "gluten"], flags: { ...VEGAN, glutenFree: false }, substitutions: [], sourceStatus: "label-dependent", sourceNote: "Zout en tarwe verschillen per product; glutenvrij alleen bij een passende tamari met etiketcontrole." }),
  ingredient({ id: "salsa", name: "Tomatensalsa", category: "sauzen", state: "zoals verkocht", per100: { kcal: 35, protein: 1.4, carbs: 6, fat: 0.3, fiber: 1.8 }, pricePer100g: 0.6, substitutions: ["passata", "diced_tomatoes"], sourceStatus: "label-dependent", sourceNote: "Suiker en zout verschillen per product." }),
  ingredient({ id: "sriracha", name: "Sriracha", category: "sauzen", state: "zoals verkocht", per100: { kcal: 95, protein: 1.2, carbs: 20, fat: 0.7, fiber: 1 }, pricePer100g: 0.85, substitutions: ["salsa"], sourceStatus: "label-dependent", sourceNote: "Suiker en zout verschillen per merk." }),
  ingredient({ id: "vegan_pesto", name: "Vegan pesto", category: "sauzen", state: "zoals verkocht", per100: { kcal: 430, protein: 4, carbs: 7, fat: 43, fiber: 2 }, pricePer100g: 1.4, substitutions: ["olive_oil", "hummus"], sourceStatus: "label-dependent", sourceNote: "Olie, noten en allergenen verschillen sterk; vegan claim op etiket controleren." }),
  ingredient({ id: "mustard", name: "Mosterd", category: "sauzen", state: "zoals verkocht", per100: { kcal: 66, protein: 4.4, carbs: 5.5, fat: 3.3, fiber: 3.3 }, pricePer100g: 0.55, allergens: ["mosterd"], substitutions: [], sourceStatus: "label-dependent", sourceNote: "Suiker en zout verschillen per product." }),
  ingredient({ id: "maple_syrup", name: "Ahornsiroop", category: "zoetmakers", state: "zoals verkocht", per100: { kcal: 260, protein: 0, carbs: 65, fat: 0, fiber: 0 }, pricePer100g: 1.8, substitutions: ["dates"], sourceStatus: "label-dependent", sourceNote: "Controleer of het product uit zuivere ahornsiroop bestaat." }),
  ingredient({ id: "cocoa_powder", name: "Ongezoet cacaopoeder", category: "smaakmakers", state: "poeder", per100: { kcal: 350, protein: 20, carbs: 14, fat: 21, fiber: 31 }, pricePer100g: 1.2, substitutions: [], sourceStatus: "label-dependent", sourceNote: "Vet- en vezelgehalte verschillen per cacaopoeder." }),
  ingredient({ id: "vegetable_broth", name: "Bereide groentebouillon", category: "voorraad", state: "bereid", per100: { kcal: 5, protein: 0.2, carbs: 0.6, fat: 0.1, fiber: 0 }, pricePer100g: 0.05, allergens: ["selderij"], substitutions: [], sourceStatus: "label-dependent", sourceNote: "Bereid volgens etiket; zout en allergenen verschillen sterk." }),
  ingredient({ id: "curry_paste", name: "Currypasta", category: "smaakmakers", state: "zoals verkocht", per100: { kcal: 120, protein: 3, carbs: 15, fat: 5, fiber: 3 }, pricePer100g: 1.25, substitutions: ["taco_seasoning"], sourceStatus: "label-dependent", sourceNote: "Olie, suiker, zout, schaaldieren en andere allergenen kunnen per product verschillen." }),
  ingredient({ id: "taco_seasoning", name: "Tacokruiden", category: "smaakmakers", state: "droog", per100: { kcal: 280, protein: 10, carbs: 45, fat: 5, fiber: 15 }, pricePer100g: 1.5, substitutions: ["smoked_paprika"], sourceStatus: "label-dependent", sourceNote: "Zout, zetmeel en allergenen verschillen per kruidenmix." }),
  ingredient({ id: "smoked_paprika", name: "Gerookt paprikapoeder", category: "smaakmakers", state: "droog", per100: { kcal: 282, protein: 14, carbs: 34, fat: 13, fiber: 35 }, pricePer100g: 2, substitutions: ["taco_seasoning"], sourceStatus: "label-dependent", sourceNote: "In recepten wordt slechts een kleine hoeveelheid gebruikt." }),
  ingredient({ id: "cinnamon", name: "Kaneel", category: "smaakmakers", state: "droog", per100: { kcal: 247, protein: 4, carbs: 28, fat: 1.2, fiber: 53 }, pricePer100g: 1.8, substitutions: [], sourceStatus: "label-dependent", sourceNote: "In recepten wordt slechts een kleine hoeveelheid gebruikt." }),
];

export const INGREDIENTS_BY_ID = Object.freeze(
  Object.fromEntries(INGREDIENTS.map((item) => [item.id, item])),
);
