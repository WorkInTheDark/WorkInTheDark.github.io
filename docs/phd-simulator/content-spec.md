# PhD Simulator: Content Spec

The exact contract between the YAML content in `_data/phd_sim/` and the game engine in `assets/js/phd-sim/`. The design doc (`design.md`) explains *why*; this file says *exactly what keys exist*. The validator (`tools/phd-sim/validate.mjs`) rejects anything not listed here.

**Time units.** One turn is two weeks; a year is T1–T26. Every `turn:` condition, `cooldown`, status `turns:`, `schedule` `in:` and `project.delay` in the YAML is in turns. Player-facing text talks in weeks.

---

## 1. Writing rules (apply to every string)

1. **Second person, present tense.** "Your advisor sends…", never "The student…".
2. **Short.**
   - Event text: 1–3 sentences, ideally under 280 characters.
   - Choice labels: 48 characters or fewer, starting with a verb or a short quoted reply.
   - Result text: 200 characters or fewer.
3. **Plain language.** Anyone who has never heard of Warhammer must understand every line. The Legion names (the Dark Angel, the Ultramarine, …) appear **only** through the `{advisor.nick}` token, never in prose, and never as lore (no Codex Astartes, Red Thirst, Inner Circle, Long Fang, visions, heresy…). Academic jargon a CS PhD student knows is fine (ablation, IRB, camera-ready, ARR).
4. **No serious topics.**
   - Not allowed: illness beyond colds, flu and sprains; grief; family emergencies; harassment, abuse or discrimination; mental-health crises; self-harm; politics or policy.
   - Allowed: burnout, but only as a light, recoverable game state.
5. **The system is the joke, never the player** or real people. No real names, companies, labs or model names; use the tokens.
6. **Every event offers at least one reasonable choice,** not just a least-bad one. Good events have a real trade-off, for example time against quality, or Sanity against the advisor relationship.
7. **Hidden effects must be implied by the wording** of the choice or result ("Your advisor seems pleased"). The player sees arrows for Energy, Sanity, Citations and the five skills (section 5), derived automatically from `effects`; relationships, network and health stay hidden.
8. Use straight ASCII quotes inside YAML; wrap any string containing `:` or `#` in double quotes.

---

## 2. Files and ids

| File | Content | Id prefix |
|---|---|---|
| `events/research.yml` | NLP and HCI research life | `res_` |
| `events/data.yml` | Data and annotation | `dat_` |
| `events/writing.yml` | Writing and submission | `wri_` |
| `events/reviews.yml` | Events around reviews and decisions | `rev_` |
| `events/advisor.yml` | Any-advisor events | `adv_` |
| `events/legion.yml` | Advisor-specific (Legion) events | `leg_` |
| `events/lab.yml` | Labmates | `lab_` |
| `events/milestones.yml` | Courses, quals, proposal, defense | `mil_` |
| `events/teaching.yml` | TA life | `tea_` |
| `events/career.yml` | Internships, fellowships, job market | `car_` |
| `events/travel.yml` | Conferences and travel | `tra_` |
| `events/world.yml` | The field and the world | `wor_` |
| `events/life.yml` | Life outside the lab | `lif_` |
| `events/wellbeing.yml` | Light wellbeing | `wel_` |
| `events/exits.yml` | Ways out of the PhD (engine-owned) | `exi_` |
| `events/tasks.yml` | New work landing on your plate; raises Stress. Each event's `category` is whatever fits (teaching, reviews, lab...) | `tsk_` |
| `flavor.yml` | One-line turn-log flavor | none |
| `opportunities.yml` | "Only this turn" focus choices (section 3.3) | `opp_` |
| `side.yml` | Side activities for an evening or a weekend (section 3.4) | `side_` |
| `reviews.yml` | Reviewer personas, concerns, meta-reviews | none |
| `qa.yml` | Committee and interview questions | none |

Ids are `snake_case`, unique across all files, and start with the file's prefix. Every events file is a YAML **list** of events.

---

## 3. Event schema

