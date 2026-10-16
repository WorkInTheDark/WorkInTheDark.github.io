# PhD Simulator: Event Ideas

A brainstorm pool for Arthur to pick from. Nothing here is final.

**How to use it:**

- Change `[ ]` to `[x]` for the ideas to keep.
- Leave the rest as they are.
- To tweak an idea, add a note after it in *italics*.
- Add new ideas at the bottom of any section.

Ticked ideas become event YAML (design doc, section 11). Ideas that obviously run over several turns are marked *(arc)*.

★ marks your own stories.

For scale: Phase 1 needs about 40 events, mostly Years 1–2; Phase 2 needs about 150 in total.

---

## A. Research: NLP and modeling

- [x] ★ A paper comes out two weeks before your target deadline doing almost the same thing. *(arc: Scooped)*
- [x] The paper that scooped you has a bug; your method is actually better.
- [x] A new frontier model beats your fine-tuned system zero-shot the week before the deadline.
- [x] Your benchmark gets saturated six months after release.
- [x] The baseline you compare against won't reproduce, and its repo has no README.
- [x] The baseline's authors reply with the missing hyperparameters, a year later.
- [x] Your results vanish when you change the random seed.
- [x] The API model you evaluated was silently updated; your numbers no longer match.
- [x] The API price doubles mid-project and your experiment plan halves.
- [x] Your prompt works perfectly in the demo and falls apart on the test set.
- [x] The cluster goes down for maintenance the week before the deadline.
- [x] There are 400 jobs ahead of yours in the GPU queue.
- [x] Your job runs for three days, then dies at 99% with out-of-memory.
- [x] You find test-set contamination in the model you're evaluating.
- [x] The labmate's code you built on has a data-leakage bug.
- [x] A one-line change makes everything five points better. You don't trust it.
- [x] Your ablation shows the main component doesn't matter.
- [x] Negative result: the clever method doesn't beat the simple baseline. Publish it anyway?
- [x] A shower thought solves the problem you've been stuck on for a month.
- [x] You notice your research question has quietly drifted since the proposal.
- [x] You add a fifth dataset, just in case a reviewer asks.
- [x] A big lab open-sources a model that makes your project ten times easier.
- [x] Your LLM-as-a-judge prefers outputs from its own model family.
- [x] A trivially bad system games your evaluation metric.
- [x] The dataset you rely on is taken down over licensing.



## B. Research: HCI, user studies, clinical collaborators

- [x] ★ Clinicians reschedule your user study for the third time. *(arc: The Elusive Clinicians)*
- [x] ★ The clinicians' first availability is after the submission deadline. *(arc: The Elusive Clinicians)*
- [x] IRB sends the protocol back over one sentence in the consent form.
- [x] IRB approval takes eight weeks; your study plan assumed four.
- [x] You need an IRB amendment to add one survey question.
- [x] Three participants no-show on the same day.
- [x] A participant spends the whole session critiquing your font choices.
- [x] Your pilot participant was a labmate; real participants behave nothing like them.
- [x] The prototype crashes in the middle of a session.
- [x] The hospital Wi-Fi blocks your study tool.
- [x] Your clinician collaborator loves the idea, then goes silent for two months.
- [x] A clinician points out your "realistic scenario" would never happen in a real clinic.
- [x] A nurse gives you the best insight of the whole project in a hallway conversation.
- [x] Your recruitment flyers bring in exactly one participant: your advisor's friend.
- [x] Bots answer your online survey; 30% of the data is junk.
- [x] Every participant picks "Neutral" on every Likert item.
- [x] The transcription service returns interviews full of "[inaudible]".
- [x] You and your co-coder disagree on everything; kappa is 0.2.
- [x] Your think-aloud participant stops thinking aloud.
- [x] A participant asks to keep using your prototype after the study.
- [x] Every participant ignores your main feature and loves a side feature instead.
- [x] A reviewer asks for a larger study; your 12 clinicians took six months to recruit.
- [x] Your clinical collaborator wants to be first author.
- [x] The hospital's legal team must review your data-sharing agreement. *(arc)*
- [x] Your participant compensation runs out halfway through recruitment.



## C. Data and annotation

- [x] Annotator agreement on one label is worse than chance.
- [x] Crowdworkers find a shortcut that makes your task trivial.
- [x] An annotator writes a three-page email about the guidelines' ambiguities. They're right.
- [x] Your expert annotators (clinicians) can only annotate at 11 pm.
- [x] You annotate 500 examples yourself over a weekend.
- [x] You reach annotation guidelines version 15.
- [x] You find duplicated examples across train and test.
- [x] Your dataset paper gets more citations than your method paper.
- [x] A big lab uses your dataset without citing it.
- [x] Someone opens a GitHub issue about a labeling error in your released dataset.
- [x] Your dataset becomes a standard benchmark. *(rare)*
- [x] The source data's license forbids redistribution, so you rebuild the dataset.



## D. Writing and submission

- [x] ★ You find a bug in your eval script after the paper is submitted.
- [x] ★ You spend the whole Christmas holiday running experiments and revising the paper.
- [x] The paper is 12 pages; the limit is 8.
- [x] Overleaf goes down two hours before the deadline.
- [x] A co-author pushes a big change at 11:45 pm.
- [x] You forgot to anonymize the GitHub link.
- [x] The deadline is extended by 48 hours. You use all 48.
- [x] The abstract deadline is a week early; you submit a placeholder abstract.
- [x] Your advisor's comments arrive six hours before the deadline.
- [x] Figure 1 takes three days.
- [x] You rewrite the introduction for the 7th time; version one was the best.
- [x] The related work section balloons to two pages.
- [x] Your advisor suggests a new title an hour before the deadline.
- [x] The submission system crashes at 11:58 pm.
- [x] You realize the deadline is Anywhere on Earth: four extra hours.
- [x] A co-author's name is misspelled in the camera-ready.
- [x] There's a typo in the camera-ready version of your paper you didn't notice
- [x] You write the mandatory Limitations section at 3 am.
- [x] You submit to the wrong track.
- [x] The responsible-research checklist asks a question you can't answer.
- [x] Your method's acronym is already taken by another paper.
- [x] The LaTeX template changed this year, and nothing compiles.



