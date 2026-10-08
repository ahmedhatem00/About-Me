/* ==========================================================================
   Helpers
   ========================================================================== */
const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
const root = document.documentElement;
const live = root.classList.contains("js");
const EMAIL = "kahmdhatm@gmail.com";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isMouse = (e) => e.pointerType === "mouse";

/* Horizontal swipe detector for touch screens. Uses plain touch events and never blocks scrolling:
   vertical drags keep scrolling the page; only a clearly horizontal flick calls back (dir = 1 next, -1 previous).
   Swipes that start inside `ignore` (rows that scroll sideways on their own) are left alone. */
function onSwipe(el, cb, ignore) {
  if (!el) return;
  let sx = 0, sy = 0, t0 = 0, track = false;
  el.addEventListener("touchstart", (e) => {
    track = e.touches.length === 1 && !(ignore && e.target.closest(ignore));
    if (!track) return;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    t0 = e.timeStamp;
  }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (!track) return;
    track = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.4 && e.timeStamp - t0 < 900) cb(dx < 0 ? 1 : -1);
  }, { passive: true });
  el.addEventListener("touchcancel", () => (track = false), { passive: true });
}

/* Scroll a sideways-scrolling row so the chosen button sits in the middle (never moves the page itself). */
function centerIn(row, btn) {
  const r = btn.getBoundingClientRect(), s = row.getBoundingClientRect();
  row.scrollBy({ left: r.left - s.left - (s.width - r.width) / 2, behavior: "smooth" });
}

/* Tell boot.js that the module started, so its failsafe stays quiet. */
window.__booted = true;

/* ==========================================================================
   Toast and copy-to-clipboard
   ========================================================================== */
let toastTimer;
function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), 1800);
}

async function copyEmail() {
  let ok = false;
  try {
    await navigator.clipboard.writeText(EMAIL);
    ok = true;
  } catch {
    /* Clipboard API missing (plain http) or denied: fall back to a hidden textarea. */
    const ta = document.createElement("textarea");
    ta.value = EMAIL;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;inset-block-start:0;opacity:0;font-size:16px";
    document.body.append(ta);
    ta.select();
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
  }
  toast(ok ? "Email copied" : "Copy failed: " + EMAIL);
  return ok;
}

/* Copy buttons confirm in place, so the feedback is next to the thing you clicked. */
$$("[data-copy]").forEach((btn) => {
  const label = btn.textContent;
  let timer;
  btn.addEventListener("click", async () => {
    btn.style.minInlineSize = btn.offsetWidth + "px"; /* no layout shift when the label changes */
    const ok = await copyEmail();
    btn.classList.toggle("done", ok);
    btn.textContent = ok ? "Copied" : "Copy failed";
    clearTimeout(timer);
    timer = setTimeout(() => {
      btn.textContent = label;
      btn.classList.remove("done");
    }, 1600);
  });
});

/* ==========================================================================
   Email links: open the default mail app; if none reacts, copy the address instead
   ========================================================================== */
/* If no mail app seems to react, copy the address so the click is never a dead end. */
function mailFallback() {
  copyEmail().then((ok) => ok && toast("No mail app opened. Email copied: " + EMAIL));
}
$$('a[href^="mailto:"]').forEach((link) => {
  link.addEventListener("click", () => {
    /* The browser follows the mailto: link itself. If a mail app takes over, the page
       loses focus or gets hidden; if that never happens, no mail app is set up. */
    let handled = false;
    const mark = () => (handled = true);
    addEventListener("blur", mark, { once: true });
    document.addEventListener("visibilitychange", mark, { once: true });
    setTimeout(() => {
      removeEventListener("blur", mark);
      document.removeEventListener("visibilitychange", mark);
      if (!handled) mailFallback();
    }, 1500);
  });
});

/* ==========================================================================
   Skill tabs: click, arrow keys, or hover with a mouse (short intent delay)
   ========================================================================== */
