---
layout: page
permalink: /phd-simulator/
title: PhD Simulator
description: Five years, give or take. A game about doing a PhD in NLP and HCI, built from real stories.
nav: false
og_image: https://www.bingshengyao.com/assets/phd-sim/og.jpg
# Added to a phone's Home Screen, the game opens as an app, full screen (ui/app.js initFull).
app_manifest: /assets/phd-sim/manifest.webmanifest
app_title: PhD Sim
app_icon: /assets/phd-sim/apple-touch-icon.png
app_color: "#283454"
---

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&display=swap">
<link rel="stylesheet" href="{{ '/assets/css/phd-sim.css' | relative_url }}">

<div id="phd-sim" data-src="{{ '/assets/phd-sim/data.json' | relative_url }}" data-board="{{ site.phd_sim_board }}">
  <noscript>The PhD Simulator needs JavaScript to run.</noscript>
  <p>Loading the PhD Simulator…</p>
</div>

<script type="module" src="{{ '/assets/js/phd-sim/main.js' | relative_url }}"></script>
