---
layout: page
permalink: /phd-simulator/
title: PhD Simulator
description: Five years, give or take. A game about doing a PhD in NLP and HCI, built from real stories.
nav: true
nav_order: 5
og_image: https://www.bingshengyao.com/assets/phd-sim/og.jpg
---

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&display=swap">
<link rel="stylesheet" href="{{ '/assets/css/phd-sim.css' | relative_url }}">

<div id="phd-sim" data-src="{{ '/assets/phd-sim/data.json' | relative_url }}">
  <noscript>The PhD Simulator needs JavaScript to run.</noscript>
  <p>Loading the PhD Simulator…</p>
</div>

<script type="module" src="{{ '/assets/js/phd-sim/main.js' | relative_url }}"></script>
