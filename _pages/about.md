---
layout: about
title: About
permalink: /
subtitle: Associate Research Scientist at Northeastern University


profile:
  align: right
  image: profile-square.jpeg
  image_circular: false # crops the image to make it circular
  address: >
    

news: true  # includes a list of news items
latest_posts: false  # includes a list of the newest posts
selected_papers: false # includes a list of papers marked as "selected={true}"
social: false  # includes social icons at the bottom of the page

recruiting:
  enabled: true
  label: Recruiting
  body: >
    We are actively seeking self-motivated research assistants. If you are interested in working
    with me, please email me with a description of your skills, research interests, and attach your CV.

second_content: |
  
---

I am an **associate research scientist** in the Khoury College of Computer Sciences at Northeastern University (PI: Prof. [Dakuo Wang](https://www.dakuowang.com/)). I received my PhD from Rensselaer Polytechnic Institute, advised by Prof. [Jim Hendler](https://www.cs.rpi.edu/~hendler/).

I study **how LLM agents can genuinely collaborate with humans** through the lens of remote human collaboration. My research sits at the intersection of *Human-Computer Interaction* and *Natural Language Processing*, with a focus on **designing** the interaction patterns and methodologies for effective human-agent collaboration in practice, and on **developing** and **evaluating** LLM agents that can think and behave collaboratively.


## Research


#### *I. Design and Study Human-Centered AI Systems for Clinical Care*
I design, deploy, and study AI/LLM-powered multi-modal systems that work alongside provider teams, patients, and caregivers — in settings where existing workflows break down. My work spans clinical decision-making, patient-provider communication, remote patient monitoring, and post-surgical care.

<div class="filter-bar" data-filter-target="thrust-clinical">
  <button type="button" class="filter-btn is-active" data-filter="all">All</button>
  <button type="button" class="filter-btn" data-filter="rpm">Remote Patient Monitoring</button>
  <button type="button" class="filter-btn" data-filter="postop">Post-Surgical Care</button>
  <button type="button" class="filter-btn" data-filter="decision">Clinical Decision Making</button>
  <button type="button" class="filter-btn" data-filter="comm">Patient-Provider Communication</button>
  <button type="button" class="filter-btn" data-filter="coord">Provider Coordination</button>
</div>

<ul id="thrust-clinical" class="thrust-list">
  <li data-tags="rpm postop"><a href="https://arxiv.org/abs/2502.05740">RECOVER </a> <em>(CSCW '26)</em> — <span class="thrust-desc">LLM-based remote patient monitoring for post-surgical GI cancer care</span></li>
  <li data-tags="decision comm"><a href="https://dl.acm.org/doi/full/10.1145/3772318.3791301">Serious Illness Conversations</a> <em>(CHI '26)</em> — <span class="thrust-desc">Balancing efficiency and empathy in serious-illness conversations in the ED</span></li>
  <li data-tags="comm coord postop"><a href="https://dl.acm.org/doi/full/10.1145/3772318.3791960">Collaboration Breakdown</a> <em>(CHI '26)</em> — <span class="thrust-desc">Within provider teams and between patients in post-surgery care</span></li>
  <li data-tags="rpm postop"><a href="https://dl.acm.org/doi/full/10.1145/3706598.3714272">CardioAI</a> <em>(CHI '25)</em> — <span class="thrust-desc">Multimodal AI plus wearable for cancer treatment-induced cardiotoxicity</span></li>
  <li data-tags="comm"><a href="https://dl.acm.org/doi/10.1145/3659625">Talk2Care</a> <em>(IMWUT '24)</em> — <span class="thrust-desc">Asynchronous communication between older-adults and care providers</span></li>
  <li data-tags="decision"><a href="https://dl.acm.org/doi/full/10.1145/3613904.3642343">Sepsis Diagnosis Support</a> <em>(CHI '24)</em> — <span class="thrust-desc">AI-assisted clinical decision making for sepsis diagnosis</span></li>
</ul>

#### *II. Develop and Evaluate Collaborative LLM Agents*
I envision a near future where LLM agents work *with* us, not for us — analogous as a remote human collaborator. Toward this vision, my research focuses on **developing and evaluating LLM agents' collaborativeness**: collecting large-scale behavioral and mental-model data from controlled human-collaboration experiments, benchmarking LLMs' performance through simulations, and proposing **process-level evaluation metrics** that quantify *how* agents collaborate. This line of work is grounded in HCI infrastructure for studying human-agent collaboration and in decades of remote-collaboration research on what makes teams trust each other, share context, and coordinate effectively.

<div class="filter-bar" data-filter-target="thrust-agents">
  <button type="button" class="filter-btn is-active" data-filter="all">All</button>
  <button type="button" class="filter-btn" data-filter="vision">Vision &amp; Framework</button>
  <button type="button" class="filter-btn" data-filter="evaluation">Evaluation &amp; Benchmarking</button>
  <button type="button" class="filter-btn" data-filter="capability">Agent Capability</button>
  <button type="button" class="filter-btn" data-filter="oversight">Agent Oversight</button>
  <button type="button" class="filter-btn" data-filter="roleplay">Role-Playing Agents</button>
</div>

<ul id="thrust-agents" class="thrust-list">
  <li data-tags="vision evaluation"><a href="https://dl.acm.org/doi/full/10.1145/3772318.3790879">Research Platform for Human-Agent Collaboration</a> <em>(CHI '26)</em> — <span class="thrust-desc">A configurable research platform for studying human-agent collaboration through the lens of remote teamwork</span></li>
  <li data-tags="oversight evaluation"><a href="https://dl.acm.org/doi/full/10.1145/3772318.3791568">Dark Patterns Meet GUI Agents</a> <em>(CHI '26)</em> — <span class="thrust-desc">Examining LLM agent susceptibility to manipulative interfaces and the role of human oversight</span></li>
  <li data-tags="vision"><a href="https://dl.acm.org/doi/full/10.1145/3772363.3778744">CHI '26 Workshop "Human-Agent Collaboration"</a> <em>(CHI EA '26)</em> — <span class="thrust-desc">A vision, design philosophy, and empirical framework for treating LLM agents as remote human collaborators</span></li>
  <li data-tags="evaluation capability"><a href="https://dl.acm.org/doi/full/10.1145/3772363.3799039">Agent A/B</a> <em>(CHI EA '26)</em> — <span class="thrust-desc">Automated and scalable A/B testing on live websites with interactive LLM agents</span></li>
  <li data-tags="capability roleplay"><a href="https://arxiv.org/abs/2510.14205">Dynamic Persona Refinement Framework</a> <em>(preprint, 2025)</em> — <span class="thrust-desc">Iteratively refining LLM personas during role-playing interactions</span></li>
  <li data-tags="evaluation roleplay"><a href="https://aclanthology.org/2025.findings-acl.938/">Survey of LLM Role-Playing Agent Evaluation</a> <em>(ACL Findings '25)</em> — <span class="thrust-desc">Guidelines for evaluating LLM role-playing agents</span></li>
</ul>

<!-- Appointment / Education sections intentionally hidden — they live on the CV. -->



### Note


Please refer to my [Google Scholar](https://scholar.google.com/citations?user=hJlsDfAAAAAJ) page for the most up-to-date publication record.

The best way to reach out is through emails: **b [dot] yao [at] northeastern [dot] edu**. 


***


<script>
(function () {
  // Filter handler for any .filter-bar that points at a .thrust-list via data-filter-target.
  // Buttons inside the bar carry data-filter; list items inside the target are shown only
  // if they contain a [data-tag="<filter>"] span (or always, when filter is "all").
  document.querySelectorAll('.filter-bar').forEach(function (bar) {
    var listId = bar.getAttribute('data-filter-target');
    var list = listId && document.getElementById(listId);
    if (!list) return;

    bar.addEventListener('click', function (ev) {
      var btn = ev.target.closest('.filter-btn');
      if (!btn || btn.classList.contains('is-active')) return;

      bar.querySelectorAll('.filter-btn').forEach(function (b) {
        b.classList.remove('is-active');
      });
      btn.classList.add('is-active');

      var filter = btn.getAttribute('data-filter');
      list.querySelectorAll('li').forEach(function (li) {
        // Match papers whose `data-tags="..."` (space-separated) contains the filter slug.
        var match = filter === 'all' || li.matches('[data-tags~="' + filter + '"]');
        li.style.display = match ? '' : 'none';
      });
    });
  });
})();
</script>



