import { createList, createSession } from './sessions.js';

// A small demo data set (the same dishes as the design mockup) so the screens have something
// to show without spending any API credit. Run it with `npm run seed`. Never runs by itself.
const day = (daysAgo) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

export function seedDemo(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n > 0) return { seeded: false };

  const weeknight = createList(db, 'Weeknight').id;
  const family = createList(db, 'Family favourites').id;

  const recipe = (title, emoji, time_minutes, tags, ingredients, steps) => ({
    title, emoji, time_minutes, servings: 2, tags, ingredients, steps, shopping_list: [], notes: '',
  });

  createSession(db, {
    status: 'draft', now: day(5),
    recipe: recipe('Lentil & Carrot Soup', '🍲', 40, ['Vegan'],
      ['1 cup red lentils', '2 carrots', '1 onion', '1 tsp cumin', '1 litre vegetable stock'],
      ['Soften the onion and carrots.', 'Add lentils, cumin and stock.', 'Simmer 25 minutes and blend.']),
    messages: [
      { role: 'assistant', content: 'Here is a simple soup from your pantry.' },
      { role: 'user', content: 'Can I use a stock cube?' },
      { role: 'assistant', content: 'Yes, one cube in 1 litre of hot water works well.' },
    ],
  });
  createSession(db, {
    status: 'saved', now: day(3),
    recipe: recipe('Garlic Prawn Linguine', '🍝', 25, ['Pescatarian'],
      ['250 g linguine', '300 g prawns', '4 cloves garlic', 'Parsley', 'Chilli flakes'],
      ['Boil the linguine.', 'Sizzle garlic and chilli in oil, add prawns.', 'Toss pasta through with a splash of pasta water.']),
    messages: [{ role: 'assistant', content: 'Quick and garlicky, ready in 25 minutes.' }],
  });
  createSession(db, {
    status: 'saved', listId: family, now: day(2),
    recipe: recipe('Chickpea Salad Bowl', '🥗', 15, ['Vegan'],
      ['1 can chickpeas', '1 cucumber', '2 tomatoes', '1 lemon', 'Olive oil'],
      ['Drain and rinse the chickpeas.', 'Chop the vegetables.', 'Toss everything with lemon and olive oil.']),
    messages: [{ role: 'assistant', content: 'A fresh, filling lunch bowl.' }],
  });
  createSession(db, {
    status: 'cooked', listId: weeknight, now: day(1),
    recipe: recipe('Chicken Biryani', '🍛', 60, ['Halal'],
      ['500 g chicken', '2 cups basmati rice', '2 onions', '1 cup yoghurt', 'Biryani spice mix'],
      ['Marinate the chicken in yoghurt and spices.', 'Fry the onions until deep golden.', 'Layer chicken and par-boiled rice.', 'Cover tightly and cook on low for 25 minutes.']),
    messages: [
      { role: 'assistant', content: 'Biryani it is! Start the marinade early.' },
      { role: 'user', content: 'The rice is sticking to the pan!' },
      { role: 'assistant', content: 'Lower the heat and add a splash of hot water. Do not stir; just cover and wait.' },
      { role: 'user', content: 'It worked, it is perfect!' },
    ],
  });
  createSession(db, {
    status: 'draft', now: day(0),
    prefs: { diets: ['Halal'], allergies: ['Nut-free'] },
    recipe: recipe('Garlicky Chicken & Spinach Rice', '🍗', 35, ['Halal', 'Nut-free'],
      ['400 g chicken thighs', '1 cup basmati rice', '150 g spinach', '½ cup yoghurt', '3 cloves garlic'],
      ['Marinate the chicken in yoghurt and garlic for 10 minutes.', 'Sear the chicken until golden, about 5 minutes per side.', 'Add rice and 2 cups water, cover and simmer 12 minutes.', 'Fold in the spinach and rest for 5 minutes.']),
    messages: [
      { role: 'assistant', content: "Here's a recipe from what's in your fridge! Shout if you hit a snag. 👨‍🍳" },
      { role: 'user', content: 'The shop only had Greek yoghurt. Is that OK?' },
      { role: 'assistant', content: "Perfect, even better. It's thicker, so loosen it with a splash of water." },
    ],
  });
  return { seeded: true };
}
