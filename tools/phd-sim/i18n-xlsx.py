#!/usr/bin/env python3
"""The Chinese translation as a spreadsheet Arthur can edit, and back.

  export: ruby tools/phd-sim/export-data.rb
          node --experimental-default-type=module tools/phd-sim/i18n-review.mjs <rows.json> --json
          python3 tools/phd-sim/i18n-xlsx.py export <rows.json> <out.xlsx> [--literal <git ref>]
  import: python3 tools/phd-sim/i18n-xlsx.py import <edited.xlsx>

Rows are matched by table + English, so sorting or filtering the sheet is fine. An edited 中文 cell
replaces that line's translation in _data/phd_sim_i18n/zh/<table>.yml, and in any other table with
the same English (the game shares one translation per English line). Notes are printed for Claude.
"""
import json, os, re, subprocess, sys
import yaml
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ZH_DIR = os.path.join(ROOT, "_data", "phd_sim_i18n", "zh")
SHEETS = [("事件 Events", lambda s: s.startswith("events/")), ("游戏文本 Game text", lambda s: not s.startswith("events/") and s != "code"),
          ("界面 Interface", lambda s: s == "code")]
HEAD = ["表 Table", "位置 Where", "English", "中文（在此修改）", "直译版 Literal first pass", "本次改写 Localized", "备注 Notes for Claude"]
WIDTH = [16, 30, 60, 60, 46, 10, 30]
FONT = "Arial"
PAIR = re.compile(r'^- en: (".*")\n  zh: (".*")$', re.M)


def literal_tables(ref):
    """The first, literal translation, read from git, as {table: {en: zh}}."""
    out = {}
    if not ref:
        return out
    files = subprocess.run(["git", "ls-tree", "-r", "--name-only", ref, "_data/phd_sim_i18n/zh"], cwd=ROOT, capture_output=True, text=True).stdout.split()
    for f in files:
        if not f.endswith(".yml") or f.endswith("_stale.yml"):
            continue
        src = f[len("_data/phd_sim_i18n/zh/"):-4]
        text = subprocess.run(["git", "show", ref + ":" + f], cwd=ROOT, capture_output=True, text=True).stdout
        out[src] = {r["en"]: r.get("zh", "") for r in (yaml.safe_load(text) or [])}
    return out


def export(rows_json, out_path, ref):
    data = json.load(open(rows_json, encoding="utf-8"))
    lit = literal_tables(ref)
    wb = Workbook()
    readme = wb.active
    readme.title = "说明 README"
    lines = [
        ("读博模拟器 · 中文翻译表", True),
        ("每一行是游戏里的一句话。只改黄色的「中文（在此修改）」一列；其他列请不要改（导入时按「表 + English」对行）。", False),
        ("可以排序、筛选、加批注；想让 Claude 处理的问题写在「备注 Notes for Claude」里。", False),
        ("{advisor}、{labmate}、{n} 这类花括号是游戏自动填的内容（人名、数字等），请原样保留，可以挪位置。", False),
        ("「直译版」是第一版直译，只供对照；「本次改写」标 ✓ 的行是这次本地化改过的。", False),
        ("同一句英文在多个表里出现时，游戏只用一种中文：改其中一处，导入时会同步到所有地方。", False),
        ("改完把文件发回给 Claude（或放回原处），Claude 会导入、检查并在游戏里测试。", False),
        ("", False),
        ("Each row is one line of the game. Edit only the yellow 中文 column; rows are matched by table + English, so sorting and filtering are safe.", False),
        ("Keep {tokens} like {advisor} or {n} exactly (you can move them). Put anything you want Claude to handle in the Notes column.", False),
        ("", False),
        ("示例 Example", True),
    ]
    for i, (t, bold) in enumerate(lines, 1):
        c = readme.cell(row=i, column=1, value=t)
        c.font = Font(name=FONT, bold=bold, size=14 if i == 1 else 11)
    ex_row = len(lines) + 1
    for j, h in enumerate(["English", "原来的中文", "你改成"], 1):
        readme.cell(row=ex_row, column=j, value=h).font = Font(name=FONT, bold=True)
    for j, v in enumerate(["{advisor} says \"fine\" in a way that is not quite fine.", "{advisor}说了句“行吧”，听起来不太行。", "{advisor}回了句“行吧”。懂的都懂，这不太行。"], 1):
        c = readme.cell(row=ex_row + 1, column=j, value=v)
        c.font = Font(name=FONT)
        c.alignment = Alignment(wrap_text=True, vertical="top")
    readme.column_dimensions["A"].width = 60
    readme.column_dimensions["B"].width = 44
    readme.column_dimensions["C"].width = 44

    edit_fill = PatternFill("solid", fgColor="FFF6CC")
    head_fill = PatternFill("solid", fgColor="283454")
    thin = Side(style="thin", color="DDDDDD")
    counts = {}
    for title, pick in SHEETS:
        ws = wb.create_sheet(title)
        for j, h in enumerate(HEAD, 1):
            c = ws.cell(row=1, column=j, value=h)
            c.font = Font(name=FONT, bold=True, color="FFFFFF")
            c.fill = head_fill
            c.alignment = Alignment(vertical="center", wrap_text=True)
        r = 2
        for f in data["files"]:
            if not pick(f["src"]):
                continue
            old = lit.get(f["src"], {})
            for g in f["groups"]:
                for en, zh in g["rows"]:
                    was = old.get(en, "")
                    vals = [f["src"], g["label"], en, zh, was, "✓" if was and was != zh else "", ""]
                    for j, v in enumerate(vals, 1):
                        c = ws.cell(row=r, column=j, value=v)
                        c.font = Font(name=FONT, size=10, color="777777" if j in (1, 2, 5) else "000000")
                        c.alignment = Alignment(wrap_text=j in (3, 4, 5, 7), vertical="top")
                        c.border = Border(bottom=thin)
                    ws.cell(row=r, column=4).fill = edit_fill
                    r += 1
        counts[title] = r - 2
        for j, w in enumerate(WIDTH, 1):
            ws.column_dimensions[get_column_letter(j)].width = w
        ws.freeze_panes = "C2"
        ws.auto_filter.ref = "A1:" + get_column_letter(len(HEAD)) + str(max(2, r - 1))
    wb.save(out_path)
    print("wrote", out_path, counts)


