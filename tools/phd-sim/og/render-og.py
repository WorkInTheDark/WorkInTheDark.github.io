#!/usr/bin/env python3
"""Renders tools/phd-sim/og/og.html (1200x630) with headless Chrome and saves the game page's link
preview as assets/phd-sim/og.jpg.   python3 tools/phd-sim/og/render-og.py"""
import os, subprocess, sys, tempfile
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, "..", "..", ".."))
chrome = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
out = os.path.join(root, "assets", "phd-sim", "og.jpg")

with tempfile.TemporaryDirectory() as tmp:
    png = os.path.join(tmp, "og.png")
    subprocess.run([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    "--window-size=1200,630", "--virtual-time-budget=8000", "--allow-file-access-from-files",
                    "--screenshot=" + png, "file://" + os.path.join(here, "og.html")],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    img = Image.open(png).convert("RGB")
    if img.size != (1200, 630):
        img = img.crop((0, 0, 1200, 630))
    img.save(out, "JPEG", quality=86, optimize=True, progressive=True)
print("wrote", os.path.relpath(out, root), os.path.getsize(out) // 1024, "KB")