const tabs = $$("[role=tab][aria-controls^=p]");
let tabNow = -1;
function showTab(tab, focus = false) {
  const idx = tabs.indexOf(tab);
  const dir = tabNow < 0 || idx === tabNow ? "" : idx > tabNow ? "next" : "prev";
  tabNow = idx;
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute("aria-selected", on);
    t.tabIndex = on ? 0 : -1;
    const panel = $("#" + t.getAttribute("aria-controls"));
    panel.hidden = !on;
    if (on) panel.dataset.dir = dir;
  });
  if (focus) tab.focus();
}
let tabTimer;
tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => showTab(tab));
  tab.addEventListener("pointerenter", (e) => {
    if (!isMouse(e)) return;
    clearTimeout(tabTimer);
    tabTimer = setTimeout(() => showTab(tab), 90);
  });
  tab.addEventListener("pointerleave", () => clearTimeout(tabTimer));
  tab.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    showTab(tabs[(i + step + tabs.length) % tabs.length], true);
  });
});
if (tabs.length) showTab(tabs[0]);

/* Swipe the Capabilities card left or right to move between the skill groups. */
onSwipe($("#skillswipe"), (dir) => {
  const next = tabs[tabNow + dir];
  if (!next) return;
  showTab(next);
  centerIn(next.parentElement, next);
}, ".tabs");

/* ==========================================================================
   Project switcher (Work): hover with intent delay, focus, click, arrow keys
   ========================================================================== */
const deck = $("#deck");
const panels = deck ? $$("article", deck) : [];
let pick = () => {};

if (live && deck) {
  const sel = document.createElement("div");
  sel.className = "sel";
  sel.setAttribute("role", "tablist");
  sel.setAttribute("aria-label", "Projects");

  const btns = panels.map((panel, i) => {
    const btn = document.createElement("button");
    const num = document.createElement("b");
    const name = document.createElement("span");
    const kind = document.createElement("small");

    num.textContent = String(i + 1).padStart(2, "0");
    name.textContent = $("h3", panel).firstChild.textContent.trim();
    kind.textContent = $("h3 em", panel).textContent;
    name.append(kind);

    /* The button borrows its project's accent class so both share one colour. */
    const accent = [...panel.classList].find((c) => c.startsWith("win--"));
    if (accent) btn.classList.add(accent);

    panel.id = "proj-" + (i + 1);
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-controls", panel.id);
    btn.append(num, name);
    panel.setAttribute("role", "tabpanel");
    sel.append(btn);
    return btn;
  });
  deck.prepend(sel);

  let current = -1;
  let hoverTimer;
  pick = (i) => {
    if (i === current) return;
    const dir = current < 0 || i > current ? "next" : "prev";
    current = i;
    btns.forEach((b, k) => {
      b.setAttribute("aria-selected", k === i);
      b.tabIndex = k === i ? 0 : -1;
    });
    panels.forEach((p, k) => {
      p.classList.toggle("act", k === i);
      if (k === i) p.dataset.dir = dir;
    });
  };

  btns.forEach((btn, i) => {
    btn.addEventListener("click", () => pick(i));
    btn.addEventListener("focus", () => pick(i));
    btn.addEventListener("pointerenter", (e) => {
      if (!isMouse(e)) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => pick(i), 70);
    });
    btn.addEventListener("pointerleave", () => clearTimeout(hoverTimer));
    btn.addEventListener("keydown", (e) => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      btns[(i + step + btns.length) % btns.length].focus();
    });
  });
  pick(0);

  /* Swipe the project card left or right to move between projects. */
  onSwipe(deck, (dir) => {
    const next = current + dir;
    if (next < 0 || next >= btns.length) return;
    pick(next);
    centerIn(sel, btns[next]);
  }, ".sel");
}

/* ==========================================================================
   Scroll: header progress bar, hero parallax, current section
   ========================================================================== */
const progressBar = $("#pb");
const heroWin = $(".hero .win");
const navLinks = $$(".nv a");
const rail = $("#rail");
const railLinks = $$("#rail a");
const railIds = railLinks.map((a) => a.hash.slice(1));
const sections = $$("main section[id]");
let currentId = "";

/* The current section is the last one whose top has passed 40% of the viewport.
   At the very bottom the last section wins, because a short final section
   (Contact) may never reach that line. */
function updateCurrent() {
  const probe = innerHeight * 0.4;
  let id = sections[0].id;
  sections.forEach((s) => {
    if (s.getBoundingClientRect().top <= probe) id = s.id;
  });
  if (innerHeight + scrollY >= root.scrollHeight - 4) id = sections[sections.length - 1].id;
  if (id === currentId) return;
  currentId = id;

  const mark = (a) =>
    a.hash === "#" + id ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current");
  navLinks.forEach(mark);
  railLinks.forEach(mark);

  const idx = railIds.indexOf(id);
  rail.classList.toggle("show", idx >= 0);
  if (idx >= 0) rail.style.setProperty("--rp", idx / (railIds.length - 1));
}

