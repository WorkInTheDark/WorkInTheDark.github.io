# PhD Simulator leaderboard

A small server for the game's public leaderboard: a daily board (everyone plays the same daily PhD) and
an all-time board, each keeping one best run per player.

**How a run is checked.** The game records every choice a player makes. When they submit a finished run,
this server plays the run again from its seed and choices, with the same game code and data players load
from the site, and only accepts it if it comes out with the result the player saw. The stored numbers are
the replay's, so a made-up score can't get on the board.

**Why it never needs updating for the game.** The server fetches the game's code and data from the live
site (`PHDSIM_SITE`) and replays with those. A game update on the site is picked up within ten minutes, or
at once if a run doesn't verify. A run started before an update and finished after it may not verify;
the game tells the player so.

- `api/submit.js`: POST a finished run. It's replayed, checked and ranked.
- `api/board.js`: GET a board (`?kind=daily&day=YYYY-MM-DD` or `?kind=all`).
- `api/admin.js`: remove, ban or rename a player (needs `ADMIN_TOKEN`; see `admin.mjs`).
- `lib/`: loading the live game (`game.js`), the boards in Redis (`boards.js`), nicknames, HTTP helpers.
- `dev-server.mjs`: runs it all locally with an in-memory store and the game from this checkout.

## Setting it up (once)

It runs on Vercel's free Hobby plan with Upstash Redis's free plan. A replay takes about 25 ms of CPU,
which is too much for Cloudflare Workers' free plan (10 ms), and well within Vercel's.

1. **Vercel.** Sign in at vercel.com with GitHub. Choose *Add New → Project* and import
   `WorkInTheDark/WorkInTheDark.github.io`.
   - Project name: for example `phd-sim-board`.
   - Framework preset: *Other*.
   - Root Directory: `tools/phd-sim/leaderboard`.
   - Leave the build and output settings empty, then deploy.
2. **Redis.** In the project, open *Storage → Create Database → Upstash for Redis* (Marketplace). Pick the
   free plan and connect it to the project. This adds the connection variables (`UPSTASH_REDIS_REST_URL`
   and `UPSTASH_REDIS_REST_TOKEN`, or `KV_REST_API_URL` and `KV_REST_API_TOKEN`).
3. **Settings → Environment Variables.** Add:
   - `ADMIN_TOKEN`: a long random string (`openssl rand -hex 24`). Keep it private.
   - `HASH_SALT`: another random string.
   - Optional: `ALLOWED_ORIGINS` (default: `https://www.bingshengyao.com,https://bingshengyao.com`) and
     `PHDSIM_SITE` (default: `https://www.bingshengyao.com`).
4. **Redeploy** (*Deployments → ⋯ → Redeploy*) so the variables apply. Then check
   `https://<project>.vercel.app/api/board?kind=all`, which should answer `{"ok":true, ..., "total":0, ...}`.
5. **Turn it on in the game.** In the site's `_config.yml`, set `phd_sim_board: "https://<project>.vercel.app"`
   and push. The title screen then shows *Leaderboard*, and the end screen offers to submit.

After that there's nothing to maintain. Vercel redeploys only when this folder changes (`ignoreCommand` in
`vercel.json`), and game updates need nothing here.

## Running it locally

```
ruby tools/phd-sim/export-data.rb
node tools/phd-sim/leaderboard/dev-server.mjs        # http://127.0.0.1:8790, in memory
```

The dev page (`tools/phd-sim/dev/`) points at this local server. The tests in
`tools/phd-sim/tests/leaderboard.test.mjs` and `replay.test.mjs` cover the replay and the endpoints.

## Looking after the boards

```
BOARD_URL=https://<project>.vercel.app node tools/phd-sim/leaderboard/admin.mjs list all
BOARD_URL=... node tools/phd-sim/leaderboard/admin.mjs list daily 2026-10-23
BOARD_URL=... ADMIN_TOKEN=... node tools/phd-sim/leaderboard/admin.mjs rename <id> "New name"
BOARD_URL=... ADMIN_TOKEN=... node tools/phd-sim/leaderboard/admin.mjs remove <id>     # or ban / unban
```

`<id>` is the short player id that `list` prints. Nicknames are limited to 20 characters, and links,
markup and a short list of slurs are refused.

## What's stored

- **For each player:** their nickname, their best runs (results only: score, ending, title, years, papers,
  citations, h-index, the day, and the share code that opens the result card), and a random id their
  browser made up.
- **Not stored:** run records (choices) are replayed and dropped, apart from a hash that stops the same run
  going on twice. IP addresses are kept only as a salted hash in rate-limit counters that expire after an hour.

## Limits

- 30 submissions per IP address and 20 per player per hour.
- A daily run can be submitted up to a week after its day.
- Board responses are cached for 20 seconds, except a player's own place.
- On the free plans, this handles tens of thousands of submissions and board views a month.
