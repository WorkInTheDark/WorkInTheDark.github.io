# PhD Simulator: translatable text in the code

The game's code writes a lot of text itself: buttons, cards, log lines, system pop-ups, the end screen. Every string a player can see goes through `t()` from `assets/js/phd-sim/engine/i18n.js`, so `tools/phd-sim/i18n-extract.mjs` can collect it into `_data/phd_sim_i18n/zh/code.yml`.

## Rules

1. **Import:** `import { t } from "./i18n.js";` in the engine, and `import { t } from "../engine/i18n.js";` in the UI.
2. **Wrap every player-visible English string:** labels, descriptions, titles, log lines, pop-up text, choices, aria-labels, `title=` tooltips, toasts and confirm dialogs. Don't wrap ids, `data-action` values, CSS classes, HTML tags, regexes, log kinds (`"news"`, `"good"`), or strings only the code compares.
3. **One sentence, one template.** Never build a sentence from translated pieces glued together, because Chinese word order differs. Turn concatenation into a template with named placeholders:

   ```js
   // before
   "You go back to the draft and aim for " + label + "."
   // after
   t("You go back to the draft and aim for {deadline}.", { deadline: label })
   ```

   Placeholder names are short and descriptive: `{venue}`, `{weeks}`, `{title}`, `{n}`, `{name}`. A placeholder that `t()` has no value for is left in place, so content tokens like `{advisor}` still work. Don't reuse content token names for different meanings.
4. **The first argument must be a plain double-quoted string literal**, never a variable or a concatenation. The extractor finds `t("...")` with a regex. Use `\u2019`-style escapes or the real characters, whichever the file already uses.
5. **Plurals:** English plural logic picks between whole templates, e.g. `n === 1 ? t("1 paper") : t("{n} papers", { n })`. Chinese gets the same translation for both.
6. **Constants defined at import time** (stage names, chance words, stat names, action labels in a table) can't call `t()` where they're defined, because that runs before the language is set. Mark each literal with `T_()`, which returns it unchanged but lets the extractor see it, and translate where it's shown:

   ```js
   const STAGE_LABELS = { idea: T_("Idea"), lit: T_("Related work") };
   // where it's displayed
   t(STAGE_LABELS[id])
   ```

   `T_` is exported from i18n.js.
7. **Don't change behavior.** English output must stay byte-for-byte the same, apart from fixing outright typos. Tests (`node --experimental-default-type=module --test tools/phd-sim/tests/`), the validator and the simulator run in English and must still pass.
8. **Code that parses text** must keep working in both languages. For example, focusReport strips a `"<project>: "` prefix from log lines, and `tools/phd-sim/simulate.mjs` reads action descriptions. Either base it on data rather than text, or accept both `": "` and `"："`.
