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
- [ ] The paper that scooped you has a bug; your method is actually better.
- [x] A new frontier model beats your fine-tuned system zero-shot the week before the deadline.
- [ ] Your benchmark gets saturated six months after release.
- [x] The baseline you compare against won't reproduce, and its repo has no README.
- [x] The baseline's authors reply with the missing hyperparameters, a year later.
- [ ] Your results vanish when you change the random seed.
- [x] The API model you evaluated was silently updated; your numbers no longer match.
- [ ] The API price doubles mid-project and your experiment plan halves.
- [ ] Your prompt works perfectly in the demo and falls apart on the test set.
- [x] The cluster goes down for maintenance the week before the deadline.
- [x] There are 400 jobs ahead of yours in the GPU queue.
- [x] Your job runs for three days, then dies at 99% with out-of-memory.
- [x] You find test-set contamination in the model you're evaluating.
- [ ] The labmate's code you built on has a data-leakage bug.
- [x] A one-line change makes everything five points better. You don't trust it.
- [x] Your ablation shows the main component doesn't matter.
- [x] Negative result: the clever method doesn't beat the simple baseline. Publish it anyway?
- [x] A shower thought solves the problem you've been stuck on for a month.
- [ ] You notice your research question has quietly drifted since the proposal.
- [ ] You add a fifth dataset, just in case a reviewer asks.
- [ ] A big lab open-sources a model that makes your project ten times easier.
- [ ] Your LLM-as-a-judge prefers outputs from its own model family.
- [ ] A trivially bad system games your evaluation metric.
- [ ] The dataset you rely on is taken down over licensing.



## B. Research: HCI, user studies, clinical collaborators

- [x] ★ Clinicians reschedule your user study for the third time. *(arc: The Elusive Clinicians)*
- [x] ★ The clinicians' first availability is after the submission deadline. *(arc: The Elusive Clinicians)*
- [x] IRB sends the protocol back over one sentence in the consent form.
- [x] IRB approval takes eight weeks; your study plan assumed four.
- [ ] You need an IRB amendment to add one survey question.
- [x] Three participants no-show on the same day.
- [x] A participant spends the whole session critiquing your font choices.
- [x] Your pilot participant was a labmate; real participants behave nothing like them.
- [x] The prototype crashes in the middle of a session.
- [x] The hospital Wi-Fi blocks your study tool.
- [ ] Your clinician collaborator loves the idea, then goes silent for two months.
- [x] A clinician points out your "realistic scenario" would never happen in a real clinic.
- [x] A nurse gives you the best insight of the whole project in a hallway conversation.
- [ ] Your recruitment flyers bring in exactly one participant: your advisor's friend.
- [x] Bots answer your online survey; 30% of the data is junk.
- [x] Every participant picks "Neutral" on every Likert item.
- [x] The transcription service returns interviews full of "[inaudible]".
- [ ] You and your co-coder disagree on everything; kappa is 0.2.
- [ ] Your think-aloud participant stops thinking aloud.
- [ ] A participant asks to keep using your prototype after the study.
- [x] Every participant ignores your main feature and loves a side feature instead.
- [x] A reviewer asks for a larger study; your 12 clinicians took six months to recruit.
- [ ] Your clinical collaborator wants to be first author.
- [ ] The hospital's legal team must review your data-sharing agreement. *(arc)*
- [ ] Your participant compensation runs out halfway through recruitment.



## C. Data and annotation

- [ ] Annotator agreement on one label is worse than chance.
- [ ] Crowdworkers find a shortcut that makes your task trivial.
- [ ] An annotator writes a three-page email about the guidelines' ambiguities. They're right.
- [x] Your expert annotators (clinicians) can only annotate at 11 pm.
- [x] You annotate 500 examples yourself over a weekend.
- [x] You reach annotation guidelines version 15.
- [x] You find duplicated examples across train and test.
- [ ] Your dataset paper gets more citations than your method paper.
- [ ] A big lab uses your dataset without citing it.
- [ ] Someone opens a GitHub issue about a labeling error in your released dataset.
- [x] Your dataset becomes a standard benchmark. *(rare)*
- [ ] The source data's license forbids redistribution, so you rebuild the dataset.



## D. Writing and submission

