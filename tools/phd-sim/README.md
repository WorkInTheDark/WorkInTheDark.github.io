# PhD Simulator tools

Local tooling for the game at `/phd-simulator/`. Nothing in `tools/` is published (it is in `exclude:` in `_config.yml`).

| Command (from the repo root) | What it does |
|---|---|
| `ruby tools/phd-sim/export-data.rb` | Exports `_data/phd_sim/` plus the PhD 101 topic map to `tools/phd-sim/out/data.json`, the same shape Jekyll renders at `/assets/phd-sim/data.json`. Run it after editing any YAML. |
| `node --experimental-default-type=module tools/phd-sim/validate.mjs` | Checks every event, condition, effect, token, schedule target, achievement and PhD 101 topic against `docs/phd-simulator/content-spec.md`. Exits non-zero on errors. |
| `node --experimental-default-type=module tools/phd-sim/simulate.mjs 300` | Plays 300 headless runs with four bot policies and prints graduation times, endings, acceptance rates, citations, burnouts, event overlap, pop-ups per week by type, how often "This week only" options come up, and what the sensible bot chose. Add `QSTATS=1` for paper quality by year. |
| `node --experimental-default-type=module --test tools/phd-sim/tests/` | Engine unit tests (determinism, save and reload, many full runs). |
| `node --experimental-default-type=module tools/phd-sim/simulate.mjs 5000 mixed --percentiles` | Rewrites `_data/phd_sim/percentiles.yml`, the table behind the end screen's "Better than N% of simulated PhDs". Rerun after balance changes. |
| `python3 tools/phd-sim/og/render-og.py` | Renders `og/og.html` with headless Chrome into `assets/phd-sim/og.jpg`, the link preview for `/phd-simulator/`. |
| `python3 tools/phd-sim/serve.py` | No-cache static server. Open http://127.0.0.1:8766/tools/phd-sim/dev/index.html for the dev page (uses the exported JSON, has a dark-mode toggle and a "clear saves" button). |

The `--experimental-default-type=module` flag (Node 20.10+) lets Node load the engine's `.js` files as ES modules without a `package.json`.

Typical loop after editing content:

```bash
ruby tools/phd-sim/export-data.rb && node --experimental-default-type=module tools/phd-sim/validate.mjs && node --experimental-default-type=module tools/phd-sim/simulate.mjs 200
```

Notes:
- All tuning numbers live in `_data/phd_sim/config.yml`; venue thresholds in `_data/phd_sim/venues.yml`.
- The game's JS, data and CSS are excluded from `jekyll-minifier` (see `jekyll-minifier.exclude` in `_config.yml`), so modern module syntax and non-ASCII text are served as written. The CSS is excluded because the minifier mangles `calc(var(--x) + y)` into invalid CSS (2026-10-20: event pictures covered the text on the live site).
- A local `bundle exec jekyll build` on Ruby 3.3 needs a UTF-8 locale (`LANG=en_US.UTF-8`) and hits a known Jekyll 4.3.2 logger incompatibility; CI uses Ruby 3.2 and is unaffected.
