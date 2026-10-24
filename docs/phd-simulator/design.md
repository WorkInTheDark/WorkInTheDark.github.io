# PhD Simulator: Design Doc

Status: v1 implemented (2026-10-15) on the `phd-simulator` branch. Phases 1 and 2 are built, plus parts of Phase 3 (daily seed, share image, job talk Q&A); see section 18 for what is and isn't done.
Owner: Arthur. This file is the design; `content-spec.md` is the exact data contract; `tools/phd-sim/README.md` lists the dev commands. It is excluded from the Jekyll build.

A browser game on the site, inspired by 《读博模拟器》, in which the player lives through an NLP × HCI PhD two weeks at a time: choosing an advisor, running projects, surviving reviews, travelling to conferences, living a life outside the lab, and landing somewhere at the end. The aim is a game that is as realistic as possible while still being fun, and that can be replayed many times without feeling repetitive.

---

## 0. Decisions so far

| Topic | Decision |
|---|---|
| Language | English |
| Field | NLP × HCI (human-centered AI, clinical AI flavor) |
| Turn length | **Two weeks: one focus click, then what comes up.** You pick the turn's focus (a project, Read and learn, Recharge, or an "only this turn" option), then answer the turn's updates and events, and sometimes a side activity. No multi-pick, no confirm button (section 4). History, all 2026-10-16: a repeating two-week routine, then a two-week planner with several picks, then one click per week, then this, after Arthur replayed the original 读博模拟器 (a month per turn: one to-do pick, then several event screens) |
| Visible stats | Three bars to balance: **Energy**, **Stress** and **Health**, plus Citations (+ h-index) and Papers. Stress is the engine's `sanity` shown as 100 − sanity. New tasks (reviews, grading, a rebuttal) and bad news (rejections) raise Stress; many events now cost Health. "Get healthy" was dropped as a duplicate of Recharge |
| Hidden stats | Skills (hidden again: the bars felt useless), relationships, network |
| Projects | **Named stages with set chances** (Arthur, 2026-10-16): each turn of work is one try at finishing the current stage (Idea 80%, Related work 70%, Pilot 60%, Experiments 50%...), with no hidden progress. **No Writing stage**: you write all along, and the last stage, Consolidation, pulls it into one paper. Kind and topic are assigned automatically. Waits (IRB, recruiting, annotation) are 2–4 weeks. **NLP papers go only to NLP venues (plus NeurIPS and ICLR), HCI papers only to HCI venues.** Each paper due gets its own deadline card |
| Character | Three traits rolled at random. No background or origin choice; those became traits (Industry Veteran, Career Switcher, Master's Head Start, International Student) (2026-10-16) |
| Event frequency | **Usually one event a turn, sometimes two or none** (**40% / 50% / 10%** since 2026-10-18; it was 15 / 60 / 25, then 25 / 60 / 15. Arthur: players were at a loss with so many events). Updates that need an answer (reviews, decisions, milestones) count toward it. A side-activity card comes up in about a third of turns. Routine news goes into the report |
| Not stats | Money and funding (funding becomes a hidden trait of the advisor) |
| Effects | Rolled within a range, written `+7±3` |
| Before choosing | Arrows only, never numbers |
| Advisor archetypes | Many, including a rare "Kind and Funded" one that is Arthur |
| Advisor | **Assigned on day one, no matching screen** (Arthur, 2026-10-16: choosing didn't change the game enough to earn the screen). The welcome card introduces them (section 7.2) |
| Committee Q&A | **Plays out on its own** (2026-10-16): picking answer strategies barely mattered and broke the flow. Prep (reading days, proposal work) is what you control; the card shows each question with ✓ or ✗ |
| Look | **A small game window inside the page** (760 × 560 on desktop), with its own palette and a rounded display font. No How to play, no Log (section 14.2) |
| Advisor nicknames | **Removed** (Arthur, 2026-10-17: they didn't do anything). Advisors are "Prof. Surname" with a plain archetype label and tagline (section 7.1) |
| Graduation | Passing the defense. The defense needs at least 3 publications, 3 months of preparation, and (since 2026-10-18) a year since the proposal (section 3.4) |
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

### 3.1 Turns
- **One turn = two weeks** = 10 weekdays + 4 weekend days. One year = 26 turns (T1–T26), starting on 1 September (364 days; the missing day is ignored).
- Content and config count in turns. Players read time in weeks and dates ("deadline in 4 weeks", "Oct 13–26").
- Nominal program: 5 years (130 turns). Extensions up to the end of Year 8 (208 turns), when the run ends regardless.

### 3.2 Turn-to-date map (each year)

| Turn | Dates | Notes |
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
| IUI | T3 | T8 | T11 | T15–T17 |
| UIST (2026-10-17) | T16 | T21, 1-turn response | T23 | T4 (next fall) |
| CSCW (2026-10-17), two cycles | T11 and T24 | 8 weeks: reject or Revise & Resubmit | revision 16 weeks after submission, final 22 | about 40 weeks after submission |
| Workshops | rolling | short | 3–4 turns after | with their main venue |
| Journals (TACL, TOCHI) | any time | 6–12 turns, revision rounds | | presentation optional |

**Venues by field (2026-10-16):** a paper only goes to its own field's venues. NLP (empirical, dataset, NLP position papers): ARR (NAACL, ACL, EMNLP), COLING, NLP workshops, TACL, and the top machine learning conferences NeurIPS (empirical, dataset) and ICLR (empirical). HCI (studies, systems, HCI position papers): CHI, UIST, CSCW, IUI, HCI workshops, TOCHI. **UIST and CSCW were added 2026-10-17** so HCI papers don't wait most of a year for CHI: HCI deadlines now fall in January and July (CSCW), April (UIST), September (CHI) and October (IUI). AMIA was removed as neither NLP nor HCI; NeurIPS and ICLR were removed and then brought back for NLP papers at Arthur's request. Project titles come from the matching field too (`topics.yml` has `titles: { nlp: [...], hci: [...] }`).

ARR rejections can be resubmitted to a later cycle with previous reviews attached, as in reality.

### 3.4 Program structure and graduation
- **Coursework:** Year 1 fall and spring, Year 2 fall.
- **Advisor:** assigned on Year 1 T1 (section 7.2).
- **Quals:** Year 1 T18 or Year 2 T18 (program variant rolled per run). One retake allowed. **Prepare for quals** (2026-10-17) is a focus choice for the 8 weeks before the exam; see section 9.2 for the odds. Since 2026-10-18 the tile shows the pass odds now and after one more turn ("Pass odds a long shot → very likely", or "Fully prepared"), and the Quals chip shows the current odds.
  - **Quals pop-ups (Arthur, 2026-10-20):** when the prep window opens, a "Quals in 8 weeks" card appears before the plan. It gives the exam dates, the rule (two good answers of four), and the pass odds now, after one turn of preparing and after two, plus the Stress the news costs. Two weeks out, a "Quals in two weeks" card appears too if you haven't prepared at all. Both are the `quals_notice` sys card, in `PRE_SYS`.
- **Thesis proposal (2026-10-18):** from Year 3 on, once quals are passed and **one** first-author paper is accepted (it's about the thesis plan, not finished work; it needed 2 before, which pushed proposals into mid-Year 4). 8 weeks of preparation, then the committee.
- **A year between proposal and defense (2026-10-18):** defense preparation can start only a year after the proposal passes (`defense_after_proposal_turns` 26). That year is for the job market, more papers, or postdoc and faculty preparation, as in a real program; a tray chip counts down ("Defense opens in 20w"). Measured for sensible play: proposal 2.9 years in, defense prep 4.1, graduation 4.4.
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

## 4. The turn

Changed four times on 2026-10-16 at Arthur's request; this is the current shape. A turn is two weeks:

1. **Focus (one click).** What the turn's free weekdays go to.
2. **What comes up.** The turn's updates and events, one card at a time, each with its own choices.
3. **Sometimes, a side activity:** one small card for an evening or a weekend.
4. **The report** for the two weeks.

### 4.1 Fixed time
Fixed commitments take part of each turn's 10 weekdays:

| Commitment | Days per turn | When |
|---|---|---|
| Courses | 3 in Year 1, 2 in Year 2 fall | Coursework terms |
| TA duty | 2 (3 at finals) | TA semesters |
| Meetings | 1 (2 with a Micromanager) | Always |
| Defense prep | 5 | Defense prep |
| Family | 2 | Parent trait |
| Internship | all 10 | Internship turns |

All the remaining weekdays go to the focus. You get 5 fewer when you're sick, and half when burned out. Weekends (4 days) are off, unless you crunch or spend them on research during an internship.

### 4.2 Focus choices
A few are always there:
- **Work on "<project>"**, for each active project, unless it's waiting (IRB, recruiting, annotation) or on hold.
- **Refine "<paper>"** (Arthur, 2026-10-18), for a finished paper waiting for its deadline. It replaces the old Polish choice, which was removed on 2026-10-17 because it changed nothing.
  - Each turn of refining is one pass worth `progress.refine_pass` (+1.5 quality), every time, as Arthur asked. Most of it goes to the weakest part (novelty, soundness or clarity).
  - The count and the gains stay with the project after a rejection. A paper that went through a round of reviews comes back stronger, on top of the rejection's lesson bonus.
  - The tile shows Quality ↑. The result card names the part that got stronger, and the tracker reads "Refined ✨" (×N after more than one pass).
  - Measured: a refined paper is accepted about 9 points more often (top tier 25% vs 16%, mid tier 51% vs 32%). The turns come out of other projects, so output stays within Arthur's careful-player limits. Careful: 5+ papers 37%, tenure-track bar 20%, offer 11%. Sensible: 3 papers by Year 4 49%, graduation 4.4 years.
  - Refining at every chance isn't an exploit. Each paper does better (top tier 31%), but careful players then reach 5+ papers only 21% of the time.
- **Read and learn:** moves a project in **Related work** a lot (1.3× working on it, versus 0.8× for "Work on" in that phase) and every other project a little. Sometimes an idea.
- **Recharge:** about +28 Energy, −18 Stress and **+7 Health** (it was +4, 2026-10-17: Health could only go down) for the turn, on top of the weekends, however busy the turn is. It's the one rest choice; "Get healthy" was dropped because it duplicated it.

Some come from the calendar and your progress:
- **Deadlines don't use the focus.** In a deadline turn, each paper due gets its own card among the turn's updates: submit (with or without a preprint) or skip. Two papers due together can both go in. A rough draft can be submitted; a finished one reads better.
- **The turn before a deadline:** "Crunch on "<project>", weekends included" (deadline mode, four overtime days, a big drain on all three bars).
- **Milestones**, which take the turn's focus: **Prepare for quals** (the last 8 weeks before quals; its line says how ready you are, from "Not ready yet" to "As ready as you'll be"), internship or fellowship applications, scheduling the proposal, starting defense prep, the job market.
- **Internship turns:** "Give it your all" (big drain, better return-offer odds), "Keep a healthy pace" (about Energy-neutral, a little Stress relief), "Spend the weekends on <project>", or "Take a few days off" (a Recharge). A paper that's ready to submit offers "Weekends refining <paper>" instead (playtest, 2026-10-24): half a refining pass (config progress.refine_weekend_share).
- **On leave:** only Recharge.

And some come up for **this turn only** (`opportunities.yml`): the holidays at home, winter break, a spring-break trip, a summer vacation, a summer school, a hackathon, an invited talk, the career fair, visit day, a writing retreat, an empty GPU cluster, the clinic suddenly having openings, your advisor's free two weeks, helping a labmate make their deadline, teaching the lectures, the thesis bootcamp. Each eligible one rolls its `chance` every turn (respecting `when`, `cooldown`, `once`), up to 2 a turn; events can also `unlock:` one for the next turn. About 40% of turns offer at least one.

**Start a new project** is a free button: it doesn't use up the turn, and the project's kind and topic are picked for you (section 8.1).

### 4.3 What comes up
- **Order of a turn (2026-10-18):** you pick the focus, the focus plays out (days spent, stage rolls), and a small **"Your two weeks"** card shows what it did: stage progress ("Pilot is done. On to Experiments." / "Study design isn't done yet. Next turn: likely."), the weekend pick's line and the bar changes. Only then do the turn's updates and random events pop up, so they never read as caused by the focus. Days an event or card costs after that point (conference trips, rebuttal experiments, fellowship applications, "days" effects) come out of **next** turn.
- **Side activities are on the plan screen (2026-10-18), not pop-ups:** in about a third of turns, two small evening or weekend options appear under the choices ("This weekend, if you like: …"); pick one or none, and it plays out with the focus. Arthur: players couldn't tell "On the side" cards from random events.
- **Before the focus:** only your first project, on Year 1 T1 (the advisor is assigned at the same moment).
- **After the focus**, in order: milestones and Q&As on their dates (quals, proposal, defense), reviews arriving with the rebuttal, decisions, conference trips, internship and job offers, the Dark Angel's Question, world news hooks, scheduled arc follow-ups, then **random events**.
- **How many events:** each turn rolls a target of 0, 1 or 2 "things that happen" (40% / 50% / 10%). Updates that need an answer count toward it, so a turn with reviews gets fewer random events. Hook events (deadline, after a decision, conference) come on top, at their own chances.
- **Side activities** (`side.yml`): in about 30% of turns (45% when Health or Stress is in trouble), a card offers two or three small things for an evening or a weekend: the gym, a run club, yoga, a doctor's visit, cooking, an early bedtime, board games, dinner with friends, a hike, a concert, a hobby, coffee with a visiting speaker, a reading group, helping a labmate debug, a visiting friend or parents, a nearby workshop. Options that help a bar in trouble are three times as likely. They don't take the focus; a few cost a day. "Not this time" is always there.
- **Stress from new work and bad news:** reviews arriving (Stress up by how bad they are, plus the rebuttal to write), rejections (about +10, +13 for a desk reject), revise-and-resubmit (+5), a new TA semester (+4), quals announced (+6), scheduling the proposal (+5), starting defense prep (+6), the job market (+5), starting a project (+6, plus 3 for each project already on your plate; the button shows it), applications (+2), and a deadline two weeks away with the paper under 85% (+3). The log says "Stress +N" for each.

**Decisions that don't pop up:** acceptances, rejections and revise-and-resubmits are reported; a rejected paper goes back to revision for the next deadline. Conference trips happen automatically.

### 4.4 Balance targets

| Turn focus | Energy | Stress | Health |
|---|---|---|---|
| Work on a project | about −16 | about +4 | about −2 |
| Read and learn | about −9 | about +4 | about −2 |
| Recharge | about +31 | about −9 | about +4 |

Events and side activities move the bars further: 68 exhausting event outcomes now cost 2–3 Health, extra-work outcomes add Stress, and there are new Health events (the office chair, eye strain, flu season, crackers for lunch, the morning after a deadline, the fifth coffee, wrist pain, falling asleep in a talk, a sprained ankle, a three-day headache, pollen, the lab fridge). There are also "new task" events: a journal review request, a grading pile, slides needed by Friday, onboarding a rotation student.

From `simulate.mjs` (900 runs) and a one-project probe:
- A project you push on takes about **18 weeks** after Year 1 and about 22 in Year 1.
- A sensible bot graduates about 93% of the time, with a median of about 4.4 years; a slacker around year 5.8. A bot that never rests ends Year 1 near Energy 10, Stress 100, Health 0.
- About 1.1 events per turn, plus about 0.35 side cards; about 1.6 cards per turn in all.
- Event variety: there are 510 events (475 in the random pool). A run sees about 116 different random events, and two consecutive runs share about 33% of them. Before Arthur accepted every remaining idea in `event-ideas.md`, the pool was about 250 events and the overlap was about 60%.

## 5. Stats

In this doc and in the content files, **"Sanity" is the engine's name for what players see as Stress** (Stress = 100 − sanity). "Sanity −6" in a table below shows up in the game as "Stress +6".

### 5.1 Visible

| Stat | Range | What it is |
|---|---|---|
| **Energy** | 0–100 | Short-term fuel. Work uses it; Recharge and weekends restore it. Below 60, each day gets less done. |
| **Stress** | 0–100 | The engine's `sanity`, shown as 100 − sanity. Builds with work, deadlines and rejections; Recharge and good things bring it down. At 100 you burn out. Content keeps "sanity up is good". |
| **Health** | 0–100 | Wears down slowly at a desk, faster when you're exhausted (Energy < 25) or stressed (Stress > 70) and when you crunch. Below 35 you work 10% slower; low Health means more sick turns. Recharge and health side activities (the gym, a doctor's visit) rebuild it. |
| **Citations** | count, plus h-index | Grow from published papers and preprints (section 8.8). |
| **Papers** | list | Accepted papers, plus what is under review. |

### 5.2 Hidden

| Stat | Range | Start | What it affects |
|---|---|---|---|
| Skills (taste, coding, writing, presenting, knowledge) | 0–100 each | about 26–32 | Progress speed and paper quality; they grow with what you do |
| Advisor relationship | 0–100 | 50 | Advisor support, letters, how meetings go |
| Labmates | 0–100 | 50 | Help, co-authorships, lab events |
| Family / partner | 0–100 | 60 | Support during bad events |
| Friends | 0–100 | 40 | Stress buffer, social events |
| Network | 0–100 | by trait | Internships, invitations, collaborations, job market |

Stat ids used in data files: `energy`, `sanity`, `health`, `citations`, `taste`, `coding`, `writing`, `presenting`, `knowledge`, `advisor_rel`, `labmates_rel`, `family_rel`, `friends_rel`, `network`.

### 5.3 Starting tuning values (all in `config.yml`)

**Energy**
- Research day `-3±1`; class, TA or meeting day `-2`; overtime (weekend) day `-5±2`; weekend day off `+4±1`; `-4` a turn for life.
- A Recharge turn `+28±4`, a whole-turn amount that doesn't depend on how many free days the turn had.
- Efficiency multiplier: `clamp(0.35 + 0.011 × energy, 0.35, 1.0)`: full speed at 60 or more.

**Stress** (stored as `sanity`, so the signs below are sanity changes)
- Every work day `-0.5`, plus `-5` a turn of background pressure; weekend days off `+1` each.
- A Recharge turn `+18±3`; social, hobby or family days from opportunities `+3±1`; side activities `+1` to `+5`.
- New work and bad news: see section 4.3.
- Overtime day `-1`. Isolation (no social time for 3 turns) adds more.
- Stress over 75: efficiency ×0.8, and "should I quit?" events become possible.
- At 100: **Burnout** for 4 turns (free days halved, no crunching).

**Health**
- `-2` a turn with no exercise (a health side activity or Recharge counts); `-2` more when the turn ends with Energy under 25, and `-2` when it ends with Stress over 70; overtime day `-1.5`; many event outcomes.
- A Recharge turn `+4±1`; health side activities `+3` to `+6`.
- Below 35, work is 10% slower. Chance of getting sick each turn: `0.01 + 0.003 × (100 − health)`, doubled in flu season (sick: 5 fewer free days next turn).
- **Getting sick and running out of Energy are events** (playtest feedback, 2026-10-24: it was one line, the same cold every time). Getting sick opens the next turn with one of ten `hook: sick` events in `events/health.yml`, picked by what got you there: flu season, travel (jet lag), overwork, a desk-bound body (Health < 50), stress or coffee, or the plain cold (weight 0.5, the one that's always possible). Each offers resting (a day or two, a little Health back) or pushing through (more Energy and Health). They replace the old fixed −15 Energy and −4 Health. A turn that starts with Energy at 5 or less, not sick, brings one of eight `hook: exhausted` events half the time. Neither counts toward the turn's random-event budget. Over 1,800 simulated runs the research score is unchanged (P50 83) and Health ends a little higher.

**Skills (hidden)**
- Each day of relevant work: `Δ = 0.25 × (1 − skill/100)`, so growth slows as skills rise. They speed up progress and raise paper quality.
- Events can add ranged boosts (`writing: "+7±3"`).

**Relationships (hidden)**
- Advisor relationship moves with turns spent on projects (or not), kept or broken commitments, and events.

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
- **Before choosing**, each choice shows arrows for its visible effects only (Energy, Stress, Health, Citations, and project progress), derived automatically from the sign of each effect's center. Stress arrows point the other way from the sanity change, but keep its color: green is always good for you.
  - `↑` / `↓` for small effects, `↑↑` / `↓↓` when the center is 10 or more (pending confirmation, section 19).
  - `↕` when the outcome depends on a check and success and failure point in opposite directions.
  - Hidden effects never get an arrow; the choice wording hints at them.
- **After choosing**, visible changes show the rolled number ("Stress +6"); hidden changes, skills included, appear only as result lines.

### 5.6 Statuses
Temporary effects with a duration, shown as chips under the stats.

| Status | Duration | Effect |
|---|---|---|
| Sick | 1 turn | −5 free days; the sick event's choice sets the rest |
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
Each archetype has six hidden parameters on a 1–5 scale, and two random quirks from a pool of about 30 (Appendix D). The Dark Angel instead always has its four fixed quirks (section 7.3).

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

#### Names (Legion nicknames removed 2026-10-17)
Players see **Prof. {surname}**, the archetype's plain **label** (for example "Grant Machine") and its one-line **tagline**. Event text uses `{advisor}` ("Ask Prof. Dubois to email their PI").

Each archetype used to have a Space Marine Legion nickname (the Dark Angel for Kind and Funded, as a nod to WorkInTheDark). Arthur removed them because they didn't do anything in the game. The event file `events/legion.yml` and its `leg_` ids keep their names; its events show as "Advisor".

### 7.2 Your advisor (assigned on day one, 2026-10-16)
- Three candidates are still drawn from the pool, and one of them takes you. There is no matching screen: the welcome card names your advisor, their archetype and its tagline, then asks about your first project.
- **Why:** with matching, the choice didn't change enough of the game to be worth a screen and a week of rotations (Arthur). The advisor still shapes the run through their archetype (funding, events, how they react).
- **The One That Got Away** (achievement): the Kind and Funded advisor was among the three candidates but took someone else.
- Later arcs can force or allow a switch (advisor leaves, irreparable conflict); a new advisor is then drawn the same way.
- *Old design (replaced):* choose among three by T8, with rumors about 70% accurate and lab rotations to learn more.

### 7.3 The Kind and Funded advisor (Arthur)
- **Shown as:** Prof. {surname} (Kind and Funded). (It was "the Dark Angel" until the nicknames were removed.)
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

Each project moves through **named stages** (2026-10-16, Arthur's design). Each turn you work on a project is **one try** at finishing its current stage, at that stage's set chance. Success moves to the next stage; failure stays, and the card counts the tries. There's no hidden progress.

**There's no Writing stage, on purpose.** Arthur tells his students to write early, and a final "Writing" stage would teach the opposite. You write all along (every stage's work adds to the paper's clarity), and the last stage, **Consolidation**, pulls the results, related work and drafts into one paper and tailors it to the venue. When Consolidation succeeds, the paper is **ready to submit**. A paper still in Consolidation can be submitted, but it reads rougher.

| Type | Field | Stages (chance per turn of work) | Waits |
|---|---|---|---|
| Empirical NLP | NLP | Idea 80% → Related work 70% → Pilot 60% → Experiments 50% → Consolidation 60% | none |
| Human-centered study | HCI | Idea 80% → Related work 70% → Study design 65% → IRB → Recruiting → Study sessions 55% → Analysis 60% → Consolidation 60% | IRB 2–4 weeks, recruiting 2 |
| System + evaluation | HCI | Idea 80% → Related work 70% → Building 50% → IRB → User study 55% → Analysis 60% → Consolidation 60% | IRB 2–4 weeks |
| Dataset / benchmark | NLP | Idea 80% → Related work 70% → Annotation guidelines 65% → Annotation → Baselines 50% → Consolidation 60% | annotation 2–4 weeks |
| Position / survey | either | Idea 80% → Related work 50% → Consolidation 55% | none |

Revising after a rejection or a revise-and-resubmit is one stage at 60%. Type ids used in data files: `empirical`, `study`, `system`, `dataset`, `position`; stage ids are the lowercase names (`consolidation`, `lit` for Related work).

**New projects pick their own kind and topic**; see the field rules in section 3.3.

**Waiting stages** advance by calendar time rather than work. While a project waits (or is on hold after a setback), it has no "Work on" choice that turn.

### 8.2 The odds each turn

```
chance = stage chance × factor + event nudges                              (at most 95%)
factor = 0.5 + 0.5 × effort / 6.5   for a short or tired turn (never below half)
       = up to 1.15                 for extra effort, like a crunch
effort = Σ over the turn's work days of efficiency(energy) × skill_factor × modifiers
```

A normal full turn after Year 1 (about 9 free days at decent Energy) counts as a full try, at the stage's chance, so the odds stay close to the numbers in the table. A busy Year 1 turn with classes keeps about 80% of the chance; exhaustion, sickness and burnout lower it; a crunch, a writing retreat or an empty GPU cluster raise it a little. Related work counts 1.3× when you **Read and learn** and 0.8× with "Work on". A reading turn also gives other projects a small try (about 5–10%). Events with `project.progress: n` nudge the next try by n percentage points. The choice text says how likely this turn is to finish the stage, in words ("likely", "about even").

Measured: working on one project every turn, a project is ready in a median of about 22 weeks (16–26 for the middle half; empirical projects near 16–18 weeks, studies longer because of IRB and recruiting). With rest turns in between, about 6 months.

### 8.3 Quality
Each project has three hidden quality components, 0–100:
- **Novelty (N):** from idea and lit-review days (taste, knowledge), topic hype, and scoop events.
- **Soundness (S):** from pilot, experiment, study and analysis days (coding, domain), and from compute and sample size.
- **Clarity (C):** from writing days (writing skill).

Each component is the average relevant skill applied over that stage's days, times how complete the stage was:
- A paper can be submitted while still in Consolidation, but its Clarity is capped until Consolidation is done. **Rushing shows up in reviews.**
- Submission becomes possible once Writing reaches 50%.
- A strict advisor may block a submission whose quality is below their bar.

Overall paper quality for reviewing: `Q = wN·N + wS·S + wC·C`, with venue-specific weights (NLP venues weigh Soundness more; CHI weighs Novelty, meaning contribution, and Clarity more).

### 8.4 Topics and hype
- At run start, 6–8 research topics are drawn from a pool of about 30, for example LLM evaluation with clinicians, explanations for question answering, children's reading comprehension, mental-health language models, human-AI co-writing, annotator disagreement, decision support in the EHR.
- Each topic has a **hype** level (0–100) that random-walks over time, with shocks from world events. Players don't see it (2026-10-16).
- Hype affects citations (×0.5 to ×2), reviewer interest (Novelty bonus), competition (scoop risk), and internship and job fit.
- **Scoops:** per-turn chance about `0.005 × hype / 50` for a project between Lit review and Writing. Severity is rolled: partial overlap, or the same idea.

### 8.5 Authorship
- **First-author projects** are yours and count toward graduation.
- **Co-author projects** come from labmates, collaborators and internships. You contribute days, they count as papers and citations, but not toward the graduation bar.
- Authorship order can be negotiated in events (with consequences for labmate relationships).

### 8.6 Venues and decisions
- **Tiers:** Top (ACL, EMNLP, NAACL, CHI, UIST, CSCW, NeurIPS, ICLR), Mid (COLING, IUI), Findings, Workshops, Journals (TACL, TOCHI).
- **Review model:**
  - Each of 3 reviewers scores `Q + persona_bias + noise(σ = 12)`, mapped to the venue's scale.
  - An area chair or meta-reviewer combines the scores, the rebuttal effects and some noise, and compares against the venue threshold.
- **Possible outcomes:** accept, Findings (ARR only), reject, Revise & Resubmit (CHI, CSCW, journals), desk reject (page limit, anonymity, formatting events).
- **Thresholds are tuned** so that top-venue acceptance is roughly 25% at Q = 60, 60% at Q = 75 and 85% at Q = 85 (targets, section 17).
- **Resubmission:** a rejected paper can be revised (a Revise stage, with quality gains for addressing the earlier concerns) and resubmitted, **any number of times**. ARR resubmissions carry their old reviews.
- **Revise first (2026-10-17):** a rejected paper goes out again only once its revision is finished (`progress.revise_before_resubmit`, revise chance 0.6 a turn); if the revision isn't done by the deadline, it rolls to the next one. Before this, rough resubmissions went out at every deadline (about 18 first-author submissions per PhD, top-tier acceptance 17%) and a sensible player graduated in about 3.9 years. Now it's about 15 submissions, 21% top-tier acceptance, and 4.3 years.
- **Project speed and resubmission (2026-10-18):** `progress.full_turn` is 5.5 effective days (6.5 before; 4.5 for one round, which let careful players publish 5+ papers in 70% of runs), and `reviews.lesson_bonus` is 7. The tenure-track bar is 95. These three were tuned together to Arthur's targets in section 17 (now 5.5, 7 and 102); papers with 4+ rejections in a row are about 14% for sensible play.
- **Fewer long rejection streaks (2026-10-18).** With every paper aiming for top venues and small revision gains, 23% of papers went through 4+ rejections in a row (Arthur saw one). Now: each rejection teaches something (`reviews.lesson_bonus` 8: +4 to every quality part, +8 to the weakest); after 2 rejections a paper re-aims at the next mid-tier deadline within half a year (`progress.step_down_after`); a rejected paper's next deadline is at least 8 weeks out (`progress.resubmit_min_turns` 4); and top, mid and journal thresholds rose by 6 to keep the pace. Measured for sensible play: 4+ rejections in a row 23% → 10%, top-tier acceptance 19%, graduation 4.2 years. The levers trade off: fewer streaks means papers land sooner, so the bars rose to hold graduation at 4.2–4.4.
- **Shorter reviews (2026-10-18):** the rebuttal card is one row per reviewer (score as five dots, the main concern in a line, the reply picker); the decision card is "Scores 3 · 2 · 3." plus the one-line meta-review.
- **Easier venues (Arthur, 2026-10-20, later the same day).** Players were getting about 5 rejections before their first paper. Arthur's targets: 2–3, a sensible player's third paper around Year 3.5, and careful players a little more likely to reach tenure-track.
  - Top and mid venue bars went down by 4 (top 80, NeurIPS/ICLR 81, mid 71).
  - Until the first first-author acceptance, every submission gets +10 quality (`reviews.first_paper_bonus`: the advisor's extra work on a student's first paper). Lower bars alone barely helped, because Year 1–2 papers score 48–57 against a bar of 84.
  - To hold the rest of the balance: `offers.tenure_track_score` 102 → 116, `famous_postdoc_score` 80 → 98 (back to about the top quarter), and `proposal_min_pubs` 1 → 2 (with 1, graduation fell to 3.8 years).
  - Measured, sensible players: 2.6 rejections before the first paper (median 2); papers in Years 1.8, 2.7 and 3.4; graduation in 4.3 years; 77% have 3 papers by Year 4.
  - Measured, careful players: 5+ papers in 66% of runs (was 36%), 6+ in 35%; tenure-track bar 27% (was 19%), offer 15% (was 10%); famous postdoc offered 40%.
  - Per submission: ARR 37% (21% main, 17% Findings), CHI 27%, UIST 21%, CSCW 28%, IUI and COLING about 60%. These are close to the real venues.
  - `simulate.mjs` now prints "Rejections before the first paper". The score floor moved with the bars (28), and the percentile table was regenerated.
- **Shown scores match the venue bars (Arthur, 2026-10-20).** A reviewer's 1–5 score is the hidden 0–100 score through `round((raw − score_floor) / score_width)` (config `reviews`: 28 and 15; 20 originally, 32 for an hour before the bars came down).
  - The top-venue bar (80 since the easier venues) sits at an average of about 3.5. Before, it sat at about 4.3, so a 4-4-3 got in only 41% of the time (ARR main about 15%).
  - Measured at ARR: the main conference takes 41% at an average of 3.33, 73% at 3.67 and 84% at 4.00. Main or Findings takes 55% at 3.00. A 4-4-3 at a top venue now gets in 88% of the time.
  - Only the display changed: decisions use the hidden scores, so paper counts, offers and Stress didn't move (average Stress 37.8 vs 37.9). The Stress from reading reviews moves its center with the floor.
  - **Meta-review lines** that mention a rebuttal or author response only go to papers that had one (not CHI, CSCW, workshops or a second round). `{venue}` and `{topic}` now fill in from the paper itself.
- **Decisions follow the shown scores (Arthur, 2026-10-21).** He still saw papers averaging about 3 rejected. Across 3,800 simulated decisions, the cause was the area chair's own noise (`reviews.ac_sigma` 8, about half a shown point): IUI rejected 21% at an average of 3.7, and UIST 22% at 4 or more. Desk rejects were unrelated: they come only from the page-limit, acknowledgments and anonymous-repo events, always before reviews (1.7% of submissions).
  - `ac_sigma` 8 → 3, the ARR Findings band 7 → 10, mid-venue bars 71 → 68.
  - Rejected at an average of about 3: ARR 49% → 23% (most of the rest go to Findings), mid venues 40% → 11%. Averages of 3.4+ at ARR, 3.7+ at UIST and 3.3+ at mid venues are no longer rejected.
  - Balance stays within his targets. Sensible players: 2.4 rejections before the first paper (median 2), papers in Years 1.7, 2.7 and 3.4, graduation in 4.3 years. Careful players: tenure-track bar 30%, offer 16%, 5+ papers 74%.
- **Rejections are a card (2026-10-17).** Arthur thought rejected papers disappeared: they came back silently as a different-looking tracker. Now every first-author rejection (and desk reject) shows a card with the scores and three choices: **Revise and resubmit** (it names the next deadline), **Send it to a workshop**, or **Shelve it**. The tracker keeps all its finished stage dots plus a Revise dot and says which try it is ("Revising · try 2"); the project close-up lists every submission (venue, outcome, scores).

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

**Responding (simplified 2026-10-16):** one response **per reviewer**, covering all of that reviewer's concerns, with **Clarify** as the default. There's no response limit; one dropdown per reviewer and one Submit button.

| Response | Works best when |
|---|---|
| Clarify (default) | The concerns are misreadings (writing check) |
| Concede and promise fixes | The concerns are minor; the promises must be kept in camera-ready (days after acceptance) |
| Run new experiments | Soundness concerns; coding check; the new results can come out worse. Costs 2 days this week and some Energy |
| Push back politely | The concerns are invalid and the persona is open-minded |
| Passive-aggressive reply | Almost never; 2% legendary success, with an achievement |
| Flag it as LLM-written | Only offered when the review reads that way; 60% chance the area chair discounts it |

**Resolution.**
- Each reviewer's score moves by the sum of the response effects × the persona's openness, plus noise.
- The AC then decides, and the updated scores and a templated meta-review are shown.
- Making a concern its own content item means each new paper produces a different rebuttal. The concern pool targets about 120 entries.

**CHI variant (Phase 2):** Revise & Resubmit over 3 turns. Responses become revision tasks the player assigns days to; reviewers then re-score.

### 9.2 Later mini-games

| Mini-game | Phase | Sketch |
|---|---|---|
| Committee Q&A (quals, proposal, defense) | 2 | **Automatic since 2026-10-16.** 3–5 committee members ask questions drawn from your projects' weak spots; each answer lands or not from hidden skills and prep days, and one card lists the questions with ✓ / ✗ and the result. (Answer strategies were cut: they barely mattered and broke the flow.) **Quals odds (2026-10-17)** are mostly preparation: each answer lands with 0.20 + 0.045 × readiness (max 15) + (skill − 40) / 200, plus 0.12 on the retake; you pass with half right. "Prepare for quals" adds about 1.5 readiness per free day, reading during the prep window 0.3. Measured first-try pass: about 68% with no prep, 90% after one turn, 94% after two. |
| Poster session | 3 | 6 visitor slots (famous prof, curious student, recruiter, the person who explains your poster to you, a competitor); choose the pitch length; outcomes: network, job leads, citations |
| Job talk and interviews | 3 | Talk structure choices, Q&A, one-on-ones; feeds offers |
| Deadline night | 3 | 12 hours left, a task list (fix Figure 2, rerun an ablation, write the limitations, trim to the page limit, fix the bibliography) and random disasters (Overleaf compile timeout, a co-author edits main.tex at 11:58 pm); affects quality and desk-reject risk |

Each mini-game draws its content from pools so it plays differently every time.

---

## 10. Life layers

Six layers run at the same time; each contributes scheduled events and a random pool.

### 10.1 Academic milestones
- **Orientation** and your **advisor** (Year 1 T1), coursework.
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
  - **The scarcest offers are percentile-gated (Arthur, 2026-10-17):** Tenure-Track Professor only for the top 10% of academic profiles, Postdoc in a Famous Lab for the top 25% (`config.yml` `offers`: scores 91 and 80, then a 50% / 70% roll). The academic score is 10 per top-tier first-author paper + 5 per other one + 4 × h-index + 0.03 × citations + 20 × letter (advisor relationship × fame) + 0.1 × Network. `simulate.mjs` prints the score percentiles and the eligible and offered shares; re-measure after balance changes (measured: eligible 8–11% and 24–26%, offered 4–8% and 15–18%). An Eternal Postdoc becomes the famous lab at the end only if the final score clears the same bar.
  - **Niche offers rebalanced (Arthur, 2026-10-17)**, measured as the share of sensible-player graduates who would have the offer at graduation (before → after): Frontier Lab 31% → 12% (industry score ≥ 121, about the top 15%, Coding ≥ 75, then 70%); Return Offer 73% → 31% (after each internship: 4% + 2.5% per turn you gave it your all); UX Researcher 60% → 21% (two accepted first-author study or system papers, then 60%); Science Journalist 57% → 11% (the magazine-piece event and Writing ≥ 60); Clinical Informatics 72% → 15% (a clinical partner and an accepted HCI paper, then 25%). Graduates now have about 5 offers on the table instead of 7. Numbers live in `config.yml` `offers`.

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
- People: `{player.name}`, `{advisor}` (Prof. Surname; `{advisor.nick}` is an old alias), `{advisor.name}`, `{labmate}`, `{labmate.senior}`, `{mentee}`, `{committee}`
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
8. **Flavor lines:** a quiet turn still gets a one-liner in the turn recap, drawn from a pool of 300 or more.

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
- **Order, top to bottom** (Arthur, 2026-10-23): the EN / 中文 switch, the ending name and title, Better than N%, then one box with **Share your PhD** and the **leaderboard** submit, so no one scrolls past the details to find them. After that come the epilogue, the numbers, the hidden stats, papers, achievements, and Codex / Play again. **Further reading** (the PhD 101 picks) comes last, apart from the result, in both languages: the episodes are English articles and their titles stay English.
- Ending name, title and epilogue.
- **Your PhD in numbers:** every hidden stat revealed, the paper list, a citation sparkline, events discovered this run, and the rarest event you saw.
- Recommended PhD 101 episodes (section 13.2).
- **Better than N% of simulated PhDs** (Arthur, 2026-10-19), under the title. It compares the run's research record (the job-market academic score: papers, top venues, h-index, citations, letter) with `_data/phd_sim/percentiles.yml`.
  - That table holds quantiles from 5,000 mixed bot runs, including people who leave. Regenerate it after balance changes with `simulate.mjs 5000 mixed --percentiles`.
  - Measured: the median score beats 49%, and 101 beats 86%.
- **Share your PhD** (Arthur, 2026-10-19). There is no server or database: the site is static on GitHub Pages, so the result travels in the link.
  - **Link:** `/phd-simulator/#r=…` carries base64 JSON with the ending id, title id, numbers, percentile, daily date, and an achievement bitmask in achievements.yml order. Achievements are append-only for that reason.
  - **Since 2026-10-23** (playtest feedback: a shared result said too little) it also carries the other numbers, the hidden numbers, the epilogue lines by their place in epilogues.yml, the advisor (type and surname from names.yml) and up to 12 papers (venue, cycle, Findings, topic, title list and index, status, citations, first author). The ending records these ids when the run ends (`ref` on the ending and on each paper). A link is about 500–900 characters. Editing or reordering epilogues.yml or a topic's titles changes what old links show, so add new lines at the end.
  - **Shared view:** opening the link shows a read-only card, built from `ui/share.js`, with the same details as the end screen (`ui/result.js`): the story and epilogue, numbers, hidden numbers, advisor, papers and achievements, as far as the link carries them. Older links show their six numbers. It has "Play your own PhD" (and "Play the same daily PhD" on the same day).
  - **Safety:** the card shows only names and text from the game's data. Unknown ids, free text and bad numbers in a hand-made link are dropped, and tests cover this.
  - **Buttons:** the device share sheet (with the image attached, where the browser allows files), X, Bluesky, LinkedIn, Copy link, and Save image.
  - **The image** (since 2026-10-23) is a tall poster, 1080 wide, for WeChat Moments and Instagram: the ending, title, percentile, story and epilogue, all the numbers, the hidden numbers as bars, the advisor, the three most cited papers, achievements, and where to play. Its height follows what's on it (about 2,800 px). Chinese wraps between characters.
  - **Link previews:** LinkedIn and X don't run JavaScript, so a pasted link previews as the game page: `og_image` = `assets/phd-sim/og.jpg`. The page uses the large Twitter card when it has its own image. Re-render the image with `python3 tools/phd-sim/og/render-og.py` (headless Chrome).
- **Play again** and **Codex**.

### 12.2b Languages (Chinese, 2026-10-20)

Arthur asked for a Chinese version of everything: Simplified only, auto-detected with a switch, and he reviews every line before it goes live.

- **English is the single source.** `_data/phd_sim_i18n/zh/<source>.yml` holds `{en, zh}` pairs, one table per content file plus `code.yml`, so mechanics never fork.
  - `engine/i18n.js` `eachText()` names the player-facing content fields. Ids, flags, paper titles and venue names are never translated.
  - `translateData()` swaps content at load, and `t()` / `T_()` handle text written by the code (`docs/phd-simulator/i18n-code.md`).
- **Loading.** `main.js` picks the language from `?lang=`, then the saved choice (`phdsim:lang`), then the browser. It fetches `/assets/phd-sim/i18n-zh.json` (Jekyll renders `site.data.phd_sim_i18n.zh`) and falls back to English if the fetch fails.
- **Switching.** The title screen has an EN / 中文 switch. Switching saves the run and reloads.
  - The end screen and a shared result have the switch too (playtest feedback, 2026-10-23), so a result can be shared in either language. From the end screen the finished run is saved again with a `phdsim:reopen` note in sessionStorage, and the page reopens that end screen in the new language, keeping its leaderboard place. A result opened from the leaderboard keeps whose it is.
  - Saves record the language their text was written in (`lang` on the run and on meta). If it differs from the language on load, `main.js` converts that text once, before the game starts (`engine/relang.js`): exact lines are swapped, template lines have their tokens read back and refilled, and joined lines are split by sentence. Values the code compares, paper titles and PhD 101 essay titles are left alone.
  - `tools/phd-sim/tests/relang.test.mjs` plays the same seeds in both languages and converts each save to the other. English to Chinese comes out exact; Chinese to English is about 99%, with the misses being Chinese lines shared by two English ones ("Ready to submit" / "ready to submit").
- **In Chinese:**
  - Dates read 9月1日–14日, ordinals read 第 N, and "Prof. {name}" becomes {name}教授.
  - A Chinese font stack is used, and emphasis is upright.
  - A render-time pass drops the space left after full-width punctuation.
- **Workflow:** translate, then run `i18n-check.rb`, then rebuild the review page (`tools/phd-sim/i18n-review.mjs`). Arthur's flags are stored in that page's database, and Claude reads them back and fixes them.
  - After English edits, rerun `export-data.rb` and `i18n-extract.mjs`. New and changed lines show up untranslated, and old translations go to `_stale.yml`.
  - The voice and glossary are in `docs/phd-simulator/zh-guide.md`.
- **Shared lookup.** One English string has one translation across all tables, so the same label in two files reads the same everywhere. Conflicts were unified on 2026-10-20.

### 12.2c Leaderboard (Arthur, 2026-10-23)

Playtesters wanted a public record of runs, to compare and to see other people's PhDs. Arthur chose a public leaderboard with both a daily and an all-time board.

- **Two boards, one best run per player.** Today's daily PhD and all time. The daily PhD's day is the US Eastern date (`engine/util.js` dailyDay; the Worker's easternDay): a new one starts at midnight in New York, which is noon or 1 pm in Beijing. It was UTC until Arthur moved it on 2026-10-23, and the title screen, setup screen and board say so. A player is a random id their browser makes up; they can give a nickname (20 characters, no links or markup, a short slur list) or stay anonymous. Each entry opens that run's result card (the share-link view), with a way back.
- **The daily PhD is hidden for now** (Arthur, 2026-10-24: almost no one played it). `daily_challenge: false` in config.yml takes away its title-screen button, the daily board, its lines on the end screen and "Play the same daily PhD" on shared results; the board screen shows only all time. Everything else stays, so setting it to true brings it all back. Daily runs already submitted stay in the all-time chart.
- **The daily PhD is the same game for everyone.** Before, event picks leaned on each player's history, so the same daily seed played out differently. Daily runs now ignore history, and the title screen says how the daily PhD differs from a new one.
- **Server: a Cloudflare Worker with D1** (`tools/phd-sim/leaderboard`), on the same Cloudflare account as the domain, at `api.bingshengyao.com`, deployed from GitHub on push.
  - A first version replayed every run on Vercel with Upstash Redis: Cloudflare's free plan allows 10 ms of CPU and a replay takes about 25 ms. Arthur preferred Cloudflare and wasn't worried about fake results, so it was replaced the same day.
  - The Worker checks a result's shape and that it matches the run's share code (what a viewer sees). It turns away duplicates and limits submissions per hour. He found a "within what simulations produce" check questionable, since a strong player can beat the bots, so there isn't one.
- **Room for a replay check later.** The engine records every choice (`state.inputs`) and which events earlier runs showed (`state.pastSeen`), and `engine/replay.js` plays a record again (`tests/replay.test.mjs`: full runs replay to the identical state). The Worker stores each run's record, so fake entries could be checked later, for example by a scheduled GitHub job.
- **The all-time board is a chart (Arthur, 2026-10-23).** As more people play, where you stand and how PhDs usually end matter more than one list.
  - Every submitted run is a dot (`ui/chart.js`, plain HTML and CSS): years in the PhD across, research score up, colored by ending group (academia, industry, startup, other, leaving). A player's own runs are ringed.
  - Tap a dot for the run (nickname, ending, numbers, "Open this PhD"); tap a group to hide it; tap an ending in the "How PhDs ended" bars to pick those runs out. A top 10 of each player's best run sits below.
  - The Worker serves every run compactly (`/api/runs`, cached a minute) and a run's share code on request (`/api/run`).
  - Simulated runs aren't shown for now (Arthur wants to see it with real runs first).
- **Off until configured:** the page's `data-board` comes from `phd_sim_board` in `_config.yml`. When it's empty, the game has no leaderboard anywhere.

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
1. **Title:** Continue, Start a new PhD, Today's daily PhD, Codex. (How to play was cut, 2026-10-16: the first turn carries a one-line hint instead.)
2. **New PhD:** name and three rolled traits.
3. **Game window** (below). Events, decisions, deadlines, committees and the rebuttal all appear inside it.
4. **End card.**
5. **Codex and achievements.**

### 14.2 The game window (redesigned again 2026-10-16)

Arthur: the full-height layout was too tall, had too much text, and felt like a normal GUI rather than a game. The game is now **a small framed window embedded in the page**, under the page title, like the original game's box.

- **Size:** 760 px wide at most, 560 px tall on desktop; long content scrolls inside the middle. On phones the window grows with its content and the page scrolls.
- **Top strip (dark indigo):** a calendar badge (Year N, date), three icon gauges (⚡ Energy, 😣 Stress, ❤️ Health) with tick marks, 📄 papers and ✦ citations, and two icon buttons (🚪 Leave, ☰ Menu).
- **Middle, the scene:** this turn's choices as **tiles** (icon, label, one short line, arrows, number key). Above the tiles, last turn as **chips**: the bar changes, up to two things that happened (good or bad news; on a quiet turn, a flavor one-liner). Project changes are not repeated here (2026-10-17): the tracker that changed glows instead, and a senior student's tip with its PhD 101 link when there is one.
- **Pop-ups (2026-10-17):** anything that comes up during the turn (random events, deadlines, decisions, the committee, the rebuttal) **pops up over the game** with a dimmed backdrop, so it never reads as one of the turn's choices. Random events stand out further: a burst of rays in the rarity color behind them, a bouncy pop-in, a **picture** for their category with a "Random event" ribbon (a few per category, picked by event id). Since 2026-10-17 the picture is a **column on the left** of the card (190 px; a small thumbnail beside the title on phones), so events fit without scrolling. The pictures are being replaced by **AI-generated art** Arthur makes from `art-prompts.md` (portrait 2:3); `tools/phd-sim/import-art.py` imports them and rewrites `ui/art-manifest.js`, the list the game reads. All 41 slots were replaced with Arthur's art on 2026-10-18 (360 × 540 JPEGs, about 70 KB each; one loads per event); the earlier flat SVGs (`art-style.md`) are in git history. Updates slide up without a picture. Above every pop-up, a **turn strip** keeps you oriented: the dates, "This turn: <your focus>", and a dot per card so far this turn (diamonds for random events).
- **Bottom, the tray:** chips for the advisor (Prof. Surname), statuses, and upcoming quals / proposal / defense (within 16 weeks); then one **tracker** per project (name, a dot per stage: done, now with a pulse, waiting dashed; the stage and deadline) and a **+ New project** tracker with its Stress arrow. Clicking a tracker opens the project close-up in the scene (all stages, the target venue, Shelve). **A submitted paper stays in the tray** as a dashed "letter": a venue stamp, a striped bar that fills until the decision, "Under review" (or the review scores once they're in) and the weeks to the decision.
- **The tray moved to the top (playtest feedback via Arthur, 2026-10-20).** Players read the bottom tray as more of the turn's choices. It's now three parts:
  - **Progress band** under the top strip, in the strip's dark colors: compact flat trackers (name, stage dots, where it stands, deadline) in a grid, then the chips. Tap a tracker for the close-up as before. On phones the trackers sit two per row.
  - **"+ New project"** was a small button beside "Your next two weeks", because it's an action. Arthur found players missed it (2026-10-21), so it's now an **open slot at the end of the trackers** while you plan the turn: "+ New project", "Doesn't use the turn" and its Stress arrow. It's gone at the four-project limit.
  - **When nothing is in progress** (every project is out for review or waiting, so there's no "Work on" tile), the slot lights up in the accent color with a short glow, and a line above "Your next two weeks" suggests starting something while you wait.
  - **PhD 101 pointers** are a quiet one-line footer at the bottom of the window.
  - Pop-ups cover everything below the top strip.
- **Round of 2026-10-18 (Arthur's notes):**
  - **Less text:** choice cards keep only facts (costs, timing, the next deadline); flavor descriptions under choices are gone, and project tiles no longer show an odds word.
  - **Titles stand out:** the run's paper and project titles (full or short, quoted or not) render in italic semibold wherever they appear.
  - **Achievements** never appear inside cards: a Steam-style card slides in at the lower right of the screen, and the 🏆 button in the top strip lists every achievement (secret ones hidden until found).
  - **PhD 101 pointers** from senior labmates and from events collect in a yellow strip above the project trackers (the last two from the past 12 weeks), instead of sitting in the recap or a result.
  - **"Your two weeks"** card: no odds and no repeated project name ("Pilot isn't done yet."). Bar changes and arrows say Energy, Stress and Health in words (icons alone weren't self-explanatory, Arthur), and the top strip spells the names out above each gauge ("⚡ Energy  64").
  - **Decisions on your papers** pop up before you plan the turn (a rejection changes what you'd plan), not after the focus.
  - **Learning weekend picks** (reading group, coffee with the visiting speaker, a nearby workshop) give the project you're working on (or your busiest one) a progress nudge.
  - **The fellowship win** is its own pop-up and unlocks the Fellow achievement right away.
  - **Rebuttal previews (Arthur, 2026-10-18):** the score dots show what the chosen reply could do, with no text. A dashed green dot is a point the reply could gain, and a striped dot is a point it could lose.
    - `replyOutlook` in reviews.js plays each reply 200 times. It uses each concern's prior chance of being fair (`validP`), not the hidden answer, so whether the reviewer is right stays the player's call.
    - "Could gain" is the 90th percentile and "could lose" the 10th. It uses its own seeded dice, so the game's random numbers don't move.
    - The real rebuttal and the preview share `replyEffect`.
- **Cut:** How to play, the Log, the advisor matching screen, committee answer pickers, and most explanatory text. Descriptions are a few words ("Idea · likely · ACL 4w").

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
- **Style:** its own look rather than the site's: warm paper background, an indigo top strip, coral highlights, chunky cards and tiles with a pressed-down shadow, rounded **Fredoka** for titles and labels (Google Fonts), system font for body text. Light and dark palettes follow the site's `html[data-theme]`.
- **Site styles:** the theme colors `p`, `div`, `span`, `li` and friends directly, so the game resets color inheritance inside its frame with a zero-weight `:where()` rule.
- **Motion:** cards slide in, bar changes pop, the current stage dot pulses, low bars blink. All of it is off under `prefers-reduced-motion`.
- **Accessibility:**
  - Arrows carry text labels ("Energy ↓"), so color is never the only signal.
  - Keyboard: 1–9 pick a tile or a card's choice; Escape closes the project close-up.
  - Rarity and gauge colors are checked in both themes.

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
    app.js (flow and input) gameview.js (top strip, progress band of trackers, scene tiles, tip footer, project close-up)
    prompts.js (events, rebuttal, committee cards) screens.js (setup, codex, end card)
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
- **Fan reference:** none since 2026-10-17 (the Legion nicknames were removed).
- Every event offers at least one choice that is reasonable, not just a least-bad one.

---

## 17. Balance targets

Design targets to tune toward, to be calibrated with Arthur's stories and playtests. They are not claims about real-world statistics.

| Measure | Target |
|---|---|
| Five-year run length | 25–40 minutes (one plan per turn, about 0.5 pop-ups per turn) |
| Paper output (Arthur, 2026-10-18) | **Careful players who stay about 5 years: under half reach 5+ papers, under 30% clear the tenure-track bar, 10–15% get the offer** (measured with the `scholar` bot, which goes on the job market in Year 5 and defends at year 4.5: 5+ papers 44%, 6+ 23%, tenure-track bar 24%, offer 14%). **Sensible players: about half have 3 papers by the end of year 4** (52%; Arthur: fine, a real PhD takes 4–5 years), graduation in a median 4.4 years, tenure-track bar 6%. Across all bot types: bar 10%, offer 6%. Settings: `progress.full_turn` 5.5, `reviews.lesson_bonus` 7, `offers.tenure_track_score` 102. Measure with `simulate.mjs N balanced` and `simulate.mjs N scholar` (the Papers, Timeline and Offers lines). |
| Extends past Year 6 | 10–20% of runs |
| Hits the Year 8 cap | under 5% |
| Leaves early (any reason) | 10–20% of runs |
| Tenure-track ending | **only the top 10% of academic profiles can get the offer** (Arthur, 2026-10-17); famous-lab postdoc the top 25% |
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
- **Advisor matching:** always three candidates (later replaced by assignment on day one, section 7.2)
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
