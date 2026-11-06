// Has to be in the head tag, otherwise a flicker effect will occur.
//
// The page follows the system's light or dark setting until the reader uses
// the toggle. That choice is kept under "theme-choice". "theme" itself only
// mirrors the theme on screen (common.js and giscus.html read it); it used to
// decide the start-up theme too, and it holds "dark" for every earlier visitor
// because the old default was dark, so it is no longer trusted for that.
const THEME_CHOICE = "theme-choice";

let systemTheme = () =>
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

let toggleTheme = () => {
  let current = document.documentElement.getAttribute("data-theme") || systemTheme();
  let next = current == "dark" ? "light" : "dark";

  // Choosing what the system already shows hands control back to the system.
  if (next == systemTheme()) {
    localStorage.removeItem(THEME_CHOICE);
  } else {
    localStorage.setItem(THEME_CHOICE, next);
  }
  setTheme(next);
};

let setTheme = (theme) => {
  transTheme();
  setHighlight(theme);
  setGiscusTheme(theme);

  if (theme) {
    document.documentElement.setAttribute("data-theme", theme);

    // Add class to tables.
    let tables = document.getElementsByTagName("table");
    for (let i = 0; i < tables.length; i++) {
      if (theme == "dark") {
        tables[i].classList.add("table-dark");
      } else {
        tables[i].classList.remove("table-dark");
      }
    }

    // Set jupyter notebooks themes.
    let jupyterNotebooks = document.getElementsByClassName("jupyter-notebook-iframe-container");
    for (let i = 0; i < jupyterNotebooks.length; i++) {
      let bodyElement = jupyterNotebooks[i].getElementsByTagName("iframe")[0].contentWindow.document.body;
      if (theme == "dark") {
        bodyElement.setAttribute("data-jp-theme-light", "false");
        bodyElement.setAttribute("data-jp-theme-name", "JupyterLab Dark");
      } else {
        bodyElement.setAttribute("data-jp-theme-light", "true");
        bodyElement.setAttribute("data-jp-theme-name", "JupyterLab Light");
      }
    }

  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  localStorage.setItem("theme", theme); // mirror only; see the note at the top

  // Updates the background of medium-zoom overlay.
  if (typeof medium_zoom !== "undefined") {
    medium_zoom.update({
      background:
        getComputedStyle(document.documentElement).getPropertyValue(
          "--global-bg-color"
        ) + "ee", // + 'ee' for trasparency.
    });
  }
};

let setHighlight = (theme) => {
  if (theme == "dark") {
    document.getElementById("highlight_theme_light").media = "none";
    document.getElementById("highlight_theme_dark").media = "";
  } else {
    document.getElementById("highlight_theme_dark").media = "none";
    document.getElementById("highlight_theme_light").media = "";
  }
};

let setGiscusTheme = (theme) => {
  function sendMessage(message) {
    const iframe = document.querySelector("iframe.giscus-frame");
    if (!iframe) return;
    iframe.contentWindow.postMessage({ giscus: message }, "https://giscus.app");
  }

  sendMessage({
    setConfig: {
      theme: theme,
    },
  });
};

let transTheme = () => {
  document.documentElement.classList.add("transition");
  window.setTimeout(() => {
    document.documentElement.classList.remove("transition");
  }, 500);
};

let initTheme = () => {
  let choice = localStorage.getItem(THEME_CHOICE);
  setTheme(choice == "dark" || choice == "light" ? choice : systemTheme());

  // Until the reader chooses, follow the system when it switches (for example
  // at sunset on an automatic schedule).
  let query = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
  if (query && query.addEventListener) {
    query.addEventListener("change", () => {
      if (!localStorage.getItem(THEME_CHOICE)) setTheme(systemTheme());
    });
  }
};

initTheme();