function frame() {
  const max = root.scrollHeight - innerHeight;
  progressBar.style.setProperty("--p", max > 0 ? Math.min(1, scrollY / max) : 0);
  heroWin.style.setProperty("--hp", Math.min(1, scrollY / innerHeight));
  updateCurrent();
}

let ticking = false;
function schedule() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    frame();
    ticking = false;
  });
}
addEventListener("scroll", schedule, { passive: true });
addEventListener("resize", schedule, { passive: true });
frame();

/* ==========================================================================
   More work: filter by kind
   ========================================================================== */
const filters = $$(".flt button");
const cards = $$(".proj");
filters.forEach((btn) =>
  btn.addEventListener("click", () => {
    filters.forEach((x) => x.classList.toggle("on", x === btn));
    cards.forEach((c) => {
      c.hidden = !(btn.dataset.f === "all" || c.dataset.cat === btn.dataset.f);
    });
  })
);

/* ==========================================================================
   Pointer glow on windows and project cards (a soft light, not movement)
   ========================================================================== */
addEventListener(
  "pointermove",
  (e) => {
    if (!isMouse(e)) return;
    const w = e.target.closest?.(".win,.proj");
    if (!w) return;
    const r = w.getBoundingClientRect();
    w.style.setProperty("--gx", e.clientX - r.left + "px");
    w.style.setProperty("--gy", e.clientY - r.top + "px");
  },
  { passive: true }
);

/* ==========================================================================
   Reveal on scroll and animated counters
   ========================================================================== */
/* Each block enters from the side that fits its content. */
$$("main h2").forEach((h) => {
  h.classList.add("rv");
  h.dataset.rv = "left";
});
const CATEGORY_DIRECTION = { flutter: "right", bots: "left", tools: "up", web: "scale" };
$$(".proj").forEach((card) => {
  card.dataset.rv = CATEGORY_DIRECTION[card.dataset.cat] || "up";
});
if (deck) deck.dataset.rv = "fade";

const setReveal = (selector, value) => {
  const el = $(selector);
  if (el) el.dataset.rv = value;
};
setReveal("#skills .win", "scale");
setReveal("#contact .win", "up");
setReveal(".stick", "right");
setReveal(".pipe", "up");
$$(".tl li").forEach((li) => (li.dataset.rv = "left"));

/* Stagger index for the pipeline steps. */
$$(".pipe li").forEach((li, i) => li.style.setProperty("--i", i));
/* Small stagger for siblings that reveal together. */
$$(".rv").forEach((el, i) => el.style.setProperty("--st", i % 4));

const revealObserver = new IntersectionObserver(
  (entries) =>
    entries.forEach((entry) => {
      const el = entry.target;
      if (entry.intersectionRatio >= 0.08) {
        el.classList.add("in");
      } else if (!entry.isIntersecting && el.classList.contains("in")) {
        el.classList.remove("in");
      }
    }),
  { threshold: [0, 0.08] }
);
$$(".rv").forEach((el) => revealObserver.observe(el));

const counterObserver = new IntersectionObserver((entries) =>
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    counterObserver.unobserve(el);
    const target = +el.dataset.n;
    const suffix = el.dataset.s || "";
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / 1400);
      const value = Math.round(target * (1 - Math.pow(1 - k, 3)));
      el.textContent = value.toLocaleString("en-US") + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  })
);
if (live) $$(".stats [data-n]").forEach((el) => counterObserver.observe(el));

/* ==========================================================================
   Interactive terminal
   ========================================================================== */
/* Arabic text normalisation for the demo search: strips diacritics and tatweel,
   folds alef, teh marbuta, alef maksura and hamza variants into one form. */
const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .trim();

/* Levenshtein edit distance, used to tolerate one typo per word. */
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/* Sample catalogue for the search demo. The words are Arabic on purpose: the
   command shows how Arabic spelling variants still match each other. */
const CATALOGUE = [
  "حقيبة ظهر مدرسية", /* school backpack  */
  "ساعة ذكية",       /* smart watch      */
  "سماعة بلوتوث",    /* bluetooth headset */
  "شاحن سريع",       /* fast charger     */
  "هاتف أندرويد",    /* android phone    */
  "مكتب مدرسي",      /* school desk      */
  "كاميرا مراقبة",   /* security camera  */
  "حذاء رياضي",      /* sports shoes     */
];

