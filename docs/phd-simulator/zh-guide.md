# PhD Simulator: Chinese (简体中文) translation guide

The game's English is the source. Chinese lives in `_data/phd_sim_i18n/zh/*.yml`, one file per content file plus `code.yml` for text the code writes. Each row is a pair: `en` (do not edit) and `zh` (the translation). An empty `zh` falls back to English.

- `tools/phd-sim/i18n-extract.mjs` adds rows for new or changed English. When an English line changes, its old translation moves to `_stale.yml`.
- `ruby tools/phd-sim/i18n-check.rb <files>` checks a set of tables.

Arthur reviews every line before the Chinese version goes live.

## Voice

- **Second person, present tense, plain and light.** The same voice as the English: short sentences, dry humor, no lectures. Use "你", never "您".
- **Write it the way a Chinese grad student would say it.** Translate the meaning and the joke, not the words. If a pun or idiom doesn't survive, write something that's funny in Chinese for the same reason. Avoid 翻译腔: no "被" chains, no long "的的的" strings, no "一个……的" where Chinese would drop it.
- **Keep it as short as the English, or shorter.**
  - Choice labels: about 20 characters at most, start with a verb, no full stop.
  - Titles: short, no full stop.
  - Event text: one to three sentences.
- **No filler.** No 堪称, 无疑, 毋庸置疑, 值得一提的是, or 不仅……而且…… unless the English has that structure. Don't add judgments the English doesn't make.
- **No serious topics.** Same rule as the English: burnout is a light, recoverable state, and nothing about grief, illness beyond colds, harassment or politics.
- **People whose gender isn't given** (labmates, reviewers, committee members): don't use 他 or 她. Repeat the name, restructure the sentence, or use TA sparingly. 他们 is fine for groups.

## Punctuation and spacing

- Full-width Chinese punctuation: ，。？！：；（）. Quotation marks are “ ” and ‘ ’. Use 《》 only for book titles, not paper titles.
- **No dashes (—— or —).** The English avoids them too. Use a comma, a colon or a full stop.
- Put a half-width space between Chinese and English words or numbers: 投稿到 ACL, 3 篇论文, 第 2 号审稿人. There's no space before full-width punctuation.
- Use ASCII digits. Keep "%" half-width: 30%.

## Tokens

Keep every `{token}` exactly as written. You may move it within the sentence. This is what each one shows in the Chinese game:

| Token | Shows | Note |
|---|---|---|
| `{advisor}` | Lee教授 | Already includes 教授, so don't add 教授 or 导师 next to it |
| `{committee}` | Okafor教授 | Same |
| `{labmate}`, `{labmate2}`, `{senior}`, `{mentee}`, `{player}` | a name (Latin letters) | |
| `{topic}`, `{project.topic}` | the research topic in Chinese | e.g. 幻觉检测 |
| `{venue}` | the venue's English name | ACL, CHI |
| `{paper}`, `{project}` | the paper's short English title | Don't add quotes; the game highlights titles itself |
| `{city}` | a city's Chinese name | 维也纳 |
| `{company}`, `{biglab}`, `{model}` | fictional English names | |
| `{fake_prior}` | "Varga et al. (2025)" | |
| `{roll:a-b}` | a number | |
| `{counter.x\|ordinal}` | 第 N | Write "你{counter.x\|ordinal}次……", not "第{counter.x\|ordinal}次" |

## Keep in English

- Venue names (ACL, EMNLP, NAACL, CHI, UIST, CSCW, IUI, COLING, NeurIPS, ICLR, TACL).
- Paper and project titles.
- People's names, fictional companies, labs and model names.
- Common field terms students say in English: GPU, LLM, baseline when it's used as jargon, rebuttal (see the glossary), Findings, workshop, R&R, IRB in parentheses the first time it appears in a line.

## Glossary

| English | 中文 |
|---|---|
| PhD / doing a PhD | 博士 / 读博 |
| PhD student | 博士生 |
| advisor | 导师 |
| labmate | 同门 (or the person's name) |
| lab meeting | 组会 |
| one-on-one | 单独会面 |
| quals (qualifying exam) | 资格考试 |
| thesis proposal | 开题 |
| defense | 答辩 |
| committee | 答辩委员会 (委员会) |
| first-author paper | 一作论文 |
| co-author | 合作者 |
| submit / submission | 投稿 |
| paper deadline | 截稿 (截稿日期) |
| accepted | 中稿 / 被接收 |
| rejected | 被拒 |
| desk reject | 直接拒稿 |
| camera-ready | 终稿 |
| revise and resubmit (R&R) | 大修重投 (R&R) |
| major revision | 大修 |
| Findings | Findings |
| workshop | workshop |
| reviewer / Reviewer 2 | 审稿人 / 2 号审稿人 |
| reviews | 审稿意见 |
| score | 分数 |
| rebuttal / author response | 作者回复 (rebuttal) |
| area chair (AC) | 领域主席 (AC) |
| meta-review | 元评审 |
| citations / h-index | 引用 / h 指数 |
| Energy / Stress / Health | 精力 / 压力 / 健康 |
| Recharge | 休息充电 |
| Read and learn | 读论文学习 |
| Refine | 打磨 |
| burnout | 倦怠 |
| idea | 想法 |
| related work | 相关工作 |
| pilot study | 预实验 |
| experiments | 实验 |
| analysis | 分析 |
| ablation | 消融实验 |
| dataset / benchmark | 数据集 / 基准 |
| annotation / annotators | 标注 / 标注员 |
| crowdworkers | 众包工作者 |
| participants (user study) | 参与者 |
| user study / interview study | 用户研究 / 访谈研究 |
| prototype | 原型 |
| IRB | 伦理审查 (IRB) |
| compute | 算力 |
| TA / grading / office hours | 助教 / 改作业 / 答疑时间 |
| coursework | 课程 |
| fellowship | 奖学金 (fellowship) |
| internship / return offer | 实习 / 转正 offer |
| job market | 求职季 |
| tenure-track professor | tenure-track 助理教授 |
| postdoc / famous lab | 博士后 / 知名实验室 |
| frontier lab | 前沿 AI 实验室 |
| big tech | 大厂 |
| startup | 创业公司 |
| conference / poster / talk | 会议 / 海报 / 报告 |
| Got it / Continue / Celebrate | 知道了 / 继续 / 庆祝 |

## Checklist for every file

1. Every row has a `zh`, and every `{token}` appears in the translation the same number of times.
2. There are no dashes, and no half-width , . ? ! : between Chinese characters.
3. Labels are short and start with a verb. Titles have no full stop.
4. It sounds like a person talking, not a translation.
5. `ruby tools/phd-sim/i18n-check.rb <your files>` reports nothing.
