/* Runs before first paint: mark the page as JS-enabled and start in the intro state. */
(function () {
  var root = document.documentElement;
  root.className = "js intro-on";

  /* Load the web fonts without blocking the first paint. A render-blocking font stylesheet
     (slow or filtered network) used to delay the page, so the intro was half over before
     anything could be seen. window.__fonts resolves when the stylesheet loads or fails. */
  var fonts = document.createElement("link");
  fonts.rel = "stylesheet";
  fonts.href =
    "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Instrument+Sans:wght@400;600&family=JetBrains+Mono:wght@400;500;700&display=swap";
  window.__fonts = new Promise(function (resolve) {
    fonts.onload = fonts.onerror = resolve;
  });
  document.head.appendChild(fonts);

  /* Failsafe: if main.js never starts (blocked, offline, syntax error),
     reveal the page instead of leaving the intro overlay on screen forever. */
  setTimeout(function () {
    if (!window.__booted) {
      root.classList.remove("intro-on");
      root.classList.add("go");
    }
  }, 8000);
})();
