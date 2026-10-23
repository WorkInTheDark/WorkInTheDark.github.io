// Settings, from the environment (Vercel project settings, or dev-server.mjs locally).
const env = typeof process !== "undefined" ? process.env : {};

// Where the game lives: the server plays submitted runs with the same code and data players load,
// fetched from the site, so a game update never needs a leaderboard update.
export const SITE = (env.PHDSIM_SITE || "https://www.bingshengyao.com").replace(/\/$/, "");
export const DATA_URL = env.PHDSIM_DATA || SITE + "/assets/phd-sim/data.json";

// Pages allowed to call the API.
export const ORIGINS = (env.ALLOWED_ORIGINS || "https://www.bingshengyao.com,https://bingshengyao.com")
  .split(",").map(function (s) { return s.trim(); }).filter(Boolean);

// Upstash Redis (the Vercel marketplace integration sets one of these pairs).
export const REDIS_URL = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || "";
export const REDIS_TOKEN = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || "";

// For removing or renaming entries (admin.mjs). Without it, the admin endpoint is off.
export const ADMIN_TOKEN = env.ADMIN_TOKEN || "";
// Mixed into the hash of a visitor's IP address, which is only used for rate limits.
export const SALT = env.HASH_SALT || "phd-sim";

export const LIMITS = {
  perIpHour: 30,      // submissions per IP address per hour
  perPlayerHour: 20,  // submissions per player per hour
  dailyLateDays: 7,   // a daily run can be submitted up to a week after its day
  boardSize: 100      // the most entries one board request returns
};