def read_table(src):
    path = os.path.join(ZH_DIR, src + ".yml")
    return path, open(path, encoding="utf-8").read()


def do_import(xlsx):
    wb = load_workbook(xlsx, data_only=True)
    edits, notes, bad = {}, [], []
    for title, _ in SHEETS:
        if title not in wb.sheetnames:
            continue
        ws = wb[title]
        head = [c.value for c in ws[1]]
        ix = {h: i for i, h in enumerate(head)}
        for row in ws.iter_rows(min_row=2, values_only=True):
            src, en, zh = row[ix["表 Table"]], row[ix["English"]], row[ix["中文（在此修改）"]]
            note = row[ix["备注 Notes for Claude"]] if "备注 Notes for Claude" in ix else None
            if not src or en is None:
                continue
            if isinstance(zh, float) and zh.is_integer():
                zh = int(zh)  # Excel turns a typed "2" into a number
            zh = "" if zh is None else str(zh)
            edits[(src, en)] = zh
            if note:
                notes.append((src, en, zh, str(note)))
    # Shared English: the last edit that differs from the current text wins everywhere.
    current, files = {}, {}
    for dirpath, _, names in os.walk(ZH_DIR):
        for n in names:
            if n.endswith(".yml") and n != "_stale.yml":
                p = os.path.join(dirpath, n)
                src = os.path.relpath(p, ZH_DIR)[:-4]
                text = open(p, encoding="utf-8").read()
                files[src] = (p, text)
                for m in PAIR.finditer(text):
                    current[(src, json.loads(m.group(1)))] = json.loads(m.group(2))
    by_en = {}
    for (src, en), zh in edits.items():
        if (src, en) not in current:
            bad.append((src, en))
            continue
        if zh != current[(src, en)]:
            by_en[en] = zh
    changed = 0
    for src, (p, text) in files.items():
        def rep(m):
            nonlocal changed
            en = json.loads(m.group(1))
            if en in by_en and json.loads(m.group(2)) != by_en[en]:
                changed += 1
                return "- en: " + m.group(1) + "\n  zh: " + json.dumps(by_en[en], ensure_ascii=False)
            return m.group(0)
        new = PAIR.sub(rep, text)
        if new != text:
            open(p, "w", encoding="utf-8").write(new)
    print("edited lines:", len(by_en), "| table rows updated:", changed, "| rows not found (English changed since export?):", len(bad))
    for src, en in bad[:20]:
        print("  not found:", src, "|", en[:70])
    if notes:
        print("notes for Claude:")
        for src, en, zh, note in notes:
            print("  [" + src + "]", en[:60], "→", zh[:40], "| note:", note)


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "export":
        ref = sys.argv[sys.argv.index("--literal") + 1] if "--literal" in sys.argv else "zh-literal-pass"
        export(sys.argv[2], sys.argv[3], ref)
    elif len(sys.argv) == 3 and sys.argv[1] == "import":
        do_import(sys.argv[2])
    else:
        print(__doc__)
        sys.exit(1)