const out = $("#tout");
const input = $("#tin");
const PROJECT_NAMES = ["sarh", "storefront", "mudabbir", "chat"];

function say(text, kind = "") {
  const line = document.createElement("div");
  line.className = "ln " + kind;
  line.textContent = text;
  out.append(line);
  out.scrollTop = out.scrollHeight;
}

const COMMANDS = {
  help: () =>
    say("whoami  projects  open <sarh|storefront|mudabbir|chat>\nskills  roles  contact  copy  search <arabic word>  clear"),
  whoami: () =>
    say("Ahmed Hatem, Front-End Engineer from Egypt. Also Flutter, full-stack, real-time systems and IT support."),
  projects: () =>
    say("1 sarh        Arabic services marketplace\n2 storefront  client shop + Flutter admin app\n3 mudabbir    finance app + licensing backend\n4 chat        encrypted real-time messenger"),
  skills: () => say("Front end: HTML5, CSS3, JS modules, PWA, accessibility\nAlso: Flutter, Python, Node.js, PostgreSQL, Docker"),
  roles: () =>
    say("Front-End Engineer (primary), Flutter Developer, Full-Stack Builder,\nReal-Time & Bot Developer, IT Support Technician, Community Founder"),
  contact: () => say(EMAIL + "  (type copy to copy it)"),
  copy: async () => say((await copyEmail()) ? "copied" : "copy failed"),
  clear: () => {
    out.textContent = "";
  },
  open: (arg) => {
    const i = PROJECT_NAMES.indexOf((arg || "").toLowerCase());
    if (i < 0) return say("usage: open sarh | storefront | mudabbir | chat", "e");
    pick(i);
    $("#work").scrollIntoView({ behavior: "smooth" });
    say("opening " + PROJECT_NAMES[i] + "...");
  },
  search: (arg) => {
    const query = normalize(arg || "");
    if (!query) return say("usage: search <arabic word>, for example: search حقيبه مدرسيه", "e");
    const words = query.split(/\s+/);
    const hits = CATALOGUE.filter((item) => {
      const itemWords = normalize(item).split(/\s+/);
      return words.every((q) => itemWords.some((w) => w.includes(q) || (q.length > 3 && editDistance(w, q) <= 1)));
    });
    say("normalized: " + query + "\nmatches: " + (hits.length ? hits.join(" | ") : "none"));
  },
};

if (input) {
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const value = input.value.trim();
    input.value = "";
    if (!value) return;
    say(value, "u");
    const [cmd, ...args] = value.split(/\s+/);
    const run = COMMANDS[cmd.toLowerCase()];
    run ? run(args.join(" ")) : say("command not found: " + cmd + ". Try help.", "e");
  });

  /* Press "/" anywhere to jump to the prompt. */
  addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      e.preventDefault();
      input.focus();
    }
  });
}

/* ==========================================================================
   Intro: the prompt tilts, winks and types "Hello World", then flies to the corner
   ========================================================================== */
const ROLES = [
  "Front-End Engineer",
  "Flutter Developer",
  "Full-Stack Builder",
  "Real-Time & Bot Developer",
  "IT Support Technician",
  "Community Founder",
];

async function typeRoles() {
  const el = $("#role");
  for (let i = 0; ; i = (i + 1) % ROLES.length) {
    const role = ROLES[i];
    for (let k = 1; k <= role.length; k++) {
      el.textContent = role.slice(0, k);
      await wait(65);
    }
    await wait(i ? 1500 : 2300);
    for (let k = role.length; k >= 0; k--) {
      el.textContent = role.slice(0, k);
      await wait(30);
    }
    await wait(250);
  }
}

/* Type text into an element one character at a time, and erase it again. */
async function typeInto(el, text, delay) {
  for (let k = 1; k <= text.length; k++) {
    el.textContent = text.slice(0, k);
    await wait(delay);
  }
}
async function eraseFrom(el, delay) {
  for (let k = el.textContent.length; k >= 0; k--) {
    el.textContent = el.textContent.slice(0, k);
    await wait(delay);
  }
}