```yaml
- id: res_gpu_queue                # required
  title: "The Queue"               # required, ≤ 40 chars
  category: research               # required, see below
  rarity: common                   # common | uncommon | rare | legendary   (default common)
  hook: turn                       # when the engine considers it           (default turn, section 6)
  trigger: random                  # random | scheduled                    (default random)
  repeatable: false                # default false = at most once per run
  cooldown: 6                      # turns between repeats (repeatable only; default 6)
  weight: 1.0                      # optional extra multiplier on the draw weight
  arc: elusive_clinicians          # optional story-arc id
  when: { ... }                    # optional conditions, all must hold (section 4)
  text:                            # required: a string, or a list of 1–3 variants
    - "There are {roll:200-600} jobs ahead of yours on the cluster."
  choices:                         # required: 2–4 choices
    - label: "Wait it out"
      text: "Three days later, it starts. Then it finishes."   # result line
      effects: { project.progress: "-8±3", sanity: "-2±1" }
    - label: "Ask {labmate} for their reservation"
      check: { stat: labmates_rel, vs: 55, spread: 15 }
      success: { text: "...", effects: { project.progress: "+5±2", labmates_rel: "-2±1" } }
      failure: { text: "...", effects: { labmates_rel: "-4±2", sanity: "-2±1" } }
```

**Categories:** `research`, `data`, `writing`, `reviews`, `advisor`, `legion`, `lab`, `milestone`, `teaching`, `career`, `travel`, `world`, `life`, `wellbeing`, `exit`.

**Rarity** sets the draw weight (common 10, uncommon 4, rare 1.2, legendary 0.3). Use rare and legendary for big, memorable moments.

### 3.1 Choice keys
- `label` (required).
- `requires:` conditions (section 4). The choice is **hidden** when they fail, which lets traits unlock options.
- `tag:` a short label shown on a gated choice, for example `"Night Owl"`.
- **Either** outcome keys directly on the choice (3.2) **or** a `check` with `success:` and `failure:` outcomes.
- `check: { stat, vs, spread }` → `P(success) = clamp(0.5 + (stat − vs) / (2·spread), 0.05, 0.95)`. `stat` is any stat id (section 5).

### 3.2 Outcome keys

```yaml
text: "Result line."                          # recommended
effects: { <target>: "<value>", ... }         # section 5
flag_set: [flag_a, flag_b]                    # run flags, any snake_case name you invent
flag_clear: [flag_a]
counter: { name: +1 }                         # run counters, any snake_case name
status: { add: in_the_zone, turns: 2 }        # or a list of these
status_remove: [sick]
trait_add: rejection_hardened                 # earned traits only (section 7.2)
schedule: { event: res_scooped_2, in: [1, 3], chance: 1.0 }   # or a list; target must be trigger: scheduled
achievement: best_paper                       # only ids from section 9
tip: "Critique-Centric Feedback"              # PhD 101 topic (section 10), shown as a link
unlock: opp_writing_retreat                   # or a list; adds that "Only this turn" choice (section 3.3)
```

`ending` exists but is reserved for `events/exits.yml`.

`unlock` adds the opportunity to the next turn's choices (or this turn's, if it happens before the focus is chosen), and tells the player ("New option next turn: …"). It ignores the opportunity's `chance` and `when`, so unlock only ones that make sense in the event's situation.

### 3.3 Opportunities (`opportunities.yml`)

An "Only this turn" focus choice. It appears beside the everyday choices for one turn; if you don't take it, it's gone. Choosing it spends all of the turn's free days on `days`, then applies the outcome keys.

```yaml
- id: opp_writing_retreat                 # unique, starts with opp_
  label: "Join the writing retreat for “{project}”"   # the button; tokens allowed
  reason: "The department's writing retreat has a seat."   # why it's here this turn (shown under the label)
  when: { project: { stage: [writing, revise] } }          # conditions (section 4); a project condition binds {project}
  chance: 0.06                            # per eligible turn (default 0.05)
  cooldown: 8                             # turns before it can come up again (default 4)
  once: true                              # optional: at most once per run
  days: project                           # what the free days do (below)
  boost: 1.4                              # days: project only; progress multiplier
  text: "Five days of uninterrupted writing."             # plus any outcome keys from 3.2
  effects: { writing: "+2±1" }
```

`days` is one of: `read`, `network`, `help`, `mentor`, `career`, `rest`, `recharge`, `exercise`, `social`, `hobby`, `family`, `writing_day`, `project` (the bound project, or your first one), or `none` (the outcome is all that happens). The arrows on the button come from `days` and `effects`. At most `opportunities.max_per_turn` (2) come up in a turn.

### 3.4 Side activities (`side.yml`)

Small things for an evening or a weekend. In some turns, after the events, a card offers two or three of them plus "Not this time". They don't use the turn's focus.

