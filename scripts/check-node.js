// Runs before the app (see the npm scripts) so a student with an old Node sees a
// plain message instead of a cryptic "unknown builtin module node:sqlite" crash.
// Keep this file simple: it must itself run on old versions of Node.
// 22.18 is the lowest version we have tested (import.meta.main arrived in 22.18).
const MIN_MAJOR = 22;
const MIN_MINOR = 18;

// A version can be passed in so the tests can try fake ones.
const version = process.argv[2] || process.versions.node;
const parts = version.split('.');
const major = Number(parts[0]);
const minor = Number(parts[1]);

if (major < MIN_MAJOR || (major === MIN_MAJOR && minor < MIN_MINOR)) {
  console.error(
    'Chef Buddy needs Node.js ' + MIN_MAJOR + '.' + MIN_MINOR + ' or newer, but this computer has ' + version + '.\n' +
    'Install the current LTS from https://nodejs.org (or run: winget install OpenJS.NodeJS.LTS),\n' +
    'then close this window, open a new one and try again.'
  );
  process.exit(1);
}