- [x] ★ You find a bug in your eval script after the paper is submitted.
- [x] ★ You spend the whole Christmas holiday running experiments and revising the paper.
- [x] The paper is 12 pages; the limit is 8.
- [x] Overleaf goes down two hours before the deadline.
- [x] A co-author pushes a big change at 11:45 pm.
- [x] You forgot to anonymize the GitHub link.
- [x] The deadline is extended by 48 hours. You use all 48.
- [ ] The abstract deadline is a week early; you submit a placeholder abstract.
- [x] Your advisor's comments arrive six hours before the deadline.
- [x] Figure 1 takes three days.
- [x] You rewrite the introduction for the 7th time; version one was the best.
- [ ] The related work section balloons to two pages.
- [x] Your advisor suggests a new title an hour before the deadline.
- [x] The submission system crashes at 11:58 pm.
- [ ] You realize the deadline is Anywhere on Earth: four extra hours.
- [x] A co-author's name is misspelled in the camera-ready.
- [x] There's a typo in the camera-ready version of your paper you didn't notice
- [x] You write the mandatory Limitations section at 3 am.
- [x] You submit to the wrong track.
- [ ] The responsible-research checklist asks a question you can't answer.
- [x] Your method's acronym is already taken by another paper.
- [ ] The LaTeX template changed this year, and nothing compiles.



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
- [ ] Accepted to Findings, not the main conference. Take it or resubmit?
- [x] Not one reviewer responds to your rebuttal.
- [x] One reviewer raises their score after the rebuttal.
- [x] One reviewer reduces their score after the rebuttal (seeing the other's comment)
- [ ] Your resubmission gets the same reviewer as last cycle.
- [ ] A paper you reviewed gets accepted; yours doesn't.
- [x] You're asked to review 10 papers in two weeks.
- [ ] An emergency reviewer request arrives the night before reviews are due.
- [x] Your paper wins an outstanding paper award. *(legendary)*
- [x] A best-paper nomination, then nothing.
- [x] CHI Revise and Resubmit: rewrite half the paper over the holidays.
- [x] The decision email arrives at dinner with your family.
- [x] The acceptance email lands in the middle of lab meeting.
- [ ] Notifications are delayed three days; everyone keeps refreshing the portal.
- [x] The camera-ready needs every change you promised in the rebuttal.
- [x] Fourth submission of the same paper; the reviews are finally good.
- [ ] A reviewer from last cycle follows you on social media.



## F. Advisor: any archetype

- [x] Your advisor sends a "quick question" at 11 pm.
- [x] Your advisor asks for help with a grant proposal due Friday.
- [x] Your advisor goes on sabbatical abroad; meetings move to 6 am your time. *(arc)*
- [ ] Your advisor gets an offer elsewhere and asks if you'd move with them. *(arc)*
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
- [ ] They answer your emails from three different time zones in one week.
- [ ] They stop by your poster for 30 seconds, with a famous friend in tow.

**Imperial Fist** · Micromanager · *"Checks every detail. Every. Single. One."*
- [x] Daily stand-ups start, weekends included.
- [x] They rewrite your figure captions, again, and then your figure.
- [ ] They ask to see your Overleaf edit history "to understand how you work".
- [ ] Your draft comes back with a comment on every sentence, references included.

**Blood Angel** · Hungry Assistant Prof · *"New, ambitious, and hungry for papers."*
- [x] They bring three deadlines in one month, all "very doable".
- [ ] Their tenure case is due, and yours is the paper they need.
- [ ] They start four new projects this semester, and you're on all four.
- [ ] They're submitting to the same deadline as you and ask you to help with theirs too.

**Raven Guard** · Kind but Unfunded · *"Fights for their students on almost no budget."*
- [x] No travel money, so they pay your registration out of pocket.
- [x] You're TA again, and they apologize sincerely, for the third time.
- [ ] The lab shares one GPU, and there's a sign-up sheet on the door.
- [ ] They write you the warmest recommendation letter you've ever read.

**Ultramarine** · Grant Machine · *"Always funded. Always writing grant reports."*
- [x] You write a section of the annual grant report.
- [x] A 40-page lab handbook arrives, with a procedure for everything, including how to name files. *(was: "the Codex arrives")*
- [ ] Every meeting opens with "How does this fit Aim 2 of the grant?"
- [ ] Grant renewal week: the whole lab writes progress summaries instead of research.

**Thousand Son** · Visionary · *"Big ideas, and a new one every week."*
- [x] A 2 am email: "New idea. Let's pivot the whole project." *(was: "a 2 am vision")*
- [x] Last year's wild idea turns out to be right; the field catches up.
- [ ] They send you 14 papers over the weekend, subject line "thoughts?".
- [ ] The idea from their 2 am email wins a best paper award, for another lab.

**Iron Hand** · Industry Joint · *"Half professor, half tech company."*
- [ ] Unlimited compute, but every result needs a legal review before publication.
- [x] Back-to-back company meetings, so your one-on-one happens in a hallway.
- [ ] They bring a product manager to your research meeting.
- [ ] Your summer internship is arranged before you even ask.

**Space Wolf** · Near Retirement · *"A legend of the field, counting down to retirement."*
- [x] Retirement is "in two or three years"; you do the math.
- [x] Their stories about the field in the 1990s turn out to be useful.
- [ ] They went to grad school with half of your committee.
- [ ] They suggest a method from 1997, and it works.

**Alpha Legionnaire** · Serial Founder · *"Three startups, and nobody is sure which one is real."*
- [x] "Just build a quick prototype" for their new startup.
- [x] Your thesis project shows up on a startup's product roadmap.
- [ ] They vanish for two weeks, then reappear with a term sheet.
- [ ] Your labmate turns out to be the CTO of their startup.

**Iron Warrior** · Methods Purist · *"No result survives without ten seeds and a significance test."*
- [x] They demand a power analysis for a pilot study.
- [x] They won't accept your results until you run ten seeds and a significance test.
- [ ] Your 4-page workshop paper gets a 12-page statistics appendix.
- [ ] They ask whether your improvement is "significant, or just exciting".

**Dark Angel** · Kind and Funded · *"Kind, well funded, and never satisfied with borderline work."*
- [x] You've worked three weekends in a row, and they cancel your Monday meeting so you rest.
- [x] They read your draft the same day you send it.
- [x] They ask "who cares?" about your project, kindly, and wait for the answer.
- [x] After an acceptance, lab dinner is on them.
- [ ] After a year, they show you the folder of ideas they've never shared with anyone. *(was: "let into the Inner Circle")*
- [ ] They ask you to come to meetings with answers, not just questions. *(Arrive with Answers)*

*From your quirks (★, new candidates):*

Layout and visual detail:
- [ ] ★ Your draft comes back with a single comment: a circled orphan word at the end of the abstract.
- [ ] ★ Half your section headings are Title Case and half are Sentence case. Fix them all before the meeting.
- [ ] ★ The axis labels in Figure 2 are 6 pt, so the figure goes back for its fourth round.
- [ ] ★ You start noticing orphan words in other people's papers. *(turn-log line; Writing quietly goes up)*
- [ ] ★ Your camera-ready has zero orphan words, and the reply is one word: "Beautiful."

The hard question:
- [ ] ★ Practice talk: one question from your advisor and the whole argument wobbles.
- [ ] ★ Before you submit, they name the paper's biggest weakness in one sentence.
- [ ] ★ Reviewer 2 asks exactly the question your advisor asked three weeks ago, and you already have the answer.
- [ ] ★ At your defense, the hardest question is easier than the ones from lab meeting.

Midnight replies:
- [ ] ★ You send a draft at 11:50 pm, and 30 comments arrive at 12:07 am, ending with "No need to reply until Monday."
- [ ] ★ A 1:12 am email: "Great figure." Nothing else.
- [ ] ★ You're a night owl too, and a midnight email thread becomes your best idea of the year.

Bubble tea:
- [ ] ★ You're tired and could join lab meeting on Zoom, but there's bubble tea in the room.
- [ ] ★ Your advisor remembers your order: less ice, half sugar.
- [ ] ★ You're sent to pick up the order: 14 drinks at 14 different sugar levels.
- [ ] ★ A visiting student starts coming to lab meeting, purely for the bubble tea.
- [ ] ★ Your lab-meeting attendance is suspiciously perfect.

The five Dark Angel events already in the design doc are not repeated here: The Ten Questions, 87 Comments, Not Borderline, Close the Laptop, and Your Direction, Not Mine.

## H. Lab and labmates

- [ ] A labmate asks to be an author for "helpful discussions".
- [ ] Authorship order turns into a standoff on a joint paper. *(arc)*
- [x] A graduating senior leaves you their entire codebase, undocumented.
- [ ] A labmate's acceptance post goes viral the day you get rejected.
- [ ] Lab meeting runs 40 minutes over; nobody knows why.
- [x] A labmate proofreads your paper, and their comments beat the reviewers'.
- [x] Lab retreat: a hike, a whiteboard, and too many ideas.
- [x] A new student asks questions you can't answer.
- [x] Your mentee's code works on the first try, and you're suspicious.
- [ ] A labmate leaves for a startup and invites you along.
- [x] The lab Slack has a channel that is now only memes.
- [ ] A labmate borrows your GPU reservation "for an hour".
- [x] You and a labmate independently start the same project.
- [ ] Lab potluck: yours is the only dish finished.
- [ ] The lab's shared paper template breaks for everyone at once.
- [ ] At a labmate's defense, you're the one holding the clicker.
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
- [ ] You and your advisor argue about the thesis title.
- [ ] The annual review letter says "satisfactory", with a paragraph to read between the lines.
- [ ] The program changes its course requirements mid-PhD.
- [x] Defense prep: finding a two-hour slot when five busy people are all free.
- [x] Defense prep: the graduate school rejects your thesis formatting four times.
- [x] Defense prep: a committee member asks for one more chapter.
- [x] Defense prep: your third paper is still under review, and the decision is due mid-prep.
- [ ] Defense prep: the acknowledgments take longer than Chapter 3.
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
- [ ] Your internship paper is blocked by legal review.
- [ ] The return offer arrives during your proposal week.
- [ ] The fellowship research statement is due during a paper deadline.
- [x] You win a fellowship: no TA for a year.
- [x] Fellowship rejection; the comments read like Reviewer 2's.
- [ ] A recruiter's "perfect for your background" role is in a different field.
- [x] Your internship project ships, with your name in a press-release footnote.
- [ ] Your internship has more compute than your lab has had in five years.
- [x] Job market: 60 faculty applications, each with a custom cover letter.
- [x] A job-talk invite from a school you'd forgotten you applied to.
- [ ] Job talk: one professor's pet topic takes over the Q&A.
- [x] Campus visit: twelve one-on-ones in one day, then dinner.
- [x] Two offers whose deadlines are a week apart.
- [x] A startup offer: equity, a ping-pong table, no salary details.
- [ ] An industry interviewer asks how you'd evaluate their AI features. That's your thesis.
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
- [ ] The conference Wi-Fi dies during your live demo.
- [x] Your oral is the last talk on the last day.
- [x] The session chair cuts you off at minute 12.
- [x] An industry booth offers swag and an interview.
- [ ] Student volunteering gets you free registration, and a week of carrying microphones.
- [x] A city you always wanted to see, and you see only the convention center.
- [x] The reception food runs out in four minutes.
- [ ] You meet someone working on almost the same thing, and you co-author later. *(arc)*
- [ ] Your pre-recorded talk plays with no audio.
- [x] A keynote inspires a new project.
- [x] You catch a cold on the flight home.
- [ ] The conference app makes you session chair for a session you're not in.
- [ ] Your talk video gets 300 views; your parents account for most of them.



## M. World and field

- [x] A frontier model release changes what everyone works on.
- [x] Your topic becomes the hottest thing in the field: 40 papers in a month.
- [ ] Your topic goes cold: "Is this still relevant?"
- [x] Suddenly every paper needs "agents".
- [x] A field-wide online debate about whether your benchmark means anything.
- [x] A famous researcher posts about your paper.
- [ ] Submissions double; the reviewer pool doesn't.
- [x] A big lab claims to solve your task. On closer inspection, it doesn't.
- [x] Industry hiring freezes the year you go on the market.
- [x] Hiring boom: internship offers arrive unasked.
- [ ] A new venue launches and is prestigious within two years.
- [x] A method from the 2010s comes back into fashion.
- [ ] Your venues adopt a new reproducibility checklist.
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
- [ ] A houseplant survives a whole year.
- [ ] You take up running. *(arc: the half-marathon)*
- [ ] A cooking phase: meal prep for the whole week.
- [x] Your parents visit and want to see "where you work".
- [x] Home for winter break; relatives ask when you'll graduate.
- [x] You explain your research to relatives, and they ask you to fix their printer.
- [x] A dating-app match asks what you do. "PhD." The conversation ends.
- [ ] You meet someone at a friend's party. *(arc)*
- [x] Long-distance calls across twelve time zones.
- [x] An undergrad friend gets promoted the same day you get rejected.
- [x] Your laptop dies the week before a deadline; your backups save you, or don't.
- [x] Your phone screen cracks at a conference.
- [x] A free-pizza seminar on a topic you don't care about. You go anyway.
- [x] Thanksgiving or Lunar New Year dinner with labmates.
- [ ] A weekend hike: you come back with an idea and a sunburn.
- [ ] You join a rec sports league; the whole team is PhD students.
- [ ] Halloween: half the lab dresses up as Reviewer 2.



## O. Wellbeing (light)

- [x] You realize you haven't taken a day off in six weeks.
- [ ] A friend drags you out of the lab for dinner.
- [ ] Imposter syndrome after a labmate's best-paper award.
- [x] A week off with no laptop, and you come back with fresh eyes.
- [x] A week off with no laptop, and 100 unread emails and messages from your advisor
- [x] You catch the cold going around the lab.
- [x] Your sleep schedule is now fully nocturnal.
- [ ] A ten-session gym streak.
- [ ] A comparison spiral through everyone's acceptance posts.
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
- [ ] The lab whiteboard still has equations from 2019.
- [x] "Can you hear me?" four times at the start of every meeting.
- [ ] Google Scholar merges your profile with someone with a similar name.
- [x] Your paper gets cited for the opposite of what it says.
- [ ] The squirrel outside the window becomes the lab mascot.
- [ ] The vending machine eats your last dollar.
- [ ] You name your model after a Space Marine Legion; the reviewers don't get it.

---



## Your additions

- [ ]

