# PhD Simulator: AI art prompts for event pictures

Each random event shows a picture in a column on the left of its card. Pictures are per category (a few per category, picked by the event id). There are 41 slots below; you can replace them a few at a time, and any slot you haven't replaced keeps its current flat SVG.

## How to make and add them

1. **Tool:** any image generator (ChatGPT, Gemini, Midjourney, Ideogram…). Ask for **portrait 2:3** (for example 1024 × 1536). Square works too; the import trims the sides.
2. **Keep one style.** Make `research-1` first. Then:
   - Chat tools (ChatGPT, Gemini): stay in one conversation. Send the style message below once, then one scene per message ("Next: …").
   - Midjourney: use `<scene>, <style>` with `--ar 2:3`, and pass your first image as the style reference (`--sref <url>`) on all the others.
   - Others: attach `research-1` as a style or reference image.
3. **Save** each image as `<slot>.png` (for example `research-1.png`, `lab-3.png`; `.jpg` and `.webp` work too) into `tools/phd-sim/art-inbox/` (create the folder; it's not committed).
4. **Import:** `python3 tools/phd-sim/import-art.py`. It crops to 2:3, shrinks to 360 × 540 JPEG (about 30 KB), replaces the old picture for that slot, moves your original to `art-inbox/done/`, and updates the list the game reads. Then run the validator as usual.
5. **Rules for every picture:** no text, letters or numbers anywhere; fictional people only (no real people, logos or brands); a light, warm tone (nothing scary or sad); **keep the main subject in the middle**, because phones show a small square crop of the center.

## The style (send once, or append to every prompt)

> Cozy, warm 2D illustration in the style of a gentle indie video game: soft flat shapes with subtle paper-grain texture and soft shading, rounded friendly forms, clean outlines in deep navy. Limited palette: warm cream, coral orange, deep indigo, mustard yellow, soft lavender, sage green and sky blue. One clear subject in the center, a simple uncluttered background, portrait 2:3. People are stylized and friendly, with varied skin tones and hairstyles. No text, no letters, no numbers, no logos anywhere in the image.

## The scenes

**research** (experiments, ideas, compute)
- `research-1`: A grad student at a desk, smiling at a laptop showing a rising line chart, a small lab flask and a coffee mug beside them.
- `research-2`: A lightbulb moment: a student at a whiteboard covered in boxes and arrows, a big glowing lightbulb above their head.
- `research-3`: A tall humming GPU server rack with colorful status lights, a small monitor with a progress bar, a mug of coffee on top.

**data** (datasets, annotation)
- `data-1`: Towering stacks of spreadsheets drawn as grids of colored cells, a student peering through a giant magnifying glass.
- `data-2`: Annotation work: a tablet listing items with green check marks and one red cross, colorful tags floating around it.
- `data-3`: A funnel turning a messy cloud of scattered dots into a neat, rising bar chart.

**writing** (papers, drafts, deadlines)
- `writing-1`: A paper draft seen from above, lines of text drawn as strokes, covered in red-pen circles and arrows, a red pen and a latte beside it.
- `writing-2`: Late-night writing: a desk lamp, a laptop, a window with a crescent moon and stars, a tired but determined student.
- `writing-3`: A tall stack of drafts bristling with colorful sticky notes, a pen, two crumpled paper balls.

**reviews** (peer review, rebuttals, decisions)
- `reviews-1`: Three reviewer cards with cartoon faces, one frowning, one neutral with glasses, one smiling, each with a row of colored dots instead of scores.
- `reviews-2`: An envelope opening, a letter rising out of it, question-mark shapes floating around (shapes, not text).
- `reviews-3`: A stern but friendly reviewer with a bow tie peering through a big magnifying glass at a paper on a clipboard.

**advisor** (meetings, feedback, the advisor's quirks)
- `advisor-1`: A professor with glasses and gray hair pointing at a diagram on a whiteboard, a student taking notes.
- `advisor-2`: A one-on-one across a desk: advisor and student with two steaming mugs and a laptop showing a chart.
- `advisor-3`: A student in bed at night, wide-eyed, holding a phone overflowing with message bubbles, a moon in the window.

**lab** (labmates, the shared office)
- `lab-1`: Three labmates around a small table sharing a pizza, laughing.
- `lab-2`: A cozy shared grad office: two desks with monitors, a big plant, a whiteboard full of doodles.
- `lab-3`: A small lab celebration: balloons, confetti, a cake with candles, two people cheering.

**milestone** (quals, proposal, defense, deadlines)
- `milestone-1`: A graduation cap with a golden tassel resting on a stack of books, a rolled diploma beside it.
- `milestone-2`: A student presenting slides with a bar chart to a committee of three seated behind a long table.
- `milestone-3`: A wall calendar with one day circled in coral, an alarm clock on the desk below.

**teaching** (TA duty, grading, office hours)
- `teaching-1`: A teaching assistant at a whiteboard in front of a few rows of students seen from behind.
- `teaching-2`: Grading at night: a tall stack of papers, a red pen, a tired but smiling TA with a mug.
- `teaching-3`: Office hours: a puzzled student and a helpful TA at a desk, a speech bubble with a question-mark shape.

**career** (internships, job market)
- `career-1`: Two people shaking hands, a briefcase at their feet, a potted plant.
- `career-2`: A career-fair booth with a blank banner, tote bags and sticker sheets on the table, a waving recruiter.
- `career-3`: A video interview: a laptop showing an interviewer, the candidate sitting upright in front of it.

**travel** (conferences, trips)
- `travel-1`: A small airplane flying over fluffy clouds into a bright sky.
- `travel-2`: A conference poster session: a poster board with blocks and a chart, a student presenting to a curious visitor with a coffee.
- `travel-3`: A suitcase covered in colorful travel stickers, a passport and a boarding pass leaning against it.

**world** (the field, AI news, hype)
- `world-1`: A glowing globe wrapped in network lines and nodes.
- `world-2`: A newspaper whose front page shows a friendly robot (headlines drawn as thick lines, no text).
- `world-3`: A line chart that turns into a rocket shooting upward, sparkles around it.

**life** (home, friends, family)
- `life-1`: A cozy small apartment: a couch with a sleeping cat, a floor lamp, a plant, a window.
- `life-2`: Cooking in a small kitchen: a person stirring a steaming pot.
- `life-3`: Two friends at a café table with cups of tea and a slice of cake.

**wellbeing** (health, rest, exercise)
- `wellbeing-1`: A person in a calm yoga pose on a mat next to a big leafy plant.
- `wellbeing-2`: A person jogging along a park path between trees, a warm sun.
- `wellbeing-3`: Someone sound asleep in bed under a soft blanket, a moon and stars in the window (no "Z" letters).

**exit** (leaving, new paths)
- `exit-1`: A door slightly open with warm golden light spilling out, a small potted plant beside it.
- `exit-2`: A person standing where a path forks in two, blank signposts pointing different ways, a sunset.
