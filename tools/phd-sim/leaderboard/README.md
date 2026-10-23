# PhD Simulator leaderboard

A Cloudflare Worker with a D1 database for the game's public leaderboard: a daily board (everyone plays
the same daily PhD) and an all-time board, each keeping one best run per player. It runs on Cloudflare's
free plan, on the same account as bingshengyao.com, at `https://api.bingshengyao.com`.

**How results are checked.** The game sends the run's result with its share code (the code that opens the
result card). The Worker checks that the result is well formed and says the same as the code, keeps the
same run from going on twice, and limits submissions per hour. Results aren't replayed (Arthur,
2026-10-23). The run's recorded choices are stored with each entry, so a replay check could be added later
if fake entries become a problem.

- `src/worker.js`: the whole Worker: `GET /api/board`, `GET /api/runs` (every run, compact, for the
  all-time chart), `GET /api/run` (one run's share code), `POST /api/submit`, `POST /api/admin`, the
  checks, nicknames and rate limits. It creates its tables on first use, so a new database needs no setup step.
- `wrangler.toml`: the Worker's name, the D1 binding, the `api.bingshengyao.com` domain and the allowed
  pages.
- `admin.mjs`: list the boards, and rename, remove or ban a player.
- `test/worker.test.mjs`: the Worker in Cloudflare's local runtime (Miniflare) with a real local D1, fed
  with runs played by the game's engine. Run it with `npm test`.

## Setting it up (once)

1. **Database.** In the Cloudflare dashboard, open *Storage & Databases → D1 SQL Database → Create* and
   name it `phd-sim-board`. Copy its *Database ID* into `wrangler.toml` (`database_id = "…"`) and push, or
   send the ID to Claude.
2. **Worker, deployed from GitHub.** Open *Workers & Pages → Create → Import a repository*, connect GitHub
   and pick `WorkInTheDark/WorkInTheDark.github.io`.
   - Project name: `phd-sim-board` (the same as `name` in `wrangler.toml`).
   - Root directory: `tools/phd-sim/leaderboard`.
   - Build command: leave empty. Deploy command: `npx wrangler deploy`.
   - Optional: under *Build watch paths*, include only `tools/phd-sim/leaderboard/*`, so blog posts don't
     redeploy it.

   From then on, a push that changes this folder redeploys the Worker. The first deploy also creates
   `api.bingshengyao.com` (the `routes` line in `wrangler.toml`).
3. **Secrets.** In the Worker, open *Settings → Variables and Secrets* and add two secrets:
   - `ADMIN_TOKEN`: a long random string (`openssl rand -hex 24`). Keep it private.
   - `HASH_SALT`: another random string.
4. **Check.** `https://api.bingshengyao.com/api/board?kind=all` should answer
   `{"ok":true,"kind":"all",...,"total":0,"entries":[]}`.
5. **Turn it on in the game.** In the site's `_config.yml`, set
   `phd_sim_board: "https://api.bingshengyao.com"` and push. The title screen then shows *Leaderboard*, and
   the end screen offers to submit.

**From the command line instead of steps 1 to 3.** Run these in this folder (Node 20.3 or later):

- `npm install`
- `npx wrangler login`
- `npx wrangler d1 create phd-sim-board`, then put the ID it prints into `wrangler.toml`
- `npx wrangler deploy`
- `npx wrangler secret put ADMIN_TOKEN`
- `npx wrangler secret put HASH_SALT`

## Running it locally

```
cd tools/phd-sim/leaderboard
npm install
printf 'ALLOWED_ORIGINS="http://127.0.0.1:8766"\nADMIN_TOKEN="local-admin-token-0000"\nHASH_SALT="local"\n' > .dev.vars
npm run dev      # http://localhost:8787, with a local D1 in .wrangler/
npm test         # needs ruby tools/phd-sim/export-data.rb first
```

The dev page (`tools/phd-sim/dev/`, served by `serve.py` on port 8766) points at `http://127.0.0.1:8787`.

## Looking after the boards

```
BOARD_URL=https://api.bingshengyao.com node tools/phd-sim/leaderboard/admin.mjs list all
BOARD_URL=... node tools/phd-sim/leaderboard/admin.mjs list daily 2026-10-23
BOARD_URL=... ADMIN_TOKEN=... node tools/phd-sim/leaderboard/admin.mjs rename <id> "New name"
BOARD_URL=... ADMIN_TOKEN=... node tools/phd-sim/leaderboard/admin.mjs remove <id>     # or ban / unban
# remove and ban also delete the player's runs, so they leave the chart too
```

`<id>` is the short player id that `list` prints. Nicknames are limited to 20 characters, and links,
markup and a short list of slurs are refused.

## What's stored

- **For each player:** a random id their browser made up, a short public id, their nickname, and a banned flag.
- **For each submitted run:** the result (score, ending, title, years, papers, citations, h-index, the
  day for a daily run), its share code, the language, the time, and the recorded choices.
- **Rate limits:** counters keyed by a salted hash of the IP address. They reset every hour. Addresses
  themselves are never stored.

## Limits

- 30 submissions per IP address and 20 per player per hour.
- A daily run can be submitted up to a week after its day.
- Board views are cached for 20 seconds and the chart's runs for 60, except a player's own place. A new
  run or an admin change clears them in that Cloudflare data center, so whoever submitted sees their run
  at once; elsewhere it shows when the cached copy runs out.
- Cloudflare's free plan allows 100,000 requests a day; D1's allows 5 million rows read and 100,000
  written a day, and 5 GB. That's far more than the game needs.
