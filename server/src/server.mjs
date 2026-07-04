// server.mjs — entrypoint: read env, createApp().listen(PORT), flush + close
// on SIGTERM/SIGINT. Everything testable lives in app.mjs; this file only
// wires the process to the outside world.

import { createApp } from './app.mjs';

const port = Number(process.env.PORT ?? 3000);
const dataFile = process.env.LEADERBOARD_DATA_FILE ?? '/data/leaderboard.json';
const ttlDays = Number(process.env.LEADERBOARD_TTL_DAYS ?? 90);
const maxEntries = Number(process.env.LEADERBOARD_MAX_ENTRIES ?? 100_000);
const rateLimits = {
  submitPerMin: Number(process.env.RATE_SUBMIT_PER_MIN ?? 10),
  readPerMin: Number(process.env.RATE_READ_PER_MIN ?? 60),
};

const app = createApp({ dataFile, ttlDays, maxEntries, rateLimits });

app.listen(port, () => {
  console.log(`[leaderboard] listening on :${port} (data: ${dataFile}, ttl: ${ttlDays}d, max: ${maxEntries} entries, limits: ${rateLimits.submitPerMin}/${rateLimits.readPerMin} per min)`);
});

let shuttingDown = false;
/** @param {string} signal */
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[leaderboard] ${signal} — flushing and closing`);
  /** @type {any} */ (app).flushNow();
  // Node >= 18.2: drop keep-alive sockets so close() completes promptly.
  /** @type {any} */ (app).closeAllConnections?.();
  app.close(() => process.exit(0));
  // Belt and braces: never hang shutdown for more than 3s.
  setTimeout(() => process.exit(0), 3000).unref?.();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
