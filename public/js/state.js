// Small shared state for the single page. Lost on refresh, which is fine:
// everything important lives in the database.
export const state = {
  currentId: null, // the session shown on the Recipe screen
  backTo: 'home', // where the Back button on the Recipe screen goes: home, history or saved
};
