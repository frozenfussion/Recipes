// Small shared state for the single page. Lost on refresh, which is fine:
// everything important lives in the database (except the diet choices, see cook.js).
export const state = {
  currentId: null, // the session shown on the Recipe screen
  backTo: 'home', // where the Back button on the Recipe screen goes: home, history or saved
  cook: freshCook(), // what the Cook screen has typed so far
};

function freshCook() {
  return { ingredients: [], photos: [], want: '', cuisine: '', servings: '', time: '', spice: '' };
}

// "New session" clears what was typed on the Cook screen (the diet choices are kept on purpose).
export function resetCook() {
  state.cook = freshCook();
}