```yaml
- id: side_gym                     # unique, starts with side_
  label: "Hit the gym three times" # the choice; tokens allowed ({labmate} etc.)
  desc: "Your body will thank you, eventually."
  helps: health                    # health | stress | energy | social | career: 3x as likely when that bar is in trouble
  weight: 3                        # default 1
  when: { has_advisor: true }      # conditions (section 4)
  text: "Sore on Tuesday, smug on Thursday."
  effects: { health: "+5±1", energy: "-2±1", sanity: "+1" }   # plus any outcome keys from 3.2
```

Keep effects small (bars ±1 to ±6). A side activity that takes real time uses `days: -1`. A `helps: health` choice also counts as exercise for the turn.

---

## 4. Conditions (`when`, `requires`)

All keys are ANDed. Comparison strings are `"<30"`, `"<=1"`, `">=60"`, `">5"`, `"==2"`.

| Key | Example | Meaning |
|---|---|---|
| `year` | `[2, 4]` | PhD year range, inclusive (1–8) |
| `turn` | `[20, 25]` | Turn of the year, inclusive (1–26, two weeks each; see the calendar below) |
| `semester` | `[fall, break]` | `fall` (T1–T8), `break` (T9), `spring` (T10–T18), `summer` (T19–T26) |
| `stat` | `{ sanity: "<30", writing: ">=60" }` | Any stat (section 5) |
| `has_advisor` | `true` | The advisor has been chosen |
| `advisor` / `advisor_not` | `[kind_funded]` | Advisor archetype ids (section 7.3) |
| `background` | `[industry]` | `undergrad`, `masters`, `industry`, `switcher`. Derived from traits since 2026-10-16: Industry Veteran → `industry`, Career Switcher → `switcher`, Master's Head Start → `masters`, otherwise `undergrad` |
| `origin` | `international` | `domestic` or `international`. `international` means the player rolled the International Student trait |
| `traits_any` / `traits_none` | `[night_owl]` | Trait ids (section 7) |
| `flags_all` / `flags_any` / `flags_none` | `[cat_adopted]` | Run flags |
| `counter` | `{ resched: ">=2" }` | Run counters (missing = 0) |
| `status_any` / `status_none` | `[ta]` | Status ids (section 8) |
| `milestone` | `{ quals: passed, proposal: pending }` | `quals`/`proposal`: `pending`, `passed`, `failed_once`; `defense_prep`: `active`, `inactive`; `graduated`: `true` or `false` |
| `project` | `{ type: study, stage: recruiting }` | A matching **active first-author project** exists; binds `{project}`. Fields: `type`, `stage` (one value or a list), `stage_kind` (`work` or `wait`), `turns_to_deadline` (comparison: turns until its target venue's next deadline; 0 = this turn) |
| `paper` | `{ status: under_review, tier: top }` | A matching paper exists; binds `{paper}` and `{venue}`. Fields: `status`, `tier`, `submissions` (comparison), `first_author` (`true`/`false`) |
| `world` | `{ hiring: freeze }` | `hiring`: `boom`, `neutral`, `freeze`; `hype` (comparison, the bound project's topic) |
| `telemetry` | `{ rejections: ">=3" }` | Run statistics (section 4.1) |
| `chance` | `0.3` | Extra random gate |
| `any` | `[ {…}, {…} ]` | OR over sub-conditions |
| `not` | `{ … }` | Negation |

**Project types and stages** (`stage` values):

| Type | Stages (`(wait)` = advances by calendar time, not days) |
|---|---|
| `empirical` | `idea`, `lit`, `pilot`, `experiments`, `writing` |
| `study` | `idea`, `lit`, `design`, `irb` (wait), `recruiting` (wait), `sessions`, `analysis`, `writing` |
| `system` | `idea`, `lit`, `build`, `irb` (wait), `study`, `analysis`, `writing` |
| `dataset` | `idea`, `lit`, `guidelines`, `annotation` (wait), `baselines`, `writing` |
| `position` | `idea`, `lit`, `writing` |

Any type can also be in `revise` (a rejected paper being revised for resubmission).

**Paper statuses:** `under_review`, `accepted`, `rejected`, `revise_resubmit`. **Tiers:** `top`, `mid`, `findings`, `workshop`, `journal`.

**Calendar** (turn of the year):

| Turn | When | Turn | When |
|---|---|---|---|
| T1 | early Sep | T14 | spring break |
| T5 | Halloween | T18 | finals |
| T7 | Thanksgiving | T19–T26 | summer |
| T8 | finals | T20–T25 | internships |
| T9 | winter break | T26 | lease renewals, new cohort |
| T10 | spring starts | | |
| T11–T12 | Lunar New Year | | |

### 4.1 Telemetry keys
- **Time:** `turns` (periods played)
- **Overtime:** `overtime_days`, `overtime_streak` (consecutive periods with overtime)
- **Wellbeing:** `burnouts`, `days_off_streak` (consecutive periods with no rest, social, hobby, family or exercise day)
- **Papers:** `submissions`, `acceptances`, `rejections`, `desk_rejects`, `first_author_pubs`, `coauthor_pubs`
- **Impact:** `citations`, `h_index`
- **Activities:** `conferences`, `rebuttals`, `reading_days`, `social_days`, `ta_semesters`, `lab_meetings_in_person`

---

## 5. Effects

Values are `"+7±3"` (a whole number rolled in [4, 10], peaked at 7), `"-5±2"`, `"+3"`, or a plain number. Booleans are `true`.

| Target | Notes |
|---|---|
| `energy`, `sanity`, `health` | **Visible**, 0–100. Typical: small 2–4, medium 5–9, big 10–20. Players see `sanity` as **Stress** (100 − sanity), so `sanity: "+5"` shows as "Stress −5": keep writing sanity as "up is good" |
| `citations` | **Visible.** Bonus citations, usually 1–15 |
| `taste`, `coding`, `writing`, `presenting`, `knowledge` | Hidden skills, 0–100. Move 1–4 typically, 5–8 for big moments |
| `advisor_rel`, `labmates_rel`, `family_rel`, `friends_rel`, `network` | Hidden, 0–100. Typical 2–6 |
| `project.progress` | Bound project, in points of its whole 0–100% bar (it can cross into the next phase, but stops at a wait and at 100%; setbacks stay within the current phase). Typical 4–15 |
| `project.quality.N`, `.S`, `.C` | Novelty, Soundness, Clarity of the bound project. Typical 3–10 |
| `project.delay` | Turns added to (or, if negative, removed from) a waiting phase, or put on hold for a work phase |
| `project.pivot` | `true`: back to `idea`, keeps half its Novelty |
| `project.abandon` | `true`: the project is dropped |
| `paper.score` | Bound paper under review: added to every reviewer's score (0–100 scale; 5 ≈ half a point). Typical 2–8 |
| `paper.desk_reject` | `true`: the bound paper is desk-rejected |
| `paper.citations` | Bonus citations for the bound paper |
| `days` / `days_next` | Free days gained (+) or lost (−) this turn or next. Typical ±1 to ±4 |
| `career_prep` | Points toward internship and job applications. Typical 1–3 |

Arrows are derived automatically: for each visible target (`energy`, `sanity`, `health`, `citations`), the center of the value gives ↑ or ↓, and ↑↑ or ↓↓ when it is 10 or more. Sanity arrows are drawn as Stress, flipped, in the same color. A check whose success and failure point opposite ways shows ↕.

---

## 6. Hooks

`hook` decides **when** the engine considers an event. The default `turn` means a random draw after the turn's focus. Other hooks fire at specific moments; when one fires, the engine draws one eligible event for it (at the chance shown) and binds the tokens listed.

| Hook | Fires | Chance | Binds |
|---|---|---|---|
| `turn` | After the turn's focus: 0, 1 or 2 draws (a target of 0/1/2 at 15%/60%/25%, minus updates already in the turn) | — | — |
| `deadline` | The turn you submit a paper, after the two weeks | 0.3 | `{project}`, `{venue}` |
| `after_submit` | Right after a submission | 0.2 | `{paper}`, `{venue}` |
| `reviews_in` | When reviews arrive, before the rebuttal | 0.3 | `{paper}`, `{venue}` |
| `after_accept` | After an acceptance | 0.35 | `{paper}`, `{venue}` |
| `after_reject` | After a rejection | 0.3 | `{paper}`, `{venue}` |
| `conference` | Each conference you attend in person | 1.0, 1 event | `{city}`, `{paper}`, `{venue}` |
| `internship` | Each internship turn | 0.3 | `{company}` |
| `defense_prep` | Each defense-prep turn | 0.4 | — |
| `defense` | Defense day, before the Q&A | 1.0 | — |
| `job_market` | Each job-market turn | 0.15 | — |
| `model_release` | When a frontier model is released in the world timeline | 0.25 | `{model}`, `{biglab}` |
| `graduation` | Commencement | 1.0, up to 2 events | — |

Events with `trigger: scheduled` are never drawn. They fire only through `schedule` from another event, in the scheduled turn, and only if their `when` still holds.

---

## 7. Traits

### 7.1 Starting traits (three are rolled at random)
`international`, `industry_veteran`, `career_switcher`, `head_start`, `night_owl`, `early_bird`, `perfectionist`, `procrastinator`, `resilient`, `anxious`, `social_butterfly`, `introvert`, `code_wizard`, `wordsmith`, `polyglot`, `gym_rat`, `caffeine_powered`, `overcommitter`, `lucky`, `imposter_syndrome`, `extremely_online`, `homebody`, `foodie`, `first_gen`, `parent`, `musician`, `stats_nerd`, `optimist`

### 7.2 Earned traits (usable with `trait_add`)
`rejection_hardened`, `burnout_survivor`, `cat_person`, `deadline_junkie`

### 7.3 Advisor archetype ids
| Id | Archetype | Nickname |
|---|---|---|
| `famous_absent` | Famous but Absent | the White Scar |
| `micromanager` | Micromanager | the Imperial Fist |
| `hungry_ap` | Hungry Assistant Prof | the Blood Angel |
| `kind_unfunded` | Kind but Unfunded | the Raven Guard |
| `grant_machine` | Grant Machine | the Ultramarine |
| `visionary` | The Visionary | the Thousand Son |
| `industry_joint` | Industry Joint | the Iron Hand |
| `near_retirement` | Near Retirement | the Space Wolf |
| `serial_founder` | Serial Founder | the Alpha Legionnaire |
| `methods_purist` | Methods Purist | the Iron Warrior |
| `kind_funded` | Kind and Funded | the Dark Angel |

---

## 8. Statuses

| Status | Status | Status |
|---|---|---|
| `sick` | `jet_lagged` | `burnout` |
| `post_rejection_blues` | `deadline_mode` | `in_the_zone` |
| `in_love` | `injured` | `visa_pending` |
| `on_internship` | `on_leave` | `defense_prep` |
| `coursework` | `ta` | `quals_prep` |
| `proposal_prep` | `job_market` | `at_conference` |
| `fellowship` | | |

The engine sets `coursework`, `ta`, `quals_prep`, `proposal_prep`, `defense_prep`, `job_market`, `on_internship`, `at_conference` and `fellowship` itself. Content may add the others.

---

## 9. Achievements content may grant

| Id | Meaning |
|---|---|
| `best_paper` | Outstanding paper award |
| `desk_rejected` | Got desk rejected |
| `overleaf_survivor` | Survived an outage on deadline day |
| `cat_person` | Adopted a cat |
| `lost_luggage` | Lost luggage at a conference |
| `met_your_hero` | Met your research hero |
| `remote_presenter` | Visa trouble forced a remote talk |
| `gpu_queue` | Survived a brutal GPU queue |
| `irb_purgatory` | Survived a very long IRB |
| `ten_questions` | Aced the Ten Questions |
| `no_orphans` | A paper with zero orphan words |
| `saw_it_coming` | Reviewer 2 asked the question you'd already fixed |
| `inbox_zero` | Survived the post-vacation inbox |
| `hood_backwards` | Wore the doctoral hood backwards |

---

## 10. PhD 101 topics (for `tip:`)

- **Ch. 0:** Research Is Not Homework · Benefits of Research · Critique-Centric Feedback · Self-Motivation · Outcome of PhD Training
- **Ch. 1:** Hold Yourself to a High Standard · Deliver Your Commitments · Toxicity of Peer Pressure · Learning How to Learn · Sustain Through the Journey · Find Out What You Are Devoted To
- **Ch. 2:** Literature Search · Paper Reading · Self-Learning Skills · Project Meeting · Paper Writing 101 · How to Communicate
- **Ch. 3:** Judy's Ten Questions · Research Question · Stakeholders and Gap · Approach and Methods · Understanding Workflows · Results and Findings · Implications and Venue
- **Ch. 4:** How Burnout Begins · Know Your Limits · When and How to Rest · How to Spend a Day

Use a tip only where the episode genuinely fits; at most one per event.

---

## 11. Tokens

| Token | Becomes |
|---|---|
| `{player}` | The player's first name |
| `{advisor}` | "Prof. Surname" |
| `{advisor.nick}` | "the Dark Angel", etc. |
| `{labmate}`, `{labmate2}` | Two different current labmates |
| `{senior}` | The most senior labmate |
| `{mentee}` | Your mentee, or a new student |
| `{project}`, `{project.topic}` | Bound project title and topic |
| `{paper}`, `{venue}` | Bound paper title and venue name |
| `{city}` | A conference city |
| `{company}` | A fictional tech company |
| `{model}`, `{biglab}` | The latest fictional frontier model and lab |
| `{committee}` | A committee member, "Prof. Surname" |
| `{roll:200-600}` | A random whole number |
| `{counter.name}` | A counter's value; `{counter.name\|ordinal}` gives "3rd" |

A token is bound once per event, so `{labmate}` is the same person throughout a card.

---

## 12. Arcs

- Step 1 is a normal random event with an `arc:` id, usually `uncommon` or `rare`.
- Later steps use `trigger: scheduled` and the same `arc:`, and are reached through `schedule`.
- Branches use `flag_set` plus `when: { flags_all: [...] }`.
- Every path must end: no step may leave the story hanging.

---

## 12b. Flags the engine reads or sets

**Content may set these** (`flag_set`) to open engine paths:

| Flag | Effect |
|---|---|
| `labmate_startup_offer` | The job market can offer "Employee #4 at a Labmate's Startup" |
| `startup_idea` | Unlocks the startup track on the job market |
| `quant_recruiter` | A quant offer becomes possible |
| `policy_interest` | A policy fellowship becomes possible |
| `science_writer` | A science journalism offer becomes possible |
| `video_fame` | An AI YouTuber ending becomes possible |
| `clinical_partner` | A clinical informatics offer becomes possible; also unlocks clinician events |
| `bubble_tea_dream` | Makes the bubble tea exit reachable |
| `family_business` | Makes the family business exit reachable |
| `med_school_curious` | Makes the "switched fields" exit reachable |
| `visa_failed` | Turns a planned conference trip into a remote talk |
| `return_offer` | An internship return offer |

**The engine sets these; content may read them:**
- `trip_planned`: an accepted paper's conference trip is coming up
- `inherited_project`
- `fellowship_applied`, `fellowship_won`
- `internship_applied`, `interned`
- `on_market`
- `kf_flaw_fixed`: you fixed the weakness the Dark Angel named before submitting

Any other flag name is free for content to invent.

## 13. `flavor.yml`

```yaml
- text: "You open final_v3_REAL_final.tex."
- text: "Your advisor replies at 1:12 am: \"Great figure.\""
  when: { advisor: [kind_funded] }
```

One random line goes into the log in turns without news, and sometimes in others.

---

## 14. `reviews.yml`

```yaml
personas:
  - id: reviewer_2
    name: "Reviewer 2"
    bias: -8            # added to the 0–100 review score (65 ≈ 3/5)
    openness: 0.4       # 0–1.2, how much the rebuttal can move them
    silent: false       # true = never reads the rebuttal
    llm: false          # true = an LLM-written review that can be flagged to the AC
    weight: 1.0
    openers:            # first line of the review; hints at the persona
      - "The authors propose yet another…"
concerns:
  - id: missing_baseline
    component: S        # N (novelty) | S (soundness) | C (clarity) | fit
    severity: major     # minor | major
    valid: 0.7          # chance it is a real issue rather than a misreading
    personas: [baseline_hunter]   # optional: drawn more often by these personas
    text:
      - "The paper does not compare against {model}."
meta:                   # meta-review lines
  accept: ["..."]
  findings: ["..."]
  reject: ["..."]
  revise: ["..."]
```

Tokens for reviews: `{model}`, `{fake_prior}` (a fictional prior paper, for example "Okafor et al. (2025)"), `{venue}`, `{topic}`.

---

## 15. `qa.yml`

```yaml
questions:
  - id: qa_why_phd
    stages: [proposal, defense]       # quals | proposal | defense | job_talk
    kind: big_picture                 # knowledge | weakness | big_picture | gotcha
    skill: presenting                 # taste | knowledge | writing | presenting | coding
    difficulty: 55                    # 30–85
    text: "Why is this a PhD and not a product?"
members:
  - id: stats_hawk
    label: "asks about statistics"
    prefers: [weakness]
```

The answer strategies are fixed by the engine:
- **Answer directly:** best for `knowledge` questions.
- **Acknowledge the limitation:** best for `weakness` questions.
- **Reframe the question:** best for `big_picture` questions.
- **"Great question…":** a weak stall.

A `gotcha` question rewards acknowledging or reframing.