async function runIntro() {
  /* Split the name into letters for the drop-in animation. */
  const h1 = $("#name");
  const name = h1.textContent;
  h1.setAttribute("aria-label", name);
  h1.textContent = "";
  [...name].forEach((ch, i) => {
    const span = document.createElement("span");
    span.className = "l";
    span.setAttribute("aria-hidden", "true");
    span.textContent = ch === " " ? "\u00a0" : ch;
    span.style.setProperty("--i", i);
    h1.append(span);
  });
  $$(".t p").forEach((p, i) => p.style.setProperty("--d", i));

  /* Wait for the web fonts (stylesheet first, then the glyphs themselves), each with a cap,
     so the whole intro is played on the real typeface and none of it happens unseen. */
  await Promise.race([window.__fonts, wait(1200)]);
  await Promise.race([document.fonts ? document.fonts.ready : 0, wait(600)]);

  /* Lay the intro out as one group (prompt + greeting), centred horizontally and a little above
     the vertical middle. Everything is measured, so it stays exact on any screen:
     - the prompt's untransformed box tells us how far it must move,
     - the full greeting is measured once so the group does not shift while it types. */
  const mark = $(".mark");
  const typed = $("#itype");
  const rem = parseFloat(getComputedStyle(root).fontSize);
  const W = root.clientWidth;
  const H = root.clientHeight;

  mark.style.transition = "none";
  mark.style.transform = "none";
  const box = mark.getBoundingClientRect();
  /* Size the prompt from the greeting: its glyphs end up about 2.2x the text size, so the two
     read as one balanced pair on every screen (the text size itself is fluid in CSS). */
  const textPx = parseFloat(getComputedStyle(typed).fontSize);
  const scale = (textPx * 2.2) / (1.3 * rem); /* 1.3rem is the prompt's normal font size */
  root.style.setProperty("--is", scale.toFixed(3));
  const markW = ($(".ch").offsetWidth + $(".us").offsetWidth) * scale;
  const markH = 1.3 * rem * 1.2 * scale;
  typed.textContent = "Hello World";
  const textW = typed.getBoundingClientRect().width + 0.6 * rem; /* + blinking cursor */
  typed.textContent = "";

  const gap = 0.9 * textPx;
  const stack = markW + gap + textW + 2 * rem > W; /* too wide to sit side by side */
  let markX, markY, textX, textY;
  if (stack) {
    markX = W / 2;
    markY = H * 0.4 - markH / 4;
    textY = markY + markH / 2 + 0.9 * textPx;
  } else {
    const left = (W - (markW + gap + textW)) / 2;
    markX = left + markW / 2;
    markY = H * 0.42;
    textX = left + markW + gap;
    textY = markY;
  }
  root.classList.toggle("stack", stack);
  root.style.setProperty("--ix", markX - (box.left + box.width / 2) + "px");
  root.style.setProperty("--iy", markY - (box.top + box.height / 2) + "px");
  root.style.setProperty("--ity", textY + "px");
  if (!stack) root.style.setProperty("--itx", textX + "px");
  mark.style.transform = "";
  void mark.offsetWidth; /* apply the new position instantly, without a visible slide */
  mark.style.transition = "";

  /* The intro always plays in full: no skipping, no reduced-motion shortcut. */
  root.classList.add("run"); /* prompt pops in at the centre */
  await wait(450);
  root.classList.add("tilt"); /* head leans */
  await wait(350);
  root.classList.add("winking"); /* eye closes and stays closed... */
  await typeInto(typed, "Hello World", 28); /* ...while the greeting is typed beside it... */
  await wait(450);
  await eraseFrom(typed, 16); /* ...and erased, still winking */
  root.classList.remove("winking");
  root.classList.add("glow"); /* eye opens with a glow */
  await wait(250);
  root.classList.remove("tilt"); /* straighten up */
  await wait(400);

  root.classList.remove("intro-on"); /* fly to the corner */
  await wait(1200);
  $(".intro")?.remove();
  root.classList.add("go");
  typeRoles();
}

if (live) runIntro();

/* ==========================================================================
   Real transfer size from the Performance API; stays hidden if unavailable
   ========================================================================== */
addEventListener("load", () =>
  setTimeout(() => {
    try {
      const nav = performance.getEntriesByType("navigation")[0];
      if (!nav) return;
      const bytes = [nav, ...performance.getEntriesByType("resource").filter((r) => r.name.startsWith(location.origin))].reduce(
        (sum, r) => sum + (r.transferSize || 0),
        0
      );
      if (!bytes) return;
      const el = $("#perf");
      el.textContent = `Document and local assets: ${(bytes / 1024).toFixed(1)} KB transferred`;
      el.hidden = false;
    } catch {
      /* Performance API unavailable: leave the line hidden. */
    }
  }, 0)
);
