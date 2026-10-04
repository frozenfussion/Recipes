// Reads PORT and HOST from the environment, or from a .env file if there is one.
// API keys are NOT configured here: they are entered on the Settings page.
try {
  process.loadEnvFile();
} catch {
  // No .env file is fine, the defaults below apply.
}

export const PORT = Number(process.env.PORT) || 3000;
// 127.0.0.1 means only this computer can open the app. Anything else is an explicit choice.
export const HOST = process.env.HOST || '127.0.0.1';
