// How long we wait for a vendor before giving up with a clear message. The SDKs wait 10 minutes
// by default (and retry), which looks like a spinner that never stops when a connection stalls.
export const LIST_TIMEOUT_MS = 15_000; // model lists and key tests: small, quick calls
export const RECIPE_TIMEOUT_MS = 180_000; // a recipe can take a while, especially on the newest models
export const CHAT_TIMEOUT_MS = 120_000; // time to the first part of a chat answer
export const IMAGE_TIMEOUT_MS = 120_000; // picture generation
