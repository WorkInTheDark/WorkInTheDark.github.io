# PhD Simulator: Design Doc

Status: v1 implemented (2026-10-15) on the `phd-simulator` branch. Phases 1 and 2 are built, plus parts of Phase 3 (daily seed, share image, job talk Q&A); see section 18 for what is and isn't done.
Owner: Arthur. This file is the design; `content-spec.md` is the exact data contract; `tools/phd-sim/README.md` lists the dev commands. It is excluded from the Jekyll build.

A browser game on the site, inspired by 《读博模拟器》, in which the player lives through an NLP × HCI PhD one week at a time: choosing an advisor, running projects, surviving reviews, travelling to conferences, living a life outside the lab, and landing somewhere at the end. The aim is a game that is as realistic as possible while still being fun, and that can be replayed many times without feeling repetitive.

---

## 0. Decisions so far

| Topic | Decision |
|---|---|
| Language | English |
| Field | NLP × HCI (human-centered AI, clinical AI flavor) |
| Turn length | **One week, one choice.** Each week you pick one thing to do and the week plays out right away: no multi-pick, no confirm button. A few choices are always there (each project, Read, Recharge); random happenings add "This week only" choices (section 4). Changed twice on 2026-10-16: first from a repeating two-week routine to a per-turn planner, then to this |
| Visible stats | Energy, Sanity, Citations (+ h-index), Papers, and the five skills (made visible again 2026-10-16, since actions now train them directly) |
| Hidden stats | Relationships, network, health |
| Character | Three traits rolled at random. No background or origin choice; those became traits (Industry Veteran, Career Switcher, Master's Head Start, International Student) (2026-10-16) |
| Event frequency | About one pop-up every four to five weeks (random events at 9% a week, plus milestones, reviews and Q&As); routine news goes into the weekly report instead of pop-ups (2026-10-16) |
| Not stats | Money and funding (funding becomes a hidden trait of the advisor) |
| Effects | Rolled within a range, written `+7±3` |
| Before choosing | Arrows only, never numbers |
| Advisor archetypes | Many, including a rare "Kind and Funded" one that is Arthur |
| Advisor nicknames | Space Marine Legion names, one Legion per archetype (section 7.1) |
| Graduation | Passing the defense. The defense needs at least 3 publications and 3 months of preparation (section 3.4) |
| Tone | No serious topics (section 16.3) |
| Placement | Its own navbar tab, right after PhD 101 (section 15.7) |
| Mini-games | Rebuttal first; more later |
| PhD 101 | In-game tips and end-of-run reading recommendations link to episodes |
| Variety | Very large pools of events, endings and achievements, plus systems that keep runs from repeating |

Open questions are collected in section 19.

---

## 1. Goals, non-goals, pillars

### Goals
- **Realistic.** Things take as long as they really take, happen about as often as they really happen, and have the consequences they really have. A PhD student should laugh in recognition.
- **Fun.** Meaningful choices, visible progress, surprises, and stories worth retelling.
- **Replayable.** A third run should feel different from the first (see section 11.7 for how this is measured).
- **A way into PhD 101.** Players who enjoy the game should find their way to the essays.

### Non-goals (for now)
- Multiplayer, accounts, leaderboards, or any backend.
- LLM-generated content at runtime. Everything is pre-written and templated.
- Fields other than NLP × HCI.
- Pixel art or animation-heavy visuals.

### Design pillars
1. **Realistic causes, fair feedback.** Every bad outcome has a cause the player could have seen coming or planned around. Randomness shapes the odds, never the whole result.
2. **The system is the joke, never the player.** Satire targets deadlines, reviewing, bureaucracy and hype. Resting is a winning strategy. No ending is a "you lost" screen.
3. **Hidden but hinted.** Much of what matters (skills, relationships, health) is hidden, as in real life, but the game always gives indirect signals.
4. **Content is data.** Events, endings, achievements and tuning numbers live in YAML, so adding content never means touching engine code.

---

## 2. A run at a glance

1. **Create a character:** a name and three random traits (section 6).
2. **Year 1, fall:** orientation, coursework, meet three candidate advisors, choose one by the end of the semester (section 7.2).
3. **Years 1–2:** courses, TA duty, first projects, first submissions, quals, first internship applications.
4. **Years 3–4:** more papers, internships, conferences, mentoring, the thesis proposal.
5. **Final year:** the job market, thesis writing, the defense.
6. **Ending:** a career outcome, a life epilogue, a title, "Your PhD in numbers" with hidden stats revealed, and two or three recommended PhD 101 episodes.

A run can also end early: quitting, leaving with a Master's, or hitting the Year 8 cap.

Target run length: 25–40 minutes for a five-year PhD, with save and resume.

---

## 3. Time and calendar

### 3.1 Turns and periods
- **One turn = one week** = 5 weekdays + a weekend. One year = 52 turns, starting on 1 September (364 days; the missing day is ignored).
- **The calendar still counts in two-week periods**, T1–T26, two turns each. The tables below, the venue calendar, and every `turn:` condition, cooldown and duration in the content files use periods. The engine converts: a content duration of N periods lasts 2N weeks, and things that happen "at T12" happen in the first week of T12 (deadlines fall in the second week).
- Nominal program: 5 years (260 weeks). Extensions up to the end of Year 8 (416 weeks), when the run ends regardless.
- Elsewhere in this doc, durations written in "turns" for statuses, venues and milestones are periods (two weeks each) unless they say weeks.

### 3.2 Period-to-date map (each year)

| Period | Dates | Notes |
|---|---|---|
| T1 | Sep 1–14 | Fall semester starts |
| T2 | Sep 15–28 | |
| T3 | Sep 29–Oct 12 | |
| T4 | Oct 13–26 | |
| T5 | Oct 27–Nov 9 | Halloween |
| T6 | Nov 10–23 | |
| T7 | Nov 24–Dec 7 | Thanksgiving |
| T8 | Dec 8–21 | Finals, grading |
| T9 | Dec 22–Jan 4 | Winter break |
| T10 | Jan 5–18 | Spring semester starts |
| T11 | Jan 19–Feb 1 | Lunar New Year window (T11–T12) |
| T12 | Feb 2–15 | |
| T13 | Feb 16–Mar 1 | |
| T14 | Mar 2–15 | Spring break |
| T15 | Mar 16–29 | |
| T16 | Mar 30–Apr 12 | |
| T17 | Apr 13–26 | |
| T18 | Apr 27–May 10 | Finals, annual progress review |
| T19 | May 11–24 | Summer starts |
| T20–T25 | May 25–Aug 16 | Internship window (6 turns ≈ 12 weeks) |
| T26 | Aug 17–30 | Lease renewals, new cohort arrives |

Seasonal modifiers: flu season T8–T14, winter storms and shorter days T9–T13 (small Sanity drag), summer heat T22–T24.

### 3.3 Venue calendar (approximate, editable in `calendar.yml`)

Real venue names, approximate dates. These are game timings, not authoritative deadlines.

| Venue | Deadline | Reviews / response | Decision | Conference |
|---|---|---|---|---|
| ARR cycle A → ACL/NAACL | T12 | T17, 1-turn response | T20 | T22–T24 |
| ARR cycle B → EMNLP | T19 | T24, 1-turn response | T2 | T6–T7 |
| ARR cycle C → EACL/next ACL | T3 | T8, 1-turn response | T11 | T15–T17 |
| CHI | T1 | T5: reject or Revise & Resubmit | T10 | T16–T18 |
| ICLR | T3 | T6, 2-turn discussion | T11 | T16–T18 |
| NeurIPS | T19 | T25, 1-turn rebuttal | T2 | T8 |
| AMIA Annual Symposium | T14 | T20 | T22 | T5–T6 |
| IUI | T3 | T8 | T11 | T15–T17 |
| Workshops | rolling | short | 3–4 turns after | with their main venue |
| Journals (TACL, TOCHI, JAMIA) | any time | 6–12 turns, revision rounds | | presentation optional |

ARR rejections can be resubmitted to a later cycle with previous reviews attached, as in reality.

### 3.4 Program structure and graduation
- **Coursework:** Year 1 fall and spring, Year 2 fall.
- **Advisor matching:** Year 1, T1–T8 (section 7.2).
- **Quals:** Year 1 T18 or Year 2 T18 (program variant rolled per run). One retake allowed.
- **Thesis proposal:** a window from Year 3 T20 to Year 4 T18. Requires at least 2 first-author papers and a committee.
- **Annual progress review:** every T18 (section 5.4).
- **Graduation = passing the defense.** There is no separate advisor-specific paper bar.
- **To start defense preparation** you need:
  - the proposal passed
  - **at least 3 publications:** accepted, peer-reviewed, first author, any tier (Findings and workshops count). The default reading is pending Arthur's confirmation (section 19).
  - Optionally, you can start with the third paper still under review. If it is rejected during preparation, the defense is postponed until a third paper is accepted. Strict advisors may refuse the early start.
- **Defense preparation takes 12 weeks (about three months):**
  - Thesis writing and slides take a fixed part of every week (5 days per two weeks).
  - Prep days build a hidden **readiness** score from Writing and Presenting.
  - Prep has its own event pool: finding a date when the whole committee is free, thesis formatting rules, the acknowledgments section, a committee member who wants one more chapter.
- **The defense** happens at the end of the 6th prep turn, as the Committee Q&A mini-game (section 9.2). It cannot fall on T9 (winter break); if it would, it moves to T10.
- **Defense outcomes:**
  - **pass**
  - **pass with minor revisions** (2 more weeks of fixes)
  - **major revisions** (6 more weeks, then a short re-defense)

  There is no outright fail: as in reality, advisors don't schedule a defense they expect to fail.

---

## 4. The week

Changed twice on 2026-10-16 at Arthur's request. First the repeating routine and auto-continue were removed in favor of a two-week planner with several picks and an End turn button. He found that too complicated, so now **each turn is one week and you make one choice**. Clicking it plays the week out at once.

### 4.1 Fixed time
- Fixed commitments take part of each week before your choice gets the rest:

  | Commitment | Days per week | When |
  |---|---|---|
  | Courses | about 1.5 in Year 1, 1 in Year 2 fall | Coursework terms |
  | TA duty | about 1 (1.5 at finals) | TA semesters |
  | Meetings | about 0.5 (1 with a Micromanager) | Always |
  | Defense prep | about 2.5 | Defense prep |
  | Family | 1 | Parent trait |
  | Internship | all 5 | Internship weeks |

  Two-week amounts from `config.yml` are split across a period's two weeks (rounded up in the first week, down in the second).
- **All the remaining weekdays** go to the one thing you chose. You get fewer when you're sick (3 fewer) or burned out (half).
- **Weekends are off** (+Energy, +Sanity), except when you crunch for a deadline.

### 4.2 What you can choose
Only a few choices are always there, because most real activities don't fill a week:
- **Work on "<project>"**, for each active project. It advances the current stage and trains that stage's skill.
- **Read and learn:** knowledge and taste, and sometimes an idea.
- **Recharge:** sleep, see people, do nothing useful. Restores Energy and Sanity.

Some choices come from the calendar and your progress:
- **Deadline week:** "Polish and submit "<project>" to VENUE" replaces that project's work choice. It needs at least half a draft by the end of the week and always posts a preprint. If you skip it, the target rolls to the next deadline.
- **One or two weeks before a deadline:** "Crunch on "<project>", weekend included". It adds deadline mode, two overtime days, and a big drain.
- **Milestones**, which use the week: apply for internships (Years 2–5, T2–T7) or a fellowship (Years 1–3, T3–T6), schedule the thesis proposal, start defense prep, or go on the job market.
- **Internship weeks:** "Give it your all", "Keep a healthy pace", or "Spend the weekend on <project>".
- **On leave:** only Recharge.

Everything else comes up as a **"This week only"** choice (`opportunities.yml`):
- the holidays at home, winter break, a spring-break trip, a summer vacation
- a friend or your parents visiting
- a summer school, a hackathon, a nearby workshop, an invited talk, the career fair, visit day
- a writing retreat, an empty GPU cluster, the clinic suddenly having openings, or your advisor's free week (each boosts project progress)
- helping a labmate make their deadline, teaching this week's lectures
- the thesis bootcamp during defense prep

Each week every eligible opportunity rolls its `chance` (respecting `when`, `cooldown` and `once`), up to `opportunities.max_per_week` (2). Events can also unlock one with `unlock:` (for this week or next). About 28% of weeks offer at least one. If you don't take it, it's gone.

**Start a new project** is a free button, not a choice: it doesn't use up the week.

Every choice shows arrows for its visible effects, never numbers. A quick double click can't spend two weeks: clicks in the first 0.4 seconds of a new week are ignored.

### 4.3 Week order
1. **Start of the week:** the calendar and statuses update. Then come the things that need you before you choose:
   - advisor matching
   - quals, proposal and defense Q&A on their dates
   - reviews arriving, with the rebuttal
   - a Findings decision
   - internship and job offers
   - the Dark Angel's Question, the week before a deadline
   - at most one random event (9% a week, or 3% if something else already happened)

   Then the week's opportunities are rolled.
2. **Your choice:** one click.
3. **The week plays out:** days resolve, the opportunity's outcome applies, passive effects apply, and health and burnout are checked.
4. **End of the week:** submissions and revisions are finalized, then citations, tips and achievements.
5. **The report** ("Last week"): what you did, stat and skill changes, project progress, and news (decisions, conference trips, results, warnings).

**Decisions that no longer pop up:**
- Acceptances, rejections and revise-and-resubmits are reported, not asked about. A rejected paper automatically goes back to revision for the next deadline, and you can change its target or shelve it from the project card.
- Conference trips happen automatically: you travel if there's money, otherwise there's a chance of a travel grant, otherwise you present remotely.

### 4.4 Balance targets (from `simulate.mjs`, 600 runs)
- A sensible bot (research most weeks, recharge when Energy < 30 or Sanity < 40, takes milestones and boosts) graduates about 90% of the time, with a median of about 4.4 years. Real players should land around year 5.
- A workaholic bot burns out about 8 times and graduates later. A slacker bot graduates around year 6.5.
- Pop-ups: about 0.22 per week.

## 5. Stats

### 5.1 Visible

| Stat | Range | What it is |
|---|---|---|
| **Energy** | 0–100 | Short-term fuel. Work days use it; rest and weekends restore it. Below 50, each day gets less done. |
| **Sanity** | 0–100 | Mood and motivation in one. Mostly moved by events; social, hobby and family days restore it; isolation and overtime wear it down. |
| **Citations** | count, plus h-index | Grow from published papers and preprints (section 8.8). |
| **Papers** | list | Accepted papers, plus what is under review. |
| **Skills** | 0–100 each | Research taste, coding, writing, presenting, domain knowledge. They grow with what you choose. |

### 5.2 Hidden

| Stat | Range | Start | What it affects |
|---|---|---|---|
| Advisor relationship | 0–100 | 50 | Advisor support, letters, how meetings go |
| Labmates | 0–100 | 50 | Help, co-authorships, lab events |
| Family / partner | 0–100 | 60 | Support during bad events |
| Friends | 0–100 | 40 | Sanity buffer, social events |
| Network | 0–100 | by background | Internships, invitations, collaborations, job market |
| Health | 0–100 | 80±10 | Chance of getting sick; recovery speed |

Stat ids used in data files: `energy`, `sanity`, `citations`, `taste`, `coding`, `writing`, `presenting`, `knowledge`, `advisor_rel`, `labmates_rel`, `family_rel`, `friends_rel`, `network`, `health`.

### 5.3 Starting tuning values (all in `config.yml`)

**Energy**
- Weekday work day: `-3±1`. Overtime (weekend work) day: `-5±2`.
- Rest day: `+8±2`. Exercise, Social, Hobby or Family day: `+5±2`. Weekend day off: `+6±2`.
- Sleep baseline per week: `0`.
- Target behavior: a normal work week (weekdays on, weekends off) costs about 3 Energy, so a Recharge week (about +30) is needed every two months or so. A crunch week costs about 25.
- Efficiency multiplier: `clamp(0.4 + 0.012 × energy, 0.4, 1.0)`. At 50 or more you work at full speed; at 0, at 40%.

**Sanity**
- Social, Hobby or Family day: `+3±1`. Overtime day: `-1`.
- Isolation: no Social or Family day for 3 turns in a row gives `-4±2` per turn until fixed.
- Below 25: efficiency ×0.8, and "should I quit?" events become possible.
- At 0: **Burnout** status for 3 turns (free days halved, no overtime allowed, Sanity recovers).

**Health (hidden)**
- Overtime day `-1.5`; Exercise day `+2`; a turn with no overtime `+1`.
- Chance of getting sick per turn: `0.02 + 0.004 × (100 − health)`, doubled in flu season.

**Skills (hidden)**
- Each day of relevant work: `Δ = 1.2 × (1 − skill/100)`, so growth slows as skills rise.
- Events can add ranged boosts (`writing: "+7±3"`).

**Relationships (hidden)**
- Friends `-1` per turn without a Social day; Family `-0.5` per turn without a Family day (×1.5 for international students).
- Advisor relationship moves with meeting outcomes, kept or broken commitments, progress against the advisor's expectations, and events.

### 5.4 How hidden stats show up
Players learn about hidden stats the way real students do, indirectly:
- **Text cues.** Your advisor replies "Great, let's submit!" or just "ok."; a labmate stops inviting you to lunch.
- **Reviews.** Concerns are drawn from the paper's weak spots, so "hard to follow" means your writing needs work.
- **Result lines.** After a choice, a hidden change of 3 or more produces one short line ("Your advisor seemed pleased." / "Your code feels less fragile than last month."). At most two lines per result.
- **Annual progress review (T18).** Your advisor writes a short letter summarizing your year in words. Low progress can bring a formal warning.
- **The end card** reveals every number.

### 5.5 Rolled effects and arrows
- `+7±3` rolls a whole number in [4, 10] from a triangular distribution peaking at 7, so most rolls land near the middle.
- The roll is then scaled by traits and statuses (for instance, Resilient takes Sanity losses ×0.7) and clamped to the stat's range.
- **Before choosing**, each choice shows arrows for its visible effects only (Energy, Sanity, Citations and the five skills), derived automatically from the sign of each effect's center:
  - `↑` / `↓` for small effects, `↑↑` / `↓↓` when the center is 10 or more (pending confirmation, section 19).
  - `↕` when the outcome depends on a check and success and failure point in opposite directions.
  - Hidden effects never get an arrow; the choice wording hints at them.
- **After choosing**, visible changes show the rolled number ("Sanity −6"); hidden changes appear only as result lines.

### 5.6 Statuses
Temporary effects with a duration, shown as chips under the stats.

| Status | Duration | Effect |
|---|---|---|
| Sick | 1–2 turns | −5 free days, Energy −20 |
| Jet-lagged | 1 turn | Efficiency ×0.8 |
| Burnout | 3 turns | Free days halved, no overtime |
| Post-rejection blues | 2 turns | Sanity −2 per turn, efficiency ×0.9 |
| Deadline mode | until the deadline | Efficiency ×1.15, Sanity −2 per turn |
| In the zone | 2 turns | Efficiency ×1.2 |
| In love | 4 turns | Sanity +2 per turn, efficiency ×0.9 |
| Injured | 3 turns | No Exercise |
| Defense prep | 6 turns | 5 fixed days per turn on the thesis and slides |
| Visa pending | until resolved | Blocks international travel |
| On internship | internship turns | Weekdays go to the internship; only the weekend is yours (section 10.2) |
| On leave | chosen length | No research; Sanity and Health recover |

---

## 6. Character creation

Changed on 2026-10-16: there is no background or origin choice, and no trait picking.
- **Setup:** you enter a name; three traits are rolled at random from the pool (Appendix B plus the four below). Contradictory pairs, such as Code Wizard and Wordsmith or Early Bird and Night Owl, are never rolled together.
- **Starting point:** everyone begins from the same baseline skills (`start.skills` in `config.yml`, ±3), adjusted by traits.
- **The old backgrounds and origin are now traits:**
  - **Industry Veteran:** coding and network much higher, writing a bit lower.
  - **Career Switcher:** domain knowledge high, coding low, user studies go better.
  - **Master's Head Start:** you arrive with a half-finished project.
  - **International Student:** visa events, family abroad, extra network at conferences. Content conditions on `origin: international` still work.
- **Daily mode:** everyone gets the same traits and world on the same day.

## 7. People

### 7.1 Advisor archetypes
Each archetype has a Legion nickname, six hidden parameters on a 1–5 scale, and two random quirks from a pool of about 30 (Appendix D). The Dark Angel instead always has its four fixed quirks (section 7.3).

| Archetype | Fund | Avail | Kind | Stds | Fame | Stab | Upside | Catch |
|---|---|---|---|---|---|---|---|---|
| Famous but Absent | 4 | 1 | 3 | 4 | 5 | 3 | Network, letters | One real meeting a semester |
| Micromanager | 3 | 5 | 2 | 4 | 3 | 4 | Fast early progress | Wears down Sanity; 2 meeting days |
| Hungry Assistant Prof | 3 | 4 | 4 | 4 | 2 | 2 | Lots of attention | Tenure pressure; may move |
| Kind but Unfunded | 1 | 4 | 5 | 3 | 2 | 4 | Wellbeing | TA almost every semester |
| Grant Machine | 5 | 2 | 3 | 3 | 4 | 4 | Always funded | You write the grant reports |
| The Visionary | 3 | 3 | 3 | 2 | 4 | 3 | Exciting ideas | Direction changes often |
| Industry Joint | 4 | 2 | 3 | 3 | 4 | 2 | Compute, internships | Half there |
| Near Retirement | 2 | 3 | 4 | 2 | 4 | 1 | Freedom | May retire mid-PhD |
| Serial Founder | 3 | 2 | 3 | 2 | 3 | 2 | Startup arcs | Always pitching |
| Methods Purist | 3 | 3 | 3 | 5 | 3 | 5 | Rock-solid papers | Slow; stats interrogations |
| ★ **Kind and Funded** | 5 | 4 | 5 | 5 | 3 | 4 | Real support, stable funding | High standards, lots of critique |

#### Legion nicknames
Every advisor is known in the department by a Space Marine Legion name.

**Plain-language rule:** the Legion name is the only Warhammer 40,000 reference a player ever sees. Each nickname always appears together with a plain one-line **tagline**, and the tagline carries the meaning. So someone who has never heard of the setting loses nothing, and someone who has gets an extra joke. The rule applies everywhere:
- Event text, quirks, result lines and the Codex never use lore terms (Codex Astartes, Red Thirst, Inner Circle, Long Fang, visions, and so on).
- Lore may shape a personality behind the scenes, but never as a word the player has to decode.

The advisor card reads, for example: *Prof. {surname} · "the Ultramarine" · Always funded. Always writing grant reports.*

During advisor matching (section 7.2), the nickname and tagline arrive as student rumors, so they are about 70% accurate like every other rumor, and they are confirmed once you join the lab.

| Archetype | Nickname | Tagline (shown in game) | Why this Legion (design only, never shown) |
|---|---|---|---|
| Famous but Absent | the White Scar | Brilliant, famous, and always somewhere else. | Always off hunting somewhere far away |
| Micromanager | the Imperial Fist | Checks every detail. Every. Single. One. | Fortifies and inspects every wall |
| Hungry Assistant Prof | the Blood Angel | New, ambitious, and hungry for papers. | The Red Thirst |
| Kind but Unfunded | the Raven Guard | Fights for their students on almost no budget. | Fights for its people with almost nothing left |
| Grant Machine | the Ultramarine | Always funded. Always writing grant reports. | Five hundred worlds of logistics and paperwork |
| The Visionary | the Thousand Son | Big ideas, and a new one every week. | Sees visions; plans change accordingly |
| Industry Joint | the Iron Hand | Half professor, half tech company. | Half flesh, half machine |
| Near Retirement | the Space Wolf | A legend of the field, counting down to retirement. | A grey-haired Long Fang |
| Serial Founder | the Alpha Legionnaire | Three startups, and nobody is sure which one is real. | Many heads, hidden plans |
| Methods Purist | the Iron Warrior | No result survives without ten seeds and a significance test. | Siege mathematics; never satisfied |
| ★ Kind and Funded (Arthur) | **the Dark Angel** | Kind, well funded, and never satisfied with borderline work. | The First Legion, and a nod to WorkInTheDark |

Spare Legions for future archetypes:
- **Salamanders (XVIII):** the most humane Legion, for a future kind archetype.
- **Emperor's Children (III):** the perfectionist about figure aesthetics.
- **Death Guard (XIV):** the advisor who has outlasted every dean.
- **Sons of Horus (XVI):** the charismatic rising star.
- **Word Bearers (XVII):** preaches one pet theory.

Night Lords (VIII) and World Eaters (XII) are left out on purpose: their lore is terror and rage, which reads as an abusive advisor and breaks the no-serious-topics rule.

Quirks and signature events stay plain. For example, "your draft comes back with a comment on every sentence" for the Imperial Fist, or "they won't accept a result without ten seeds" for the Iron Warrior. Each Legion's signature event candidates are in `event-ideas.md`, section G.

What the parameters do:
- **Funding:** chance of a TA semester (Fund 1: 80%, 2: 60%, 3: 35%, 4: 15%, 5: 5%); conference travel approval; compute (experiment speed for empirical projects).
- **Availability:** how often meetings happen and how much they help; how fast blocked work gets unblocked.
- **Kindness:** Sanity effects of advisor events; how failures are received.
- **Standards:** whether the advisor blocks a submission below a quality bar; whether they allow starting defense prep with the third paper still under review; a quality bonus. The graduation bar itself is the same for everyone (section 3.4).
- **Fame:** letters, network gains, the job market, a small citation multiplier.
- **Stability:** the yearly chance of an "advisor is leaving" arc.

### 7.2 Advisor matching (Year 1, T1–T8)
- Three candidates are drawn from the pool. Each is introduced with a profile, a meeting, and rumors from senior students.
- **Rumors are about 70% accurate.** The player can spend free days rotating with a lab to learn more.
- The player chooses by T8. If a candidate's funding falls through, a replacement may appear.
- Later arcs can force or allow a switch (advisor leaves, irreparable conflict); new candidates are then drawn.

### 7.3 The Kind and Funded advisor (Arthur)
- **Shown as:** the Dark Angel (I), through `{advisor.nick}`. The archetype label is "Kind and Funded".
- **Rarity:** weighted so that it appears among the three candidates in about 1 run in 12.
- **Achievements:** "Found the Unicorn" for choosing it; "The One That Got Away" for being offered it and choosing someone else.
- **Signature events,** each echoing a PhD 101 episode:
  - *The Ten Questions:* before a project starts, the advisor walks you through Judy Olson's ten questions. Doing well raises the project's novelty and soundness. (Judy's Ten Questions)
  - *87 Comments:* a draft comes back covered in critique; how you react matters. (Critique-Centric Feedback)
  - *Not Borderline:* the advisor suggests skipping this deadline for the next one to make the paper strong rather than borderline. (Hold Yourself to a High Standard)
  - *Close the Laptop:* after a run of overtime, the advisor tells you to take a real break. (When and How to Rest)
  - *Your Direction, Not Mine:* the advisor backs your idea over their own. (Find Out What You Are Devoted To)
- **Quirks:** four fixed quirks, Arthur's real ones. Each has an always-on effect, so the advisor feels consistent turn after turn, plus signature events (candidates in `event-ideas.md`, section G):

| Quirk | Always-on effect | Signature moments |
|---|---|---|
| **Meticulous about layout and visual detail:** orphan words, consistent capitalization, figure fonts | The Writing stage takes about 10% longer; Clarity +10%; Writing skill grows 20% faster from writing days | A draft returned with one circled orphan word; headings that mix Title Case and Sentence case; 6-pt axis labels sending a figure back for round four; the result line "You now notice orphan words in other people's papers." |
| **Always finds the major flaw,** and asks the hard but critical question | Before each submission, a *The Question* event names the paper's weakest quality component (Novelty, Soundness or Clarity) in plain words. Days spent fixing it before submitting cancel that concern in reviews. A practice talk with the advisor before quals, the proposal, the defense or a job talk gives a prep bonus in Committee Q&A. | A practice talk where one question makes the whole argument wobble; reviews arriving with the exact question asked three weeks earlier, and you already have the answer (rebuttal bonus); a defense whose hardest question is easier than lab meeting's |
| **Replies at strange hours,** midnight included | Feedback never stalls: work waiting on the advisor is unblocked within the same turn. The replies always say there's no need to answer before Monday, so the quirk never pushes the player into overtime. | 30 comments arriving at 12:07 am, ending with "No need to reply until Monday"; a 1:12 am email that just says "Great figure."; with the Night Owl trait, a midnight email thread that becomes the best idea of the year |
| **Buys bubble tea for everyone at in-person lab meeting** | Each turn you attend lab meeting in person: Sanity `+2±1`, plus a slow rise in the Labmates relationship. Travel, sickness and the internship make attendance remote. | Tired, you could join on Zoom, but there's bubble tea in the room; the advisor remembers your order; you're sent to collect 14 drinks at 14 different sugar levels |

  - **PhD 101 links:** the layout quirk ties to *Hold Yourself to a High Standard* and *Paper Writing 101*; the hard question to *Critique-Centric Feedback*; the midnight replies, through "no need to reply until Monday", to *When and How to Rest*.
  - **Ending easter egg:** a run with the Dark Angel that reaches the Bubble Tea Shop Owner ending gets the epilogue line "You still make their order from memory."

### 7.4 Labmates
- Lab size depends on the advisor (2–8 others).
- Each labmate has a generated name, year, a personality from a pool (Helpful Senior, Competitive Peer, Chaotic Genius, Quiet Workhorse, Social Glue, Perpetual Fifth-Year, Industry Dreamer…), a hidden relationship with you, and a trajectory of their own: they publish, graduate, quit, win awards, and start startups.
- One senior labmate is the **tip-giver** for PhD 101 tips (section 13).
- New students arrive each T26; from Year 3 you can become someone's mentor.

### 7.5 Committee members
Generated faculty for quals, proposal and defense, each with a field, a personality ("asks about statistics", "always 20 minutes late", "industry external member", "secretly your biggest fan"), and a question pool.

---

## 8. Research

### 8.1 Project types

| Type | Stages | Main skills | Waiting time you can't speed up |
|---|---|---|---|
| Empirical NLP (method, model, analysis) | Idea → Lit review → Pilot → Experiments → Writing | Taste, coding, writing | Compute queue (by advisor funding) |
| Human-centered study (interviews, surveys, user studies) | Idea → Lit review → Study design → IRB → Recruiting → Sessions → Analysis → Writing | Taste, domain, writing | IRB review, recruiting |
| System + evaluation | Idea → Lit review → Build → IRB → Study → Analysis → Writing | Coding, domain, writing | IRB review, recruiting |
| Dataset / benchmark | Idea → Lit review → Annotation design → Annotation → Baselines → Writing | Domain, coding, writing | Annotator turnaround |
| Position / survey | Idea → Lit review (long) → Writing | Knowledge, writing | none |

Type ids used in data files: `empirical`, `study`, `system`, `dataset`, `position`. Phase 1 ships the first two types; Phase 2 adds the rest.

**Waiting stages** (IRB, recruiting, annotation turnaround, compute queue) advance by calendar time rather than days: putting more days on them does nothing, which is exactly as frustrating and realistic as it sounds. Events can shorten or lengthen them.

### 8.2 Progress
Each stage needs 100 progress points. Each day assigned to the project adds:

```
progress = stage_rate × efficiency(energy) × sanity_factor × skill_factor × roll(±20%)
skill_factor = 0.6 + 0.8 × (relevant_skill / 100)       # 0.6–1.4
```

With `stage_rate ≈ 10`, an average student finishes a normal stage in about 10 days.

**Context switching:** each project beyond the second worked on in the same turn costs 10% efficiency on all project days that turn.

### 8.3 Quality
Each project has three hidden quality components, 0–100:
- **Novelty (N):** from idea and lit-review days (taste, knowledge), topic hype, and scoop events.
- **Soundness (S):** from pilot, experiment, study and analysis days (coding, domain), and from compute and sample size.
- **Clarity (C):** from writing days (writing skill).

Each component is the average relevant skill applied over that stage's days, times how complete the stage was:
- A stage can be cut short. Submitting with Writing at 60% caps Clarity accordingly. **Rushing shows up in reviews, not in the progress bar.**
- Submission becomes possible once Writing reaches 50%.
- A strict advisor may block a submission whose quality is below their bar.

Overall paper quality for reviewing: `Q = wN·N + wS·S + wC·C`, with venue-specific weights (NLP venues weigh Soundness more; CHI weighs Novelty, meaning contribution, and Clarity more).

### 8.4 Topics and hype
- At run start, 6–8 research topics are drawn from a pool of about 30, for example LLM evaluation with clinicians, explanations for question answering, children's reading comprehension, mental-health language models, human-AI co-writing, annotator disagreement, decision support in the EHR.
- Each topic has a **hype** level (0–100) that random-walks each turn, with shocks from world events.
- Hype affects citations (×0.5 to ×2), reviewer interest (Novelty bonus), competition (scoop risk), and internship and job fit.
- **Scoops:** per-turn chance about `0.005 × hype / 50` for a project between Lit review and Writing. Severity is rolled: partial overlap, or the same idea.

### 8.5 Authorship
- **First-author projects** are yours and count toward graduation.
- **Co-author projects** come from labmates, collaborators and internships. You contribute days, they count as papers and citations, but not toward the graduation bar.
- Authorship order can be negotiated in events (with consequences for labmate relationships).

### 8.6 Venues and decisions
- **Tiers:** Top (ACL, EMNLP, NAACL, CHI, NeurIPS, ICLR), Mid (EACL, IUI, AMIA), Findings, Workshops, Journals (TACL, TOCHI, JAMIA).
- **Review model:**
  - Each of 3 reviewers scores `Q + persona_bias + noise(σ = 12)`, mapped to the venue's scale.
  - An area chair or meta-reviewer combines the scores, the rebuttal effects and some noise, and compares against the venue threshold.
- **Possible outcomes:** accept, Findings (ARR only), reject, Revise & Resubmit (CHI, journals), desk reject (page limit, anonymity, formatting events).
- **Thresholds are tuned** so that top-venue acceptance is roughly 25% at Q = 60, 60% at Q = 75 and 85% at Q = 85 (targets, section 17).
- **Resubmission:** a rejected paper can be revised (a Revise stage, with quality gains for addressing the earlier concerns) and resubmitted. ARR resubmissions carry their old reviews.

### 8.7 Preprints and camera-ready
- **Posting to arXiv** at submission brings citations earlier and some scoop protection, plus a small chance of anonymity drama.
- **Camera-ready** is a short Writing stage after acceptance. Promises made in the rebuttal must be delivered here; broken promises lower the advisor relationship (Deliver Your Commitments).

### 8.8 Citations
Each paper or preprint runs its own citation process:

```
annual_mean = venue_base × exp((Q − 60) / 20) × hype_mult × network_mult × arxiv_mult
venue_base: top 12, journal 10, mid 8, findings 6, workshop 2
ramp: 40% of the mean in year 1, 80% in year 2, 100% after, then slow decay
per-turn citations ~ Poisson(annual_mean × ramp / 26)
```

- **Breakout papers:** at publication, about a 3% chance (scaled by Q and hype) of a ×5 to ×20 multiplier.
- **Spikes from events:** a viral thread, a survey that cites you, a big lab building on your work.
- **Self-citation:** each later paper of yours cites your earlier ones (+1 each), which feeds an achievement.
- **h-index** is computed exactly from the paper list.

---

## 9. Mini-games

### 9.1 Rebuttal (Phase 1)
Triggered when reviews arrive at a venue with an author response window.

**Reviews.** Each of the 3 reviews has:
- a score and a confidence level
- a **persona**, partly hinted by the review's wording
- 2–4 **concerns** drawn from a pool, weighted toward the paper's weak components:
  - low Soundness: missing baseline, small sample, no significance test, one dataset only
  - low Clarity: hard to follow, unclear motivation
  - low Novelty: incremental, "similar to {fake_prior_work}"
  - plus persona-specific concerns

Each concern has a severity (minor or major) and a validity (a real issue, or a misreading).

**Personas (pool of about 10):**
- The Expert: confident and fair.
- The Skimmer: low confidence, misreads.
- Reviewer 2: harsh, hard to move.
- The Champion: already likes it.
- The Citation Seeker: wants their paper cited.
- The Scope Police: "this is not an NLP paper".
- The Baseline Hunter: "why not compare to {model}".
- The LLM-Written Review: vague and generic.
- The Methodologist: statistics, always statistics.
- The Silent One: never reads the response.

**The player's budget:**
- **5 response slots**, standing in for the word limit.
- **This turn's free days,** which can go to new experiments.

**Responses to each concern:**

| Response | Cost | Works best when |
|---|---|---|
| Clarify | 1 slot | The concern is a misreading (writing check) |
| Concede and promise a fix | 1 slot | The concern is minor; the promise must be kept in camera-ready |
| New result | 1 slot + 2–4 days + Energy | Soundness concerns; coding check; the new result can come out worse |
| Push back politely | 1 slot | The concern is invalid and the persona is open-minded |
| Skip | 0 | Minor concerns, or the Silent One |
| Flag the review to the AC | 1 slot | The review looks LLM-written; chance the AC discounts it |
| Passive-aggressive reply | 1 slot | Almost never; 2% legendary success, with an achievement |

**Resolution.**
- Each reviewer's score moves by the sum of the response effects × the persona's openness, plus noise.
- The AC then decides, and the updated scores and a templated meta-review are shown.
- Making a concern its own content item means each new paper produces a different rebuttal. The concern pool targets about 120 entries.

**CHI variant (Phase 2):** Revise & Resubmit over 3 turns. Responses become revision tasks the player assigns days to; reviewers then re-score.

### 9.2 Later mini-games

| Mini-game | Phase | Sketch |
|---|---|---|
| Committee Q&A (quals, proposal, defense) | 2 | 3–5 committee members ask questions drawn from your projects' weak spots; answer strategies: direct, acknowledge the limitation, reframe, "great question" stall; scored on hidden skills and prep days |
| Poster session | 3 | 6 visitor slots (famous prof, curious student, recruiter, the person who explains your poster to you, a competitor); choose the pitch length; outcomes: network, job leads, citations |
| Job talk and interviews | 3 | Talk structure choices, Q&A, one-on-ones; feeds offers |
| Deadline night | 3 | 12 hours left, a task list (fix Figure 2, rerun an ablation, write the limitations, trim to the page limit, fix the bibliography) and random disasters (Overleaf compile timeout, a co-author edits main.tex at 11:58 pm); affects quality and desk-reject risk |

Each mini-game draws its content from pools so it plays differently every time.

---

## 10. Life layers

Six layers run at the same time; each contributes scheduled events and a random pool.

### 10.1 Academic milestones
- **Orientation** (Year 1 T1), **advisor matching** (T1–T8), coursework.
- **First project,** often inherited from a senior labmate (Year 1 T6–T10).
- **Quals,** the **proposal** (with committee formation), the **annual progress review,** **defense preparation** (6 turns, section 3.4), the **defense,** and graduation (the next commencement, T18 or T19).

### 10.2 Career
- **Internships:**
  - Applications T2–T8 (career-prep days raise the odds), interviews T6–T14, offers by T15.
  - Internship mode T20–T25: weekdays go to the internship (you only choose your weekends), with its own event pool (mentor archetype, abundant compute, a paper policy or NDA, the return offer).
  - Effects: Network, Coding, possibly a paper, and a return-offer flag that unlocks endings.
- **Fellowships** (Years 1–3): winning one removes TA duty for the year and adds prestige for the job market. Funding matters through TA days, not a meter.
- **Job market** (final year):
  - Choose tracks during T1–T5: academia, industry research, applied, startup, other.
  - Interviews T8–T16, then offers.
  - Offers are computed from papers (by venue tier), citations, network, the advisor's letter (relationship × fame), internships and topic fit.
  - The player picks one offer (which sets the ending) or defers with a postdoc.

### 10.3 Travel
- **Getting there:** an accepted paper at a conference triggers a trip decision.
  - **Approval:** a well-funded advisor approves it.
  - **Otherwise:** apply for a student travel grant (a chance), volunteer for free registration (costs conference-day time), or present remotely.
  - **International students** need a visa started several turns ahead, with a chance of delays; the worst case is a remote talk.
- **The trip** takes one turn and draws from a travel event pool:
  - jet lag and lost luggage
  - the poster session
  - a keynote that sparks an idea
  - a networking dinner, an industry booth
  - meeting your hero (rare)
  - food poisoning, sightseeing

  Base effect: Network `+8±3`.
- **Cities:** each conference-year gets a city from a pool, with its own flavor lines.

### 10.4 Life
- **Housing:** lease renewal at T26, rent increases, roommates, moving (costs days).
- **Health:** illness driven by hidden Health, dentist, sports injuries, flu season.
- **Relationships:** a light dating arc (meeting, dating, long distance; it fizzles out or it lasts), friends' weddings, friends moving away.
- **Family:** trips home over winter break, parents visiting, a cousin's wedding, calls across time zones.
- **Pets:** adopt a cat or dog (a Sanity buffer, plus achievements).
- **Hobbies:** trait-related arcs (marathon training, a band, a cooking phase).
- **Holidays and seasons:** Thanksgiving, Lunar New Year, Halloween, winter storms, the first warm day.

### 10.5 World
Generated at run start as a timeline, so each run lives through a different era:
- **Frontier model releases** every 6–14 turns, from fictional labs with fictional model names. Effects: hype shifts, "your baseline is obsolete", "your benchmark is saturated", "everyone suddenly wants evaluation papers".
- **Hiring climate** (boom, neutral, freeze), which shapes internships and the job market.
- **Funding climate,** which shifts advisor funding: TA odds, travel approvals, and the "grant not renewed" arc.

---

## 11. Events

### 11.1 Event schema
Events live in `_data/phd_sim/events/<category>.yml`. A full example; Appendix A has more.

```yaml
- id: clinician_reschedule
  title: "Rescheduled. Again."
  category: research            # research | publishing | advisor | lab | milestone | career
                                # | travel | life | world | wellbeing | absurd
  rarity: uncommon              # common | uncommon | rare | legendary
  weight: 1.0                   # optional multiplier on top of rarity
  repeatable: true
  cooldown: 3                   # turns before it can fire again in the same run
  arc: elusive_clinicians       # optional: part of a story arc
  when:                         # every condition must hold
    year: [1, 6]
    project: { type: study, stage: sessions }   # binds {project}
    flags_all: [has_clinical_partner]
  text:                         # one variant is picked at random
    - "Your clinician partner moves the interview session for the {counter.resched|ordinal} time."
    - "An email from the hospital: \"Can we push to next week? Clinic is slammed.\""
  choices:
    - label: "Wait for them"
      effects: { sanity: "-5±2", project.delay: 1 }
      counter: { resched: +1 }
      schedule: { event: clinician_reschedule, in: [1, 2], chance: 0.5 }
    - label: "Ask {advisor.nick} to email their department head"
      check: { stat: advisor_rel, vs: 50, spread: 20 }
      success:
        text: "Two days later, the sessions are back on the calendar."
        effects: { project.delay: -1, advisor_rel: "+2±1" }
      failure:
        text: "Your advisor sends the email. Nothing happens."
        effects: { sanity: "-3±1", advisor_rel: "-2±1" }
    - label: "Switch to interviewing nurses"
      effects: { energy: "-8±3", project.quality.S: "-5±3", project.quality.N: "+4±2" }
      flag_set: [study_pivot_nurses]
```

Arrows are derived automatically from each choice's visible effects (section 5.5). A `hint:` field can override them when needed.

### 11.2 Condition vocabulary (`when`, `requires`)

| Key | Example | Meaning |
|---|---|---|
| `year`, `turn` | `year: [2, 4]`, `turn: [20, 25]` | Ranges, inclusive |
| `semester` | `semester: [fall, break]` | fall, spring, summer, break |
| `stat` | `stat: { sanity: "<30", writing: ">=60" }` | Any visible or hidden stat |
| `advisor`, `advisor_not` | `advisor: [kind_funded]` | Archetype ids |
| `background`, `origin` | `origin: international` | |
| `traits_any`, `traits_none` | `traits_any: [night_owl]` | |
| `flags_all`, `flags_any`, `flags_none` | | Run flags set by earlier choices |
| `counter` | `counter: { rejections: ">=3" }` | Run counters |
| `project` | `project: { type: study, stage: irb }` | A matching project exists; binds `{project}` |
| `paper` | `paper: { status: under_review, tier: top }` | A matching paper exists; binds `{paper}` |
| `status_any`, `status_none` | `status_none: [on_internship]` | |
| `world` | `world: { hiring: freeze }` | World state |
| `chance` | `chance: 0.3` | Extra random gate |
| `any` | `any: [ {…}, {…} ]` | OR over sub-conditions |

A choice can carry `requires:` with the same vocabulary. A choice whose requirements are not met is hidden, which lets traits unlock extra options (shown with the trait's tag).

### 11.3 Effect vocabulary

| Key | Example | Meaning |
|---|---|---|
| any stat | `sanity: "-5±2"`, `writing: "+7±3"` | Rolled, scaled, clamped |
| `project.*` | `project.progress: "+10±5"`, `project.quality.N: "-15±5"`, `project.delay: 2` | Acts on the bound project |
| `days`, `days_next` | `days: -2` | Takes free days this turn or next |
| `status` | `status: { add: jet_lagged, turns: 1 }` | |
| `trait_add`, `trait_remove` | | |
| `flag_set`, `flag_clear`, `counter` | | |
| `schedule` | `schedule: { event: id, in: [1, 3], chance: 0.6 }` | Queue a follow-up |
| `start_project`, `start_arc` | | |
| `minigame` | `minigame: rebuttal` | |
| `achievement` | | Unlock directly |
| `ending` | | End the run now |

A `check: { stat, vs, spread }` makes a choice uncertain: `P(success) = clamp(0.5 + (stat − vs) / (2 × spread), 0.05, 0.95)`, with `success:` and `failure:` branches.

### 11.4 Templating
Event text can use tokens filled from the run's generated world:
- People: `{player.name}`, `{advisor.nick}`, `{advisor.name}`, `{labmate}`, `{labmate.senior}`, `{mentee}`, `{committee}`
- Work: `{project}`, `{project.topic}`, `{paper}`, `{venue}`
- World: `{city}`, `{model}` (the latest fictional frontier model), `{biglab}` (a fictional lab)
- Counters: `{counter.x}`, with filters such as `|ordinal` and `|plural`
- Random numbers: `{roll:200-600}`, rolled once per card

A token is bound once per event, so `{labmate}` is the same person throughout a card. Names come from a large, diverse pool of fictional names; no real public figures.

Project titles are generated from patterns ("Beyond Accuracy: Evaluating {Topic} with {Stakeholders}"), which also feeds the "Colon in Every Title" achievement.

### 11.5 Selection per turn
1. **Scheduled events** fire first (deadlines, milestones, reviews, arc follow-ups).
2. **How many random events:** 0 (25%), 1 (50%) or 2 (25%), minus the number of scheduled events (never below 0). Breaks and summers tilt toward life events.
3. **The eligible pool** passes the `when` conditions, the cooldown, and the repeatable flag.
4. **Weight** of each eligible event:

```
w = rarity_w × weight × novelty × balance × context
rarity_w: common 10, uncommon 4, rare 1.2, legendary 0.3
novelty:  never seen in any run 1.6 · seen last run 0.6 · seen two runs ago 0.8 · otherwise 1.0
          already seen this run (repeatable) 0.25
balance:  category over its target share in the last 6 turns 0.5 · under it 1.5
context:  event-specific boosts (for example wellbeing events ×2 when Sanity < 30)
```

5. **Sampling** is weighted, without replacement. At most one legendary event per in-game year.

### 11.6 Story arcs
- An arc is a chain of events sharing an `arc:` id, linked by `schedule` with delay ranges and chances, and branching on flags.
- At run start, 4–6 arcs are activated from the pool (weighted by background, origin and advisor). Others start from choices, for example adopting a cat starts the pet arc.
- Every arc has a graceful exit, so an unfinished arc never leaves dangling state.
- Target arc pool: 10 in Phase 2, 20 in Phase 3. Examples:
  - The advisor is leaving
  - Scooped
  - The elusive clinicians
  - The side startup
  - The dating arc
  - The labmate authorship feud
  - The grant that didn't renew
  - The viral paper
  - The visa saga
  - The marathon
  - The benchmark that got saturated
  - The undergrad mentee who turns out brilliant

### 11.7 Keeping runs from repeating
1. **Pool size.** The pool should hold at least 3× the random events one run draws. A run sees roughly 130–180 events in total.
2. **A generated world:**
   - labmates and their trajectories
   - advisor quirks
   - topics and their hype curves
   - conference cities
   - the world-event timeline
3. **Templated text** and variant texts per event.
4. **Arcs:** a different handful each run.
5. **Rarity and conditions:** many events need specific traits, backgrounds, advisors or earlier choices.
6. **Novelty weighting across runs:** the browser remembers what you've seen.
7. **Codex** (section 12.4) for completionists.
8. **Flavor lines:** quiet turns still produce one or two one-liners in the weekly log, drawn from a pool of 300 or more.

**How it's measured:** the headless simulator (section 15.6) reports the overlap in random events between consecutive runs. The target is under 35%, and a player should need about five runs to see half the pool.

---

## 12. Endings, titles, achievements, Codex

### 12.1 Endings
An end card has three parts: **career outcome + life epilogue + title**.

**Career outcomes (target 26):**
- **Academia:**
  1. Tenure-Track Professor
  2. Professor at a Teaching College
  3. Postdoc in a Famous Lab
  4. The Eternal Postdoc
  5. Lecturer Across the Pond
  6. Faculty Back Home (international)
- **Industry:**
  7. Research Scientist at a Frontier Lab
  8. Research Scientist at Big Tech
  9. Applied Scientist
  10. ML Engineer (with a PhD, for fun)
  11. Quant Researcher
  12. UX Researcher
  13. The Return Offer
- **Startup:**
  14. Founder, Acquired
  15. Founder, Pivoted to B2B SaaS
  16. Founder, Then Big Tech
  17. Employee #4 at a Labmate's Startup
- **Other paths:**
  18. Policy Fellow
  19. Science Journalist
  20. AI YouTuber
  21. Clinical Informatics at a Hospital
- **Leaving:**
  22. Master's Out, Happily
  23. Bubble Tea Shop Owner
  24. Switched Fields (med school or law school)
  25. Back to the Family Business
  26. The Eternal Student (hit the Year 8 cap)

**How the ending is decided:**
- Graduating runs end with the offer the player chose from the job market.
- Leaving endings come from choices (quit events, outside offers) or from the cap.
- No ending is framed as a loss.

**Life epilogue:** 3–5 lines chosen from run flags and stats: partner, pets, health, friends, what happened to your labmates and your advisor, the afterlife of your most-cited paper ("still cited, mostly for the dataset"), your hobby.

**Titles (target 30),** chosen by rules over the run's stats. Examples:
- The Prolific
- Citation Machine
- The Unbreakable
- Burnt-Out Genius
- Work-Life Balance Champion
- Reviewer 2's Nemesis
- The Networker
- Lone Wolf
- Lab Parent
- Globetrotter
- Slow Is Smooth

### 12.2 End card
- Ending name, title and epilogue.
- **Your PhD in numbers:** every hidden stat revealed, the paper list, a citation sparkline, events discovered this run, and the rarest event you saw.
- Recommended PhD 101 episodes (section 13.2).
- **Play again** and **Share** (a PNG card in Phase 3).

### 12.3 Achievements
- Target 100 (50 in Phase 2), each with `id`, `name`, `description`, `secret`, and a `condition` in the same vocabulary as events, evaluated against run stats.
- Secret ones stay hidden in the Codex until earned.
- A draft list is in Appendix C.

### 12.4 Codex
A collection screen with discovered/total counts for events (by category and rarity), arcs, endings, titles, achievements, advisors met and traits.

Discovered events show their text and the outcomes you actually got, as text. The Codex never shows effect ranges, consistent with the arrows-only rule.

### 12.5 Challenge modes (Phase 3; unlocked after the first graduation)
- Ironman: one save, no restarts.
- Hardcore Realism: harsher thresholds, longer IRB.
- Unfunded: low-funding advisors only.
- Lone Wolf: no labmates.
- Daily Seed: everyone gets the same world today.

---

## 13. PhD 101 tie-in

### 13.1 In-game tips
- A senior labmate occasionally offers a one-line tip at a fitting moment, with a "Read: *episode title*" link. At most one tip every 6 turns.
- The Kind and Funded advisor's signature events (section 7.3) echo the series' maxims.
- Tips live in `tips.yml` with a trigger condition, the text, and the episode's `topic`.
- Any event can also carry `tip: { topic: "…" }`, shown as a link under its result (see `kf_not_borderline` in Appendix A).

### 13.2 End-of-run recommendations
Two or three episodes, chosen by rules over the run's telemetry. Every episode has at least one trigger:

| Play pattern | Episode topic (current number) |
|---|---|
| Burned out at least once | How Burnout Begins (4.1) |
| Many overtime days, crunch habits | How to Spend a Day (4.4) |
| Rarely took real breaks | When and How to Rest (4.3) |
| Ignored health warnings | Know Your Limits (4.2) |
| Spiraled after comparison events | Toxicity of Peer Pressure (1.3) |
| Broke rebuttal promises or missed deliverables | Deliver Your Commitments (1.2) |
| Submitted rushed papers | Hold Yourself to a High Standard (1.1) |
| Sanity crashed after reviews | Critique-Centric Feedback (0.3) |
| Considered quitting | Sustain Through the Journey (1.5) |
| Left without the degree | Outcome of PhD Training (0.5) |
| Always followed the advisor's direction | Find Out What You Are Devoted To (1.6) |
| Chased citations above everything | Self-Motivation (0.4) |
| Heavy coursework focus in Year 1 | Research Is Not Homework (0.1) |
| Wondering why you're here (early quit events) | Benefits of Research (0.2) |
| Few reading days | Paper Reading (2.2), Literature Search (2.1) |
| Leaned on labmates to fix things | Learning How to Learn (1.4), Self-Learning Skills (2.3) |
| Unproductive advisor meetings | Project Meeting (2.4) |
| Clarity concerns in reviews | Paper Writing 101 (2.5), How to Communicate (2.6) |
| Struggled at the proposal | Judy's Ten Questions (3.1), Research Question (3.2) |
| Scooped or "incremental" reviews | Stakeholders and Gap (3.3) |
| Methods concerns in reviews | Approach and Methods (3.4) |
| Study-design trouble in HCI projects | Understanding Workflows (3.5) |
| Results-interpretation concerns | Results and Findings (3.6) |
| Venue mismatch rejections | Implications and Venue (3.7) |

### 13.3 Stable links
Episode URLs are `/phd101/<chapter>.<episode>/`, and chapters get renumbered, so the game never hard-codes them:
- Game data refers to episodes by their `topic:` frontmatter value.
- At build time, Liquid builds a `topic → {title, url}` map from `site.phd101` and ships it with the game data (section 15.2).
- The validator fails if a referenced topic doesn't exist. Renaming a topic means updating game data, and the validator will catch it.

---

## 14. UI and UX

### 14.1 Screens
1. **Title:** New PhD, Continue, Codex, Achievements, How to Play, Settings (text size, reduced motion, stop at each semester).
2. **New PhD:** name, background, origin, traits.
3. **Main turn screen** (below).
4. **Event card:** a modal, framed by rarity.
5. **Mini-game screens.**
6. **Annual progress review letter.**
7. **End card.**
8. **Codex and achievements.**

### 14.2 Main turn screen

```
Year 2 · Oct 13–26 · Fall                     [Codex] [How to play] [Leave] [Menu]
Energy ███████░░░ 68   Sanity █████░░░░░ 52   Citations 37 (h 3)   Papers 2 +1
Taste ▃ 41  Coding ▅ 55  Writing ▄ 47  Presenting ▃ 38  Knowledge ▅ 52
[Advisor: the Dark Angel] [TA]

LAST TURN: Y2 SEP 29–OCT 12
  Energy 75 → 68   Writing 45 → 47   Citations 31 → 37
  Beyond Accuracy: Writing 40% → 62%
  Reviews are in for "Who Reads the Explanation?": 3, 4, 2 out of 5.

THIS TURN                                                        ● ● ○ ○
  Choose 4 things to do these two weeks (the rest goes to TA duty).
  [Work on "Beyond Accuracy" ×2]  [Read papers]  [See friends]  [Rest] ...
  Weekends: [Off (recover) ▾]
  Also this turn:  ☑ Submit "Beyond Accuracy" to ACL   ☐ Apply for a fellowship
  [Same as last turn]                                         [End turn ▸]
```

### 14.3 Event card

```
┌ UNCOMMON · Research ────────────────────────────┐
│ Rescheduled. Again.                             │
│ Your clinician partner moves the interview      │
│ session for the 3rd time.                       │
│                                                 │
│ [ Wait for them                       ↓ Sanity ]│
│ [ Ask the Dark Angel to email their PI    ↕    ]│
│ [ Switch to interviewing nurses       ↓ Energy ]│
└─────────────────────────────────────────────────┘
```

After the choice: a result line, the visible changes as numbers ("Sanity −6"), and at most two lines for hidden changes.

### 14.4 Layout, style, accessibility
- **Layout:** mobile first. One column on phones with a sticky stats header and a bottom action bar; two columns on desktop (board and planner on one side, calendar and log on the other).
- **The planner** uses − / + steppers rather than drag and drop.
- **Style:**
  - Matches the site's fonts and the `--global-*` CSS variables.
  - Game colors are `--phdsim-*` variables with light and dark values, following the `--phd101-accent*` pattern in `_sass/_themes.scss`.
  - Rarity colors must pass contrast in both themes.
- **Accessibility:**
  - Arrows carry text labels ("Energy down"), so color is never the only signal.
  - Keyboard: 1–4 pick choices, Space continues.
  - Results are announced through `aria-live`.
  - `prefers-reduced-motion` is respected.

---

## 15. Technical architecture

### 15.1 Files

```
_pages/phd-simulator.md          # page shell, permalink /phd-simulator/
assets/css/phd-sim.css           # styles (plain CSS so the dev page can use it too)
_data/phd_sim/
  config.yml                     # every tuning number
  calendar.yml  venues.yml  advisors.yml  traits.yml  statuses.yml
  backgrounds.yml  topics.yml  names.yml  flavor.yml  tips.yml
  reviews.yml                    # personas, concern pool, comment fragments
  endings.yml  titles.yml  epilogues.yml  achievements.yml
  events/<category>.yml
  arcs/<arc>.yml
assets/phd-sim/data.json         # Jekyll-rendered JSON: game data + PhD 101 map
assets/js/phd-sim/
  main.js                        # boot, load data, mount UI
  engine/                        # pure logic, no DOM; runs in browser and Node
    game.js (turn loop and plans) state.js rng.js util.js data.js derived.js
    conditions.js effects.js events.js templating.js projects.js reviews.js
    citations.js people.js world.js milestones.js endings.js achievements.js save.js
  ui/                            # rendering only
    app.js (flow and input) gameview.js (stats, planner, report, projects, log)
    prompts.js (events, rebuttal, Q&A, matching) screens.js (setup, codex, end card)
tools/phd-sim/                   # excluded from the site build
  export-data.rb                 # YAML → JSON with the same shape as data.json
  validate.mjs                   # schema and reference checks
  simulate.mjs                   # headless bot runs → balance report
  serve.py, dev/index.html       # no-cache dev server and dev page
  tests/*.test.mjs               # node --test
docs/phd-simulator/design.md     # this file
```

### 15.2 Data pipeline
- Content is authored in YAML under `_data/phd_sim/`, which Jekyll exposes as `site.data.phd_sim`, subfolders included.
- `assets/phd-sim/data.json` is a Jekyll page with `layout: none` that writes `{{ site.data.phd_sim | jsonify }}` together with the PhD 101 map:

```liquid
{%- assign eps = site.phd101 | sort: "episode" | sort: "chapter" -%}
{"phd101": { {%- for e in eps -%}
  {{ e.topic | jsonify }}: {"title": {{ e.title | jsonify }}, "url": {{ e.url | relative_url | jsonify }}}
  {%- unless forloop.last -%},{%- endunless -%}
{%- endfor -%} },
 "data": {{ site.data.phd_sim | jsonify }} }
```

- The page fetches the JSON once; the browser caches it.
- Conditions and effects are plain data interpreted by the engine. Nothing is ever `eval`'d.

### 15.3 Engine
- The engine is pure functions over a state object and a seeded RNG, with no DOM access. The same code runs in the browser and in the Node simulator.
- **RNG:** a small seeded PRNG (sfc32 or mulberry32) with separate streams for world generation, events, rolls and reviews. The same seed gives the same world even when choices differ. RNG states are saved, so a resumed run continues exactly.
- **Daily Seed** derives the seed from the date.

### 15.4 Saves
- **Two keys:**
  - `phdsim:run:v1` holds the current run, with history stored as event ids to stay compact.
  - `phdsim:meta:v1` holds what persists across runs: the Codex, achievements, the seen-events history used for novelty weighting, unlocks and settings.
- Every read and write sits in try/catch. If storage is unavailable, the game runs in memory and shows a small "progress won't be saved" note.
- Each save carries a schema version, with a migration function.
- Save export and import as a text code arrives in Phase 3.

### 15.5 Build risk: the JS minifier
Production builds (`JEKYLL_ENV=production` in `deploy.yml`) run `jekyll-minifier` with Uglifier in `harmony` mode, which may reject modern syntax such as ES modules, optional chaining or `??`.

**Resolved:** `assets/js/phd-sim/*` and `assets/phd-sim/*` are in `jekyll-minifier.exclude` (the gem matches with `File.fnmatch`, where `*` also crosses `/`), so the modules and the JSON are served as written; a production build was verified locally. The engine also sticks to ES2017 syntax as a second line of defense.

### 15.6 Tooling (no npm dependencies)
- **`export-data.rb`:** Ruby's standard YAML library turns `_data/phd_sim` into JSON, so the Node tools run without a full Jekyll build.
- **`validate.mjs`:**
  - unique ids
  - every `schedule`, `start_arc` and `achievement` reference resolves
  - every template token is known
  - every `topic` exists in `_phd101`
  - effect strings parse
  - no event is unreachable (its conditions can never all hold)
- **`simulate.mjs`:** runs N runs with simple bot policies (balanced, workaholic, slacker, random) and reports:
  - graduation-time distribution
  - ending, title and achievement frequencies
  - burnouts per run
  - acceptance rates by tier
  - citations at graduation
  - events seen per run, overlap between consecutive runs, and pool coverage
- **Unit tests:** `node --test` (built into Node 20).
- **CI (optional, later):** add a Node step to `deploy.yml` that runs the validator before `jekyll build`.

### 15.7 Page shell
`_pages/phd-simulator.md` uses `layout: page` and `permalink: /phd-simulator/`, with the title "PhD Simulator".

**Navbar:** the page gets its own tab right after PhD 101. Current orders are CV 2, PhD 101 4, Prospective Students 5, Hobby 6. At launch the game takes `nav_order: 5`, Prospective Students moves to 6 and Hobby to 7. Until launch the page stays at `nav: false` so the unfinished game is reachable only by its URL.

Its body is one mount point and `<script type="module" src="{{ '/assets/js/phd-sim/main.js' | relative_url }}">`. Mini-game modules load lazily.

No analytics by default.

---

## 16. Content pipeline and style

### 16.1 From story to event
1. **Intake.** Arthur shares stories in chat or in a private file outside this repo. **The repo is public, so raw stories never go in it.**
2. **Draft.** Claude turns each story into event YAML (single events, arcs, flavor lines, reviewer concerns, calibration numbers), fictionalized.
3. **Review.** Arthur checks realism and tone.
4. **Validate** with `validate.mjs`.
5. **Playtest:** a simulator report plus manual play.

### 16.2 Privacy rules
- No real names, institutions, hospitals or identifiable projects. Change details and combine stories.
- Real reviews are paraphrased, never quoted.
- Students' stories are used only with their permission.
- No real companies or model names; frontier labs and models are fictional.

### 16.3 Writing style
- Second person, present tense.
- **Event text:** 1–3 sentences, ideally under 280 characters.
- **Choice labels:** 6 words or fewer.
- Humor targets the system, never the player or real people.
- **No serious topics, in any phase:**
  - no illness beyond colds, flu and sprains
  - no grief or family emergencies
  - no harassment, abuse or discrimination
  - no mental-health crises, self-harm or politics

  Burnout appears only as a recoverable game status, framed lightly, with a link to the wellbeing chapter. Visa trouble is paperwork and delays, never policy.
- **Fan reference:** the Legion nicknames are Games Workshop names, used as a non-commercial fan nod. Names only: no logos, artwork or iconography.
- Every event offers at least one choice that is reasonable, not just a least-bad one.

---

## 17. Balance targets

Design targets to tune toward, to be calibrated with Arthur's stories and playtests. They are not claims about real-world statistics.

| Measure | Target |
|---|---|
| Five-year run length | 25–40 minutes (one plan per turn, about 0.5 pop-ups per turn) |
| Median time to graduate | 5.0–5.5 years |
| Extends past Year 6 | 10–20% of runs |
| Hits the Year 8 cap | under 5% |
| Leaves early (any reason) | 10–20% of runs |
| Tenure-track ending | about 1 in 8 graduating runs, needs a strong profile |
| Top-venue acceptance, average paper | 20–30%; better on resubmission |
| Citations at graduation | median 150–400; about 5% of runs above 1,000 |
| Burnout | a player who never takes weekends off burns out at least once by Year 2 |
| Random-event overlap, consecutive runs | under 35% |
| Runs to see half the event pool | about 5 |

Every number above maps to a knob in `config.yml`.

**Measured after the 2026-10-16 redesign** (`simulate.mjs 1000`, four bot policies):
- **Graduation:** a reasonable player (mostly research, reacting to Energy and Sanity) graduates 87% of the time, typically in Year 5, with a median of 4.4 years elapsed and no burnouts.
- **Crunch:** working every weekend still graduates 78% of the time but burns out about 10 times.
- **Neglecting research:** bots that mostly skip it graduate under 40% of the time, usually as Eternal Students.
- **Pop-ups:** about 0.4–0.6 per turn, counting events, the rebuttal, Q&A and offers. Before the redesign it was more than 1 per turn.
- **Acceptance (first-author, decided):** about 30% at top venues including Findings, 26% mid-tier, 59% workshops. By year of submission: 11% in Year 2, 22% in Year 3, 36% in Year 4, 42% in Year 5.
- **Citations at the end:** median about 120 for a reasonable player.
- **Endings:** every one of the 26 is reached across the simulator and a random-choice probe.
- **Random-event overlap between consecutive runs:** about 30%, now under the 35% target because each run sees fewer events.

---

## 18. Roadmap

### Phase 1: engine and vertical slice (Years 1–2)
**Builds:**
- Minifier check (section 15.5), page shell, styles.
- Turn loop (originally a routine with auto-continue; replaced by per-turn plans on 2026-10-16).
- All stats (visible and hidden), rolled effects, arrows, statuses.
- 12 traits, 4 backgrounds × 2 origins.
- Advisor matching with 6 archetypes including Kind and Funded; labmates.
- Projects (empirical and study types), ARR, CHI and workshops, reviews, the rebuttal mini-game, citations.
- Annual review.
- 40 events, 2 arcs, 100 flavor lines.
- Saves, validator, simulator, unit tests.

**Done when:** Years 1–2 play start to finish on a phone and on desktop in about 12–15 minutes, the simulator report is within targets for those years, and Arthur signs off after playtesting.

### Phase 2: the full PhD, then launch
**Builds:**
- Years 3–8, quals, proposal and defense, with Committee Q&A.
- Internships, fellowships, travel, the job market.
- Life and world layers.
- All 5 project types and the full venue set.
- 150 events, 10 arcs, 300 flavor lines.
- 26 endings, 30 titles, epilogues, 50 achievements.
- Codex, PhD 101 tips and recommendations, end card, How to Play.

**Launch:** the navbar tab goes live right after PhD 101 (section 15.7).

### Phase 3: replay depth
- Poster, job talk and deadline-night mini-games.
- Challenge modes, Daily Seed, the shareable PNG.
- 300+ events, 20 arcs, 100 achievements.
- Save export and import.

### What v1 includes (2026-10-15)
- **Built:** everything in Phases 1 and 2.
- **From Phase 3:** the job talk (as a Committee Q&A stage), Daily Seed, a shareable PNG end card, and "copy summary".
- **Content:** 250 events from Arthur's selected ideas, 91 reviewer concerns, 13 reviewer personas, 63 committee questions, 119 flavor lines, 26 endings, 26 titles, 53 achievements, 28 PhD 101 tips.
- **Not built yet:**
  - the poster-session and deadline-night mini-games
  - challenge modes
  - save export and import
  - the advisor-leaving arc (Arthur didn't select it, so advisor stability is unused)

### Phase 4: community
- A "Submit an event" GitHub issue template and a short contributor guide.
- Seasonal events.

---

## 19. Open questions

Resolved on 2026-10-15:
- Legion nicknames, with Arthur as the Dark Angel (I)
- the navbar tab after PhD 101
- graduation by defense with at least 3 publications and 3 months of prep
- no serious topics
- the Dark Angel's four quirks (section 7.3)
- **Publications:** only first-author papers count toward the 3; co-authored ones do not (they still count as papers and citations)
- **The proposal:** stays required before defense prep
- **Early start:** defense prep may start with the third paper still under review

Decided by Claude on Arthur's instruction to finish without further input (2026-10-15):
- **Real venue names** with approximate dates
- **Advisor matching:** always three candidates
- **Double arrows** (`↑↑`) for big effects
- **No global stats**
- **The Year 8 cap** is kept

No open questions remain. Content rules for writing event data are in `content-spec.md`.

---

## Appendix A: Example events

```yaml
# A common research event
- id: gpu_queue
  title: "The Queue"
  category: research
  rarity: common
  repeatable: true
  cooldown: 4
  when:
    project: { type: empirical, stage: experiments }
  text:
    - "There are {roll:200-600} jobs ahead of yours on the cluster."
  choices:
    - label: "Wait it out"
      effects: { project.progress: "-8±3", sanity: "-2±1" }
    - label: "Ask {labmate} for their reservation"
      check: { stat: labmates_rel, vs: 55, spread: 15 }
      success: { effects: { project.progress: "+5±2", labmates_rel: "-2±1" } }
      failure: { effects: { labmates_rel: "-4±2", sanity: "-2±1" } }
    - label: "Shrink the experiment"
      effects: { project.progress: "+4±2", project.quality.S: "-4±2" }

# A world event that hits one of your projects
- id: frontier_release_baseline
  title: "{model} Is Out"
  category: world
  rarity: uncommon
  when:
    project: { type: empirical, stage: [experiments, writing] }
    flags_none: [baseline_updated_this_release]
  text:
    - "{biglab} releases {model}. Zero-shot, it beats your fine-tuned system."
  choices:
    - label: "Add it as a baseline"
      effects: { days: -3, energy: "-6±2", project.quality.S: "+6±3" }
      flag_set: [baseline_updated_this_release]
    - label: "Reframe the paper around it"
      check: { stat: taste, vs: 55, spread: 20 }
      success: { effects: { project.quality.N: "+8±3", sanity: "+3±1" } }
      failure: { effects: { project.progress: "-15±5", sanity: "-4±2" } }
    - label: "Pretend you didn't see it"
      effects: { sanity: "+2±1" }
      flag_set: [ignored_new_model]   # reviewers will bring it up later

# A signature event for the Kind and Funded advisor
- id: kf_not_borderline
  title: "Not Borderline"
  category: advisor
  rarity: uncommon
  when:
    advisor: [kind_funded]
    project: { stage: writing, turns_to_deadline: "<=1" }
    stat: { advisor_rel: ">=40" }
  text:
    - "{advisor.nick} reads the draft and says: \"We could submit this. But it's a borderline paper, and you can do better than borderline.\""
  choices:
    - label: "Wait for the next cycle"
      effects: { sanity: "+3±2", project.quality.S: "+8±3", project.quality.C: "+6±2", advisor_rel: "+3±1" }
      flag_set: [chose_quality_over_deadline]
    - label: "Submit anyway"
      effects: { sanity: "-2±1", advisor_rel: "-1±1" }
      flag_set: [submitted_borderline]
  tip: { topic: "Hold Yourself to a High Standard" }

# Step 1 of an arc
- id: advisor_leaving_1
  title: "Big News"
  category: advisor
  rarity: rare
  arc: advisor_leaving
  when:
    year: [2, 5]
    stat: { advisor_rel: ">=30" }
  text:
    - "{advisor.name} closes the office door. \"I've accepted a position at another university. I'd like you to come with me.\""
  choices:
    - label: "Move with them"
      effects: { sanity: "-6±3", friends_rel: "-15±5", days_next: -4 }
      flag_set: [followed_advisor]
      schedule: { event: advisor_leaving_move, in: [2, 3] }
    - label: "Stay and find a new advisor"
      effects: { sanity: "-8±3" }
      flag_set: [rematching]
      schedule: { event: advisor_rematch, in: [1, 1] }
    - label: "Ask for co-advising"
      check: { stat: advisor_rel, vs: 60, spread: 15 }
      success: { effects: { sanity: "+2±1" }, flag_set: [remote_coadvised] }
      failure: { effects: { sanity: "-4±2" }, schedule: { event: advisor_rematch, in: [1, 1] } }
```

## Appendix B: Trait pool (draft, 24 of 40)

| Trait | Upside | Downside |
|---|---|---|
| Night Owl | Overtime costs `-3` Energy instead of `-5` | Morning meetings cost extra Sanity |
| Early Bird | Efficiency +5% | Deadline nights cost extra Energy |
| Perfectionist | Quality +10% per stage | Stages take 15% longer; rejections ×1.3 Sanity |
| Procrastinator | ×1.4 progress in the turn before a deadline | ×0.8 progress in the first half of a stage |
| Resilient | Sanity losses ×0.7 | Rarely triggers support events from friends |
| Anxious | Quals and defense prep bonus; sees one reviewer persona early | Sanity losses ×1.2 |
| Social Butterfly | Network ×1.5; Social days restore 50% more | Isolation hits harder |
| Introvert | Reading and writing efficiency +10% | Networking days cost Energy |
| Code Wizard | Coding +20 | Writing −10 |
| Wordsmith | Writing +20 | Coding −10 |
| Polyglot | Bonus Network at international conferences; bilingual events | none, it's just nice |
| Gym Rat | Exercise days give double Health and Energy | Sanity drops after 3 turns without Exercise |
| Caffeine-Powered | One extra effective day per turn when Energy < 40 | Health −1 per turn |
| Overcommitter | Gets more invitations and co-authorships | Each extra commitment costs a free day |
| Lucky | Rare and legendary events ×1.5 | Players will think the game is easy |
| Imposter Syndrome | Quality +5% from over-preparing | Sanity −2 on good news |
| Extremely Online | Networking boosts citations ×1.3 | Distraction events |
| Homebody | Home-life events are better | Travel costs Sanity |
| Foodie | Conference trips restore Sanity | Food-poisoning events |
| First-Gen Student | Resilient against setbacks | Early "unwritten rules" events |
| Parent | Efficiency +10%; strong Sanity buffer | 2 fixed family days per turn |
| Musician | Hobby days restore 50% more Sanity | Gig events take days |
| Stats Nerd | Soundness bonus on analysis stages | Methodologist reviewers enjoy you too much |
| Optimist | Sanity +1 per turn | Underestimates deadlines |

## Appendix C: Achievements (draft, 40 of 100)

**Research**
- *First Blood:* first accepted first-author paper.
- *Best Paper:* well.
- *h = 10:* reach an h-index of 10.
- *Breakout:* a paper passes 500 citations.
- *Self-Citation Engine:* cite yourself 25 times.
- *Colon in Every Title:* every paper title has a colon.
- *Benchmark Saturated:* your benchmark is solved within a year.
- *Scooped and Survived:* publish after being scooped.

**Reviewer 2**
- *Reviewer 2's Nemesis:* six rejections, then an acceptance.
- *Fourth Time's the Charm:* accepted on the fourth submission.
- *Rebuttal Wizard:* raise every reviewer's score in one rebuttal.
- *Legendarily Passive-Aggressive:* win with the passive-aggressive reply.
- *Desk Rejected:* exceeded the page limit by one line.

**Pain**
- *Submitted at 11:59:30:* submit within 30 seconds of the deadline.
- *All-Nighter Streak:* overtime for 4 turns in a row.
- *Overleaf Is Down:* survive the outage on deadline night.
- *The GPU Queue:* wait 3 turns for compute.
- *IRB Purgatory:* an IRB review longer than 8 turns.

**Life**
- *Touched Grass:* 20 Exercise days in a year.
- *Cat Person:* adopt a cat.
- *Marathoner:* finish the marathon arc.
- *Wedding Season:* attend 3 friends' weddings in a year.
- *Plant Parent:* keep a plant alive for 5 years.
- *Home for the Holidays:* visit family every winter break.

**Travel**
- *Globetrotter:* conferences on 5 continents.
- *Lost Luggage:* twice.
- *Met Your Hero:* at a networking dinner.
- *Remote Presenter:* visa delays forced a remote talk.

**Advisor**
- *Found the Unicorn:* choose the Kind and Funded advisor.
- *The One That Got Away:* were offered the Unicorn, chose someone else.
- *Advisor Hopper:* three different advisors in one run.
- *Followed Them Across the Country:* moved with your advisor.

**Milestones and endings**
- *On Time:* graduate in exactly 5 years.
- *Speedrun:* graduate in 4 years.
- *Balanced:* graduate with no burnout and fewer than 20 overtime days.
- *The Long Way:* graduate in Year 7 or later.
- *Every Door:* see all 26 career endings (across runs).
- *Bubble Tea Magnate:* reach the bubble tea ending with an h-index of 10 or more.
- *Bubble Tea Regular:* attend 20 in-person lab meetings with the Dark Angel.
- *No Orphans:* submit a paper the Dark Angel can't find a single orphan word in.
- *Saw It Coming:* Reviewer 2 asks the Dark Angel's question, and you'd already fixed it.

**Secret**
- *Read the Manual:* open every PhD 101 link from the game.
- *Ten Questions, Ten Answers:* pass the Ten Questions meeting with every answer right.

## Appendix D: Advisor quirks (draft)

- Replies to email at 3 am
- Loves Gantt charts
- Always "just one more experiment"
- Draws everything on a whiteboard
- Forgets meetings, then remembers them better than you
- Sends papers with no message, only the PDF
- Writes "great!!" on everything, means it 40% of the time
- Insists on tables over figures
- Only meets while walking
- Knows every reviewer personally
- Has a favorite font, enforces it
- Plays devil's advocate even when agreeing
- Answers questions with questions
- Remembers every student's birthday
- Brings snacks to lab meeting
- "Let's write a grant about it"
- Asks "who cares?" about every project, kindly

## Appendix E: Flavor lines (draft)

- The GPU queue had 412 jobs ahead of yours. You read a paper instead.
- Your experiment finished. It was the wrong config.
- Someone microwaved fish in the lab kitchen again.
- A reviewer from last year followed you on social media.
- You spent an hour renaming `final_v3_REAL.tex`.
- The coffee machine broke. Productivity fell 30%.
- Your mentee asked a question you couldn't answer. Good.
- An undergrad called you "professor". You didn't correct them.
- Lab meeting ran 40 minutes over. Nobody knows why.
- The building's heating is either off or set to Sahara.
- An email from your advisor, sent at 1:12 am: "Great figure."
- You now notice orphan words in other people's papers.