## E. Reviews, rebuttals, decisions

- [x] Reviewer 2 calls the work incremental, citing a paper that came out after the deadline.
- [x] A reviewer asks you to cite seven papers, all by the same author.
- [x] Two reviews is clearly LLM-written.
- [x] A reviewer says the paper is well written and gives it a 2.
- [x] Scores of 4, 4 and 2, and the meta-review only engages with the 2.
- [x] A reviewer's main concern is answered in Section 3 (but they ignored).
- [x] Reviewers want a comparison to a model released last week.
- [x] Desk reject: over the page limit by one line.
- [x] Desk reject: your acknowledgments broke anonymity.
- [x] Desk reject: you forget to anonymize the github repo
- [x] Desk reject: a collaborators' "[todo]" placeholder was not removed in the submission PDF
- [x] Accepted to Findings, not the main conference. Take it or resubmit?
- [x] Not one reviewer responds to your rebuttal.
- [x] One reviewer raises their score after the rebuttal.
- [x] One reviewer reduces their score after the rebuttal (seeing the other's comment)
- [x] Your resubmission gets the same reviewer as last cycle.
- [x] A paper you reviewed gets accepted; yours doesn't.
- [x] You're asked to review 10 papers in two weeks.
- [x] An emergency reviewer request arrives the night before reviews are due.
- [x] Your paper wins an outstanding paper award. *(legendary)*
- [x] A best-paper nomination, then nothing.
- [x] CHI Revise and Resubmit: rewrite half the paper over the holidays.
- [x] The decision email arrives at dinner with your family.
- [x] The acceptance email lands in the middle of lab meeting.
- [x] Notifications are delayed three days; everyone keeps refreshing the portal.
- [x] The camera-ready needs every change you promised in the rebuttal.
- [x] Fourth submission of the same paper; the reviews are finally good.
- [x] A reviewer from last cycle follows you on social media.



## F. Advisor: any archetype

- [x] Your advisor sends a "quick question" at 11 pm.
- [x] Your advisor asks for help with a grant proposal due Friday.
- [x] Your advisor goes on sabbatical abroad; meetings move to 6 am your time. *(arc)*
- [x] Your advisor gets an offer elsewhere and asks if you'd move with them. *(arc)*
- [x] Your advisor's exciting new idea is the one of yours they rejected a year ago.
- [x] Your advisor forgets the meeting, then reschedules it into your vacation.
- [x] Your advisor asks you to give their guest lecture tomorrow.
- [x] Your advisor introduces you to a famous researcher as "my star student".
- [x] Your advisor volunteers you to run the reading group.
- [x] Your advisor wants weekly written progress reports now.
- [x] Your advisor asks you to mentor a new undergrad.
- [x] Your advisor proposes a new direction after one inspiring talk.
- [x] Your advisor and a collaborator disagree about your paper, and you're in the middle.
- [x] Your advisor replies to a 2,000-word email with "sounds good".
- [x] Your advisor finally reads your draft, three versions too late.



## G. Advisor: Legion signature events

**Plain-language rule:** the Legion name is only a nickname. Every event has to make sense to someone who has never heard of Warhammer, so event text never uses lore terms. The game introduces each advisor with the plain tagline in quotes below, and that tagline is what players actually read.

Your ticks are kept as they were:
- Two ticked ideas were reworded to drop lore; each has a *(was: …)* note.
- The unticked ideas under each Legion are new candidates.

**White Scar** · Famous but Absent · *"Brilliant, famous, and always somewhere else."*
- [x] Your first meeting in months is ten minutes long, at an airport gate.
- [x] Their recommendation letter opens doors you didn't know existed.
- [x] They answer your emails from three different time zones in one week.
- [x] They stop by your poster for 30 seconds, with a famous friend in tow.

**Imperial Fist** · Micromanager · *"Checks every detail. Every. Single. One."*
- [x] Daily stand-ups start, weekends included.
- [x] They rewrite your figure captions, again, and then your figure.
- [x] They ask to see your Overleaf edit history "to understand how you work".
- [x] Your draft comes back with a comment on every sentence, references included.

**Blood Angel** · Hungry Assistant Prof · *"New, ambitious, and hungry for papers."*
- [x] They bring three deadlines in one month, all "very doable".
- [x] Their tenure case is due, and yours is the paper they need.
- [x] They start four new projects this semester, and you're on all four.
- [x] They're submitting to the same deadline as you and ask you to help with theirs too.

**Raven Guard** · Kind but Unfunded · *"Fights for their students on almost no budget."*
- [x] No travel money, so they pay your registration out of pocket.
- [x] You're TA again, and they apologize sincerely, for the third time.
- [x] The lab shares one GPU, and there's a sign-up sheet on the door.
- [x] They write you the warmest recommendation letter you've ever read.

**Ultramarine** · Grant Machine · *"Always funded. Always writing grant reports."*
- [x] You write a section of the annual grant report.
- [x] A 40-page lab handbook arrives, with a procedure for everything, including how to name files. *(was: "the Codex arrives")*
- [x] Every meeting opens with "How does this fit Aim 2 of the grant?"
- [x] Grant renewal week: the whole lab writes progress summaries instead of research.

**Thousand Son** · Visionary · *"Big ideas, and a new one every week."*
- [x] A 2 am email: "New idea. Let's pivot the whole project." *(was: "a 2 am vision")*
- [x] Last year's wild idea turns out to be right; the field catches up.
- [x] They send you 14 papers over the weekend, subject line "thoughts?".
- [x] The idea from their 2 am email wins a best paper award, for another lab.

**Iron Hand** · Industry Joint · *"Half professor, half tech company."*
- [x] Unlimited compute, but every result needs a legal review before publication.
- [x] Back-to-back company meetings, so your one-on-one happens in a hallway.
- [x] They bring a product manager to your research meeting.
- [x] Your summer internship is arranged before you even ask.

**Space Wolf** · Near Retirement · *"A legend of the field, counting down to retirement."*
- [x] Retirement is "in two or three years"; you do the math.
- [x] Their stories about the field in the 1990s turn out to be useful.
- [x] They went to grad school with half of your committee.
- [x] They suggest a method from 1997, and it works.

**Alpha Legionnaire** · Serial Founder · *"Three startups, and nobody is sure which one is real."*
- [x] "Just build a quick prototype" for their new startup.
- [x] Your thesis project shows up on a startup's product roadmap.
- [x] They vanish for two weeks, then reappear with a term sheet.
- [x] Your labmate turns out to be the CTO of their startup.

**Iron Warrior** · Methods Purist · *"No result survives without ten seeds and a significance test."*
- [x] They demand a power analysis for a pilot study.
- [x] They won't accept your results until you run ten seeds and a significance test.
- [x] Your 4-page workshop paper gets a 12-page statistics appendix.
- [x] They ask whether your improvement is "significant, or just exciting".

**Dark Angel** · Kind and Funded · *"Kind, well funded, and never satisfied with borderline work."*
- [x] You've worked three weekends in a row, and they cancel your Monday meeting so you rest.
- [x] They read your draft the same day you send it.
- [x] They ask "who cares?" about your project, kindly, and wait for the answer.
- [x] After an acceptance, lab dinner is on them.
- [x] After a year, they show you the folder of ideas they've never shared with anyone. *(was: "let into the Inner Circle")*
- [x] They ask you to come to meetings with answers, not just questions. *(Arrive with Answers)*

*From your quirks (★, new candidates):*

Layout and visual detail:
- [x] ★ Your draft comes back with a single comment: a circled orphan word at the end of the abstract.
- [x] ★ Half your section headings are Title Case and half are Sentence case. Fix them all before the meeting.
- [x] ★ The axis labels in Figure 2 are 6 pt, so the figure goes back for its fourth round.
- [x] ★ You start noticing orphan words in other people's papers. *(turn-log line; Writing quietly goes up)*
- [x] ★ Your camera-ready has zero orphan words, and the reply is one word: "Beautiful."

The hard question:
- [x] ★ Practice talk: one question from your advisor and the whole argument wobbles.
- [x] ★ Before you submit, they name the paper's biggest weakness in one sentence.
- [x] ★ Reviewer 2 asks exactly the question your advisor asked three weeks ago, and you already have the answer.
- [x] ★ At your defense, the hardest question is easier than the ones from lab meeting.

Midnight replies:
- [x] ★ You send a draft at 11:50 pm, and 30 comments arrive at 12:07 am, ending with "No need to reply until Monday."
- [x] ★ A 1:12 am email: "Great figure." Nothing else.
- [x] ★ You're a night owl too, and a midnight email thread becomes your best idea of the year.

Bubble tea:
- [x] ★ You're tired and could join lab meeting on Zoom, but there's bubble tea in the room.
- [x] ★ Your advisor remembers your order: less ice, half sugar.
- [x] ★ You're sent to pick up the order: 14 drinks at 14 different sugar levels.
- [x] ★ A visiting student starts coming to lab meeting, purely for the bubble tea.
- [x] ★ Your lab-meeting attendance is suspiciously perfect.

The five Dark Angel events already in the design doc are not repeated here: The Ten Questions, 87 Comments, Not Borderline, Close the Laptop, and Your Direction, Not Mine.

## H. Lab and labmates

- [x] A labmate asks to be an author for "helpful discussions".
- [x] Authorship order turns into a standoff on a joint paper. *(arc)*
- [x] A graduating senior leaves you their entire codebase, undocumented.
- [x] A labmate's acceptance post goes viral the day you get rejected.
- [x] Lab meeting runs 40 minutes over; nobody knows why.
- [x] A labmate proofreads your paper, and their comments beat the reviewers'.
- [x] Lab retreat: a hike, a whiteboard, and too many ideas.
- [x] A new student asks questions you can't answer.
- [x] Your mentee's code works on the first try, and you're suspicious.
- [x] A labmate leaves for a startup and invites you along.
- [x] The lab Slack has a channel that is now only memes.
- [x] A labmate borrows your GPU reservation "for an hour".
- [x] You and a labmate independently start the same project.
- [x] Lab potluck: yours is the only dish finished.
- [x] The lab's shared paper template breaks for everyone at once.
- [x] At a labmate's defense, you're the one holding the clicker.
- [x] A visiting summer student outpaces everyone.
- [x] Reading group: you're presenting a paper you didn't read.
- [x] A labmate becomes your best collaborator: three papers together. *(arc)*
- [x] The senior student who gave you advice in Year 1 graduates, and now you're the senior one.



## I. Milestones: courses, quals, proposal, defense

- [x] A required course has nothing to do with your research.
- [x] A course project turns into your first paper.
- [x] Finals week overlaps with a paper deadline.
- [x] At quals, the committee asks about a classic paper you've never read.
- [x] The quals reading list: 80 papers in two weeks.
- [x] You pass quals; the celebration lasts one evening.
- [x] At your proposal: "Why is this a PhD and not a product?"
- [x] Forming a committee: one member is on sabbatical, one never answers email.
- [x] Your industry external member asks about scalability, for everything.
- [x] Two committee members argue about your thesis direction in front of you.
- [x] Your three papers don't tell one story, and the proposal has to. *(Everything Connects)*
- [x] You and your advisor argue about the thesis title.
- [x] The annual review letter says "satisfactory", with a paragraph to read between the lines.
- [x] The program changes its course requirements mid-PhD.
- [x] Defense prep: finding a two-hour slot when five busy people are all free.
- [x] Defense prep: the graduate school rejects your thesis formatting four times.
- [x] Defense prep: a committee member asks for one more chapter.
- [x] Defense prep: your third paper is still under review, and the decision is due mid-prep.
- [x] Defense prep: the acknowledgments take longer than Chapter 3.
- [x] Defense: there's a typo on slide 2.
- [x] Defense: a committee member asks exactly the question you prepared for.
- [x] Defense: the projector won't connect.
- [x] Defense: a committee member joins remotely and keeps freezing.
- [x] After the defense: "Congratulations, Doctor." Then 14 pages of minor revisions.
- [x] Commencement: you put the hood on backwards.



## J. Teaching and TA

- [x] 120 midterms to grade in one weekend.
- [x] A student asks for a regrade on a half-point question.
- [x] Office hours before an assignment deadline: the line goes out the door.
- [x] A student's office-hours question gives you a research idea.
- [x] The professor has a cold, and you're giving tomorrow's lecture.
- [x] The autograder breaks the night before the assignment is due.
- [x] A 3 am email: "Is the deadline tonight?"
- [x] Your TA evaluations say "very patient, talks too fast".
- [x] You're TA for the course you barely passed as an undergrad.
- [x] A former student emails years later to thank you.



## K. Career: internships, fellowships, job market

- [x] An internship interview asks you to invert a binary tree.
- [x] Your internship mentor leaves the company in week 2.
- [x] Your internship paper is blocked by legal review.
- [x] The return offer arrives during your proposal week.
- [x] The fellowship research statement is due during a paper deadline.
- [x] You win a fellowship: no TA for a year.
- [x] Fellowship rejection; the comments read like Reviewer 2's.
- [x] A recruiter's "perfect for your background" role is in a different field.
- [x] Your internship project ships, with your name in a press-release footnote.
- [x] Your internship has more compute than your lab has had in five years.
- [x] Job market: 60 faculty applications, each with a custom cover letter.
- [x] A job-talk invite from a school you'd forgotten you applied to.
- [x] Job talk: one professor's pet topic takes over the Q&A.
- [x] Campus visit: twelve one-on-ones in one day, then dinner.
- [x] Two offers whose deadlines are a week apart.
- [x] A startup offer: equity, a ping-pong table, no salary details.
- [x] An industry interviewer asks how you'd evaluate their AI features. That's your thesis.
- [x] Your advisor's letter arrives late for three applications.
- [x] A postdoc offer from a famous lab.
- [x] A labmate's startup wants you as employee #4.



## L. Conferences and travel

- [x] Your visa appointment is after the conference.
- [x] Lost luggage: you present in the clothes you flew in.
- [x] Jet lag: you fall asleep in the keynote.
- [x] Your poster is behind a pillar.
- [x] Your hero stops by your poster and asks a sharp question.
- [x] Someone explains your poster to you.
- [x] At the networking dinner you sit next to the author of your favorite paper.
- [x] The conference Wi-Fi dies during your live demo.
- [x] Your oral is the last talk on the last day.
- [x] The session chair cuts you off at minute 12.
- [x] An industry booth offers swag and an interview.
- [x] Student volunteering gets you free registration, and a week of carrying microphones.
- [x] A city you always wanted to see, and you see only the convention center.
- [x] The reception food runs out in four minutes.
- [x] You meet someone working on almost the same thing, and you co-author later. *(arc)*
- [x] Your pre-recorded talk plays with no audio.
- [x] A keynote inspires a new project.
- [x] You catch a cold on the flight home.
- [x] The conference app makes you session chair for a session you're not in.
- [x] Your talk video gets 300 views; your parents account for most of them.



## M. World and field

- [x] A frontier model release changes what everyone works on.
- [x] Your topic becomes the hottest thing in the field: 40 papers in a month.
- [x] Your topic goes cold: "Is this still relevant?"
- [x] Suddenly every paper needs "agents".
- [x] A field-wide online debate about whether your benchmark means anything.
- [x] A famous researcher posts about your paper.
- [x] Submissions double; the reviewer pool doesn't.
- [x] A big lab claims to solve your task. On closer inspection, it doesn't.
- [x] Industry hiring freezes the year you go on the market.
- [x] Hiring boom: internship offers arrive unasked.
- [x] A new venue launches and is prestigious within two years.
- [x] A method from the 2010s comes back into fashion.
- [x] Your venues adopt a new reproducibility checklist.
- [x] Today's arXiv listing is 400 papers long.
- [x] A survey paper calls your work "pioneering".



## N. Life outside the lab

- [x] Lease renewal: the rent goes up again.
- [x] Your roommate's new hobby is drums.
- [x] You move apartments during deadline week.
- [x] The first snow: your walk to the lab takes twice as long.
- [x] The first warm day of spring, and nobody is in the lab.
- [x] A friend's wedding falls on your submission weekend.
- [x] You adopt a cat. *(arc)*
- [x] Your cat walks across the keyboard and submits your review.
- [x] A houseplant survives a whole year.
- [x] You take up running. *(arc: the half-marathon)*
- [x] A cooking phase: meal prep for the whole week.
- [x] Your parents visit and want to see "where you work".
- [x] Home for winter break; relatives ask when you'll graduate.
- [x] You explain your research to relatives, and they ask you to fix their printer.
- [x] A dating-app match asks what you do. "PhD." The conversation ends.
- [x] You meet someone at a friend's party. *(arc)*
- [x] Long-distance calls across twelve time zones.
- [x] An undergrad friend gets promoted the same day you get rejected.
- [x] Your laptop dies the week before a deadline; your backups save you, or don't.
- [x] Your phone screen cracks at a conference.
- [x] A free-pizza seminar on a topic you don't care about. You go anyway.
- [x] Thanksgiving or Lunar New Year dinner with labmates.
- [x] A weekend hike: you come back with an idea and a sunburn.
- [x] You join a rec sports league; the whole team is PhD students.
- [x] Halloween: half the lab dresses up as Reviewer 2.



## O. Wellbeing (light)

- [x] You realize you haven't taken a day off in six weeks.
- [x] A friend drags you out of the lab for dinner.
- [x] Imposter syndrome after a labmate's best-paper award.
- [x] A week off with no laptop, and you come back with fresh eyes.
- [x] A week off with no laptop, and 100 unread emails and messages from your advisor
- [x] You catch the cold going around the lab.
- [x] Your sleep schedule is now fully nocturnal.
- [x] A ten-session gym streak.
- [x] A comparison spiral through everyone's acceptance posts.
- [x] A good advisor meeting restores your faith in the project.
- [x] You say no to a fourth side project.



## P. Small absurdities (one-liners for the turn log)

- [x] You open `final_v3_REAL_final.tex`.
- [x] The coffee machine breaks.
- [x] The building's heating is either off or set to Sahara.
- [x] Your experiment finished. It was the wrong config.
- [x] The printer jams the morning of your poster session.
- [x] An undergrad calls you "professor".
- [x] You accidentally reply-all to the department list.
- [x] Your virtual background slips during a job interview.
- [x] The fire alarm goes off during your practice talk.
- [x] A "quick sync" is booked for 90 minutes.
- [x] A package update breaks your Python environment.
- [x] An hour-long bug turns out to be a typo in a config key.
- [x] You find your own paper on a reading list, described wrongly.
- [x] The lab whiteboard still has equations from 2019.
- [x] "Can you hear me?" four times at the start of every meeting.
- [x] Google Scholar merges your profile with someone with a similar name.
- [x] Your paper gets cited for the opposite of what it says.
- [x] The squirrel outside the window becomes the lab mascot.
- [x] The vending machine eats your last dollar.
- [x] You name your model after a Space Marine Legion; the reviewers don't get it.

---



## Your additions

- [ ]

---

## Round 5 candidates (2026-10-16)

Arthur accepted every remaining idea in this doc (2026-10-16), earlier rounds included.

Two-week turns mean about four times as many events per run, and back-to-back runs now share about 60% of their random events. This round adds 123 ideas where the game is thinnest. None of them is an event yet.

- Each line is a situation, then → two or three choice sketches.
- A hook in `code` means the idea fires at that moment, for example `after_reject`. Everything else is an ordinary random draw.
- [Brackets] give a rough condition, such as [TA] or [winter].
- Hints like "(Health up)" say which way a choice pushes a bar. The YAML sets the real numbers.

Checked against everything above, the events in `_data/phd_sim/events/`, and `side.yml`, `opportunities.yml` and `flavor.yml`. Flu shots, the gym, yoga, cooking, early nights, the dentist and day hikes are already side activities or choices, so they're left out.

### R5.1 Health (light and recoverable)

**Sleep**
- [x] Daylight saving ends. The clocks go back an hour, and your body doesn't notice. → Spend the hour asleep (Health up) · Spend it on one more experiment · Book a 7 am meeting, since it "feels like 8" [T5–T6]
- [x] {labmate} lends you a sleep tracker. Your weekly average is 5 hours 12 minutes. → Set a bedtime alarm and obey it (Health up, fewer late nights) · Keep wearing it, stop looking at it · Return it with a note: "broken"
- [x] You nap on the lab couch between runs and wake up with your neck stuck at an angle. → Heat pack and stretches (a slow day) · Work with your head tilted · Go home and sleep in a bed (Health up, a day)
- [x] The radiator in your apartment clanks from 2 to 4 am, every night. → Buy earplugs · Write a polite note to the landlord · Use the hours to write (Health down) [winter]
- [x] It's 1 am, you're in bed, and your phone has 40 arXiv tabs open. → The phone sleeps outside the bedroom from now on (Health up) · Save them for the morning · Just one more abstract
- [x] The weekend after a deadline, you sleep 14 hours straight. → Do it again on Sunday (Health up, Energy up) · Get up and clean the apartment · Start planning the next paper

**Posture, eyes and moving around**
- [x] The university offers free ergonomic assessments. The assessor photographs your setup "for training purposes". → Follow every recommendation (a day, Health up) · Fix only the monitor height · Ask them to blur your face
- [x] Your standing desk arrives. You stand for two hours on day one, then never again. → Alternate on a timer (Health up) · Use it as a shelf for printed papers · Stand through lab meeting to make a point
- [x] The elevator is out for a month, and the lab is on the sixth floor. → Take the stairs (Health up, Energy down) · Work from the ground-floor library · Wait in the lobby, every time
- [x] You realize you haven't seen daylight on a weekday in two weeks. → Hold your next one-on-one outside · Trade desks with {labmate} for the window seat · Buy a daylight lamp
- [x] {labmate} sets up an hourly stretch timer for the whole lab. It goes off during your practice talk. → Stretch with everyone · Mute it · Lead the stretches from now on (labmates up)
- [x] Your new glasses arrive. It turns out the slides were never blurry. → Wear them everywhere (Health up) · Keep them for screens only · Reread your favorite paper, properly this time

**Food and coffee**
- [x] You try quitting coffee for a week. Day two brings a headache with opinions. → Push through to day seven (Health up, a rough week) · Switch to tea · Give up at 10:02 am
- [x] The late-night delivery driver now greets you by name and knows your building's door code. → Order the salad this time · The usual, extra fries (Health down, Stress down) · Make it your last delivery this month
- [x] {labmate} starts a lab lunch rotation: each week, one person cooks for everyone. → Join and cook (Health up, labmates up, a day) · Join, but bring store-bought dumplings · Keep eating at your desk
- [x] The department's "leftovers in the kitchen" emails have fed you for a week: pizza, cookies, one tray of wraps. → Keep it up (free, Health down) · Buy actual groceries · Turn on notifications for the list

**Colds, flu and checkups**
- [x] Your student health plan includes a free checkup. The nurse asks how many hours a day you sit. → Answer honestly and take the advice (Health up) · Round down · Laugh nervously
- [x] You wake up with a fever on the morning of your committee meeting. → Reschedule (a delay, Health up) · Join by video from bed · Go in person and sit far from everyone (Health down) [flu season]
- [x] You catch a cold the day before your clinician sessions, and nobody brings a cold into a hospital. → Reschedule (project delay) · Ask {labmate} to run them from your script · Switch to video sessions [study project, sessions]
- [x] Your voice is gone on the morning you teach section. → Teach from slides and the whiteboard · Swap with another TA (you owe a favor) · Whisper; the students lean in [TA]
- [x] You're home with a cold, and {labmate} leaves soup at your door with a sticky note. → Rest properly (Health up) · Thank them, then work from bed · Return the favor next week (labmates up)

**Weather and sports**
- [x] Snow day: campus is closed. → Actually rest (Stress down, Health up) · Write from home all day · Snowball fight with the lab, then write (labmates up) [winter]
- [x] You slip on the ice outside the building. A sprained wrist means typing with one hand for a week. → Rest it and dictate your writing · Type one-handed, grimly · Pair-program with {labmate} at the keyboard [winter]
- [x] You sneeze and pull a muscle in your back. → Ice and a day on the floor (Health up) · Work standing very still · Tell everyone it was a sports injury
- [x] The annual faculty-vs-students soccer match. {advisor} is on the other team. → Play hard (Health up, sore for a week) · Play gently whenever your advisor has the ball · Cheer from the sideline with snacks
- [x] {labmate} drags you to the climbing gym. The next morning, your forearms are too sore to type. → Go again next week (Health up, labmates up) · Stick to the easy wall · Rest your hands and read papers instead

**Conference travel**
- [x] `conference` Fourteen hours on the plane, last row, next to the restroom. → Walk the aisle every hour (Health up) · Eye mask and sleep · Finish your slides on the tray table (presenting up, Health down)
- [x] `conference` Jet lag wakes you at 4 am. The hotel gym opens at 5. → Work out (Health up) · Rehearse your talk in the empty lobby · Lie in the dark reading arXiv
- [x] `conference` Your phone says 23,000 steps a day. Your feet say more. → Buy comfortable shoes in {city} · Sit through the afternoon sessions · Keep walking the poster hall (network up, Health down)
- [x] `conference` Three days of coffee-break pastries. → Find a grocery store · Embrace it (Health down, Stress down) · Save room for the reception, which runs out of food in four minutes
- [x] `conference` The conference fun run starts at 6:30 am, and two of your favorite authors have signed up. → Run it (Health up, network up) · Sleep in · Walk it with a coffee and meet them at the finish
- [x] `conference` Your flight home is canceled overnight, and the line for hotel vouchers is two hours long. → Wait for the voucher (Energy down) · Sleep on the floor by the gate (Health down) · Work through the night on revisions

### R5.2 New tasks (Stress)

**Reviewing**
- [x] `after_submit` This cycle, every author must also review. You're assigned five papers, due in three weeks. → Do all five properly (Stress up, knowledge up) · Do them fast · Ask the chairs for a lighter load
- [x] {advisor} forwards their own review assignment: "Could you take a first pass on these four?" → Write careful drafts (knowledge up, advisor up) · Send short notes · Ask to be listed as a sub-reviewer (network up)
- [x] Reviewer bidding is open: 1,800 abstracts, bids due Thursday. → Read titles for an evening · Bid "eager" on everything in your topic · Skip bidding and accept your fate
- [x] The area chair says your review is "too short" and asks you to expand it by Friday. → Rewrite it properly · Add two paragraphs · Point out that the paper was short too
- [x] Discussion period: the area chair pings you three times about the authors' response. → Read it and engage · Raise your score · Reply "I maintain my score"
- [x] A journal sends the revised version of a paper you reviewed eight months ago. You remember none of it. → Reread both versions (a day) · Check only your old points · Decline politely

**Teaching and grading** [TA]
- [x] Final project reports: 45 groups, ten pages each, grades due in four days. → Grade them all carefully (Stress up, Health down) · Use a tight rubric and move fast · Split them with the other TA
- [x] Halfway through grading, you notice the answer key is wrong on question 3. → Regrade everything · Accept both answers · Tell the professor and let them decide
- [x] Group peer evaluations are in. Every member of every group did 40% of the work. → Read the commit histories · Give each group one grade · Meet the three most confusing groups
- [x] The professor asks you to write the midterm: "Two questions that are hard but fair." → Write new questions (knowledge up, a day) · Adapt last year's · Borrow from the textbook
- [x] You're proctoring the 8 am Saturday final. → Proctor and grade in the room · Swap with another TA (you owe a favor) · Bring coffee for the whole room
- [x] The course moves to a new course website mid-semester, and you're the one moving it. → Do it carefully (a day) · Move only what's due this month · Write a script for it (coding up)
- [x] A student's essay opens with "As an AI language model". → Fill in the six-page integrity form · Talk to the student first · Forward it to the professor

**Sudden slides and demos**
- [x] The lab meeting presenter cancels. You're up in an hour. → Show your messy results honestly · Present a paper you read last week · Run a brainstorm instead
- [x] The department open house needs one slide about your research, in two hours. → Make one clean slide · Reuse your last title slide · One striking figure, no words
- [x] The dean tours the building tomorrow and wants a live demo of your system. → Polish it tonight (Health down) · Record a backup video · Show slides instead

**Onboarding**
- [x] You're assigned two first-year "buddies". They message you about the cluster every day. → Hold a weekly Q&A · Answer every message (Stress up) · Point them to the docs (there are no docs)
- [x] Eleven people asked you the same cluster question this month. → Write the onboarding doc (a day, labmates up) · Record a ten-minute video · Pin your best Slack answer
- [x] A new postdoc needs access to the data server, and only you know how the permissions work. → Walk them through it (a day) · Write it down this time · Send them to IT
- [x] A summer outreach program sends you three high schoolers for a week. → Give them a mini project · Let them test your prototype · Show them lab life, snacks included [summer]

**Admin and forms**
- [x] Your travel reimbursement is rejected: the receipt is a photo of a receipt, in another currency. → Find the original · Fill in the "missing receipt" form · Let the $43 go
- [x] The annual research-ethics refresher is due Friday: eight modules, or your study is paused. → Do it properly · Click through at double speed · Do it during lab meeting (advisor down)
- [x] Your plan-of-study form needs {advisor}'s signature in ink, and {advisor} is traveling for two weeks. → Mail it to their hotel · Ask the grad office about e-signatures · Wait (a delay)
- [x] Equipment inventory: tag every monitor. You find three that belong to nobody. → Report them · Adopt one as your second screen · Tag them to the lab and move on
- [x] Your survey tool's subscription ends in the middle of your study. → Pay out of pocket · Move to the university's free tool (a day) · Ask the department for funds
- [x] Finance needs a signed receipt for each of the 40 gift cards you gave participants. → Email all 40 · Build a sign-off form · Ask for an exception
- [x] The IRB's annual check-in is due in a week, and it asks for enrollment numbers you never tracked. → Rebuild them from your calendar (a day) · Estimate honestly and say so · Ask for a week's extension
- [x] A new data policy: all study data must move to the approved server by Friday. → Move it carefully (a day) · Move it and hope the paths still work · Ask for an extension

**Letters and reports**
- [x] {advisor} asks you to draft your own recommendation letter: "You know your work best." → Write it honestly · Write it boldly · Swap drafting duty with {labmate}
- [x] A student from your section asks you for a recommendation letter for a summer program. → Write a warm, specific letter (a day) · Offer a short one · Suggest they ask the professor [TA]
- [x] {mentee} asks for a "supporting note" for their grad-school application letter, due in five days. → Write a detailed note · Send bullet points · Help them ask {advisor} directly
- [x] The annual progress report needs a committee meeting and three signatures by the end of the month. → Get everyone in one room · Collect signatures by email · Ask the grad office for more time
- [x] The report asks you to compare last year's goals with what happened. You set nine, met two, and did seven other things. → Report it straight · Turn the seven into a story · Quietly reword last year's goals
- [x] The form asks for your expected graduation date. You and {advisor} write different years. → Talk it through (advisor up) · Use your advisor's year · Write a range

**Service and extras**
- [x] A friend asks you to co-organize a workshop at next year's conference. → Say yes (network up, Stress up) · Offer to run just the website · Decline kindly
- [x] The university press office needs a quote about chatbots in hospitals by 5 pm. → Write a careful two-sentence quote · Pass it to {advisor} · Send them your abstract
- [x] A stranger's pull request rewrites your whole repo "for readability". → Review it line by line (a day) · Merge it and hope · Thank them and close it
- [x] `after_accept` {venue} offers a reproducibility badge if your code runs in a container by next week. → Containerize it (coding up, Stress up) · Skip the badge · Ask {labmate} for help
- [x] `after_accept` The proceedings want a 150-word plain-language summary of {paper}. Your draft says "leverage" four times. → Write it properly (writing up) · Ask a non-academic friend to read it · Simplify the abstract and send it
- [x] `deadline` {venue} accepts an optional video figure. Your narration is on take 14. → Finish it properly (presenting up) · Screen recording with captions · Skip it

### R5.3 Bad news around submissions and decisions

**When the reviews arrive**
- [x] `reviews_in` One review is three sentences long. Score: 1. Confidence: 5. → Ask the area chair to weigh it lightly · Answer it like a full review · Spend the rebuttal on the other two
- [x] `reviews_in` Reviewer 1 wants fewer experiments; Reviewer 3 wants more. → Side with one · Find the careful middle · Let the area chair sort it out
- [x] `reviews_in` A reviewer asks you to compare against a paper that is your own earlier work, and you can't say "that's us". → Compare to it politely · Flag it confidentially to the area chair · Add the citation and sigh
- [x] `reviews_in` A fourth, late "emergency" review arrives. It's the harshest of the lot. → Answer it first · Note that it came late · Treat it like the others
- [x] `reviews_in` The rebuttal limit is 2,500 characters. Your reply to Reviewer 2 alone is 6,000. → Cut to the three strongest points (writing up) · Write it like a telegram · Answer only Reviewer 2
- [x] `reviews_in` A reviewer says your user study needs a control condition. → Defend the design · Promise it as future work · Run a quick online version in five days (Stress up, Health down)
- [x] `reviews_in` "The authors should consider using large language models." Your paper is entirely about large language models. → Point politely to the title · Point to Sections 1 through 6 · Laugh, then answer it as a real question
- [x] `reviews_in` A reviewer's summary describes a different paper entirely. → Correct the summary gently · Write to the area chair · Answer as if they had read it
- [x] `reviews_in` All three reviewers give a borderline score and say "I could go either way." → Write your strongest rebuttal (Stress up) · Keep it short and polite · Withdraw and aim higher next cycle
- [x] `reviews_in` The rebuttal window opens on the first day of a conference you're at. → Write it in the hotel at night (Health down) · Skip a day of sessions · Split it with your co-author [at a conference]

**Right after submitting**
- [x] `after_submit` The morning after you submit, you think of the one experiment that would have made the paper. → Run it now for the rebuttal (Stress up) · Save it for the next paper · Write it down and go back to sleep

**After a rejection**
- [x] `after_reject` The meta-review is one sentence long. → Reread the reviews for clues · Email the area chair · Print it and pin it to the wall
- [x] `after_reject` "Rejected, but this would make a great workshop paper." → Send it to the workshop · Hold out for another main venue · Split it into two papers
- [x] `after_reject` {advisor}: "Let's turn it around for the next deadline. It's in three weeks." → Turn it around fast (Stress up) · Ask for one more cycle to fix it properly · Fix only the top two concerns
- [x] `after_reject` A week later, you reread the reviews. They're... mostly fair. → Turn them into a fix list (Stress down) · Stay a little mad · Write one thank-you line in your notes
- [x] `after_reject` You have to tell your clinical collaborators the paper was rejected. They ask whether the study was wasted. → Explain peer review honestly · Share the kind parts of the reviews · Invite them to plan the resubmission (network up)
- [x] `after_reject` The arXiv version of {paper} is cited twice the same week it's rejected. → Feel better (Stress down) · Update arXiv with the fixes · Screenshot it for {advisor}
- [x] `after_reject` Your co-author wants to resubmit unchanged: "It's a lottery anyway." → Agree (fast) · Insist on fixes · Fix the two cheapest things
- [x] `after_reject` It was {mentee}'s first paper, and you have to tell them. → Tell them in person, with cookies · Forward the reviews with a long note · Ask {advisor} to tell them
- [x] `after_reject` The new reviewers want you to remove the section last cycle's reviewers asked you to add. → Remove it · Keep it and explain · Move it to the appendix [resubmission]
- [x] `after_reject` Last cycle: "too HCI for this venue". This cycle: "too NLP for this venue". Same paper. → Rewrite it for one community · Aim for an interdisciplinary venue · Turn it into a position paper [resubmission]
- [x] `after_reject` The rejection arrives on your birthday. → Cake first, reviews tomorrow · Read them now · Ask the lab never to mention it
- [x] `after_reject` Rejected after a Revise and Resubmit, and the deciding reviewer wasn't in the first round. → Ask the chairs what happened · Take it to a journal · Revise once more for the next cycle [after a revise-and-resubmit]

### R5.4 Everyday NLP × HCI research life

**User studies**
- [x] Wizard-of-Oz study: for six sessions in a row, you are the "AI", typing from the next room. → Type fast and stay in character (Health down) · Script canned replies · Take shifts with {labmate}
- [x] Your participatory design workshop produces 412 sticky notes. → Affinity-map them on the lab wall over a weekend · Photograph and code them on screen · Ask the participants to vote on themes
- [x] A participant reads your write-up and says, "That's not what I meant." → Revise the theme · Add their correction as a quote · Explain your reading
- [x] An interview goes 20 minutes off-script into a story about the clinic's old pager system. → Let them talk · Steer back politely · Book a follow-up
- [x] The screen recording failed for your best session. You have the audio only. → Rebuild it from your notes · Ask the participant for a follow-up · Drop the session
- [x] The manipulation check fails: participants can't tell the AI condition from the no-AI condition. → Redesign the conditions (a delay) · Reframe it as a finding · Make the AI more visible
- [x] In the pilot, your attention check is so tricky that {advisor} fails it. → Simplify it · Keep it and call it rigor · Add a second, easier one
- [x] Counterbalancing needs 24 participants. You have 23. → Recruit one more (a delay) · Report an unbalanced order · Ask {advisor} whether 23 is "basically 24"
- [x] Mid-session, your study chatbot recommends a soup recipe to a clinician. → Log it and move on · Pause and fix the prompt · Make it a finding about off-task replies
- [x] The clinicians say the tool has to work in the 30 seconds between patients. → Redesign for 30 seconds · Time how long it really takes · Argue for a different moment in their day
- [x] A quick accessibility check: your prototype fails basic screen-reader support. → Fix it before the study (a delay, quality up) · Fix the worst three issues · Note it as a limitation
- [x] Your discussion section lists 11 design implications. {advisor} says keep three. → Keep the three strongest · Group them into three themes · Fight for five

**Annotation and clinical text**
- [x] With model-suggested labels switched on, your annotators accept the suggestion 98% of the time. → Add a no-suggestion condition · Make it a paper of its own · Hide suggestions until they choose
- [x] The de-identification tool deletes every "May" and "Will" in your clinical notes. → Patch it with rules · Try another tool · Write up what de-identification breaks
- [x] In your notes, "pt" means patient, physical therapy and part-time. → Build an abbreviation list with the clinicians · Let the model guess · Make it an evaluation slice
- [x] Your evaluation includes outputs in a language nobody in the lab reads. → Recruit a native speaker (network up) · Use back-translation · Read them yourself [Polyglot]

**Working with models**
- [x] After reading 300 model outputs, you start your emails with "Certainly!" → Take a break (Stress down) · Sort the errors into categories · Finish all 500 today
- [x] The model cites a paper that doesn't exist, and credits it to {advisor}. → Add a citation check to your evaluation · Show {advisor} · Put it on a slide
- [x] Same prompt, temperature zero, three runs, three different answers. → Run it five times and report the spread · Switch to a local model · Fix the seed and hope
- [x] A retry loop spends the lab's monthly API budget overnight. → Tell {advisor} right away · Use a smaller model for development · Write a budget guard (coding up)
- [x] The API model your paper evaluates will be retired next month. → Rerun everything on its replacement · Release your saved outputs · Switch to an open model
- [x] The safety filter refuses to summarize a note about a sprained ankle, citing "graphic content". → Reword the prompt · Use an open model · Count refusals as a result
- [x] The model returns broken JSON 3% of the time. Your parser now has 40 regular expressions. → Use constrained decoding · Retry until it's valid (costs more) · Count failures as errors
- [x] Your human raters prefer the baseline, because its answers are shorter. → Control for length · Report it as a finding · Shorten your system's answers

**Code and collaborators**
- [x] Your best result came from a notebook with 400 cells, run out of order. → Rewrite it as a clean script (a day) · Rerun it top to bottom and hope · Report the result you can reproduce
- [x] You accidentally commit a 4 GB checkpoint to the lab repo. Everyone's pull now takes an hour. → Rewrite the history (risky) · Apologize in the lab Slack, with donuts · Ask {senior} for help
- [x] Your clinician co-author sends edits as tracked changes on a .docx copy of your LaTeX paper. → Merge them by hand · Teach them Overleaf · Ask for comments only next time
- [x] The partner clinic switches its record system mid-project, and every screenshot in your prototype is out of date. → Update the prototype (a delay) · Keep the old version and say so · Wait for the switch to settle
