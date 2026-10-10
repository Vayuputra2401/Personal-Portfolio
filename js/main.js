/* Page behaviour: nav, scroll progress, reveals, and the small interactive
   pieces (incident replay, recipe graph, route cost, work accordion,
   project filter, command menu, contact form). No framework. */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EMAIL = "pathikreetofficial@gmail.com";

  // ── toast ───────────────────────────────────────────────────────────────
  const toastEl = $(".toast");
  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 1800);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── nav + progress ─────────────────────────────────────────────────────
  const nav = $("#nav");
  const hero = $("#home");
  const bar = $(".progress span");
  function onScroll() {
    const y = window.scrollY;
    const past = y > hero.offsetHeight - 80;
    nav.classList.toggle("is-solid", past);
    nav.classList.toggle("is-ink", !past && y > 24);
    if (typeof ScrollTrigger === "undefined") {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Scroll-spy: highlight the section most in view.
  const links = $$(".nav-links a");
  const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.classList.remove("is-active"));
      byId.get(e.target.id)?.classList.add("is-active");
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  byId.forEach((_, id) => { const el = document.getElementById(id); if (el) spy.observe(el); });

  // ── motion: GSAP (ScrollTrigger + SplitText), IntersectionObserver fallback
  const hasGsap = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
  const release = () => document.documentElement.classList.remove("intro");

  if (!reduceMotion && hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    const canSplit = typeof SplitText !== "undefined";
    if (canSplit) gsap.registerPlugin(SplitText);
    const ease = "power3.out";

    // Lines rise out of a mask. Re-splits on resize so line breaks stay true.
    const riseLines = (el, vars) => {
      if (!canSplit) return gsap.from(el, { autoAlpha: 0, y: 24, duration: 0.9, ease, ...vars });
      SplitText.create(el, {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1, ease: "power4.out", stagger: 0.08, ...vars }),
      });
    };

    // Hero intro
    release();
    const intro = gsap.timeline({ defaults: { ease } });
    intro.from(".hero .kicker", { autoAlpha: 0, y: 10, duration: 0.6 });
    if (canSplit) {
      SplitText.create(".hero-title", {
        type: "chars,lines",
        mask: "lines",
        onSplit: (self) => intro.from(self.chars, { yPercent: 115, duration: 1.1, ease: "power4.out", stagger: 0.025 }, 0.1),
      });
    } else {
      intro.from(".hero-title", { autoAlpha: 0, y: 30, duration: 1 }, 0.1);
    }
    intro.from(".hero-model-ui", { autoAlpha: 0, y: 12, duration: 0.8 }, 1.4);
    intro.from(".hero-lede", { autoAlpha: 0, y: 16, duration: 0.8 }, 0.6)
      .from(".hero-actions > *", { autoAlpha: 0, y: 12, duration: 0.6, stagger: 0.08 }, 0.8)
      .from(".hero-hint", { autoAlpha: 0, duration: 1 }, 1.1);

    // The hero copy drifts up and fades as you leave it.
    gsap.to(".hero-inner", {
      yPercent: -12, autoAlpha: 0.15, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
    });

    // Facts: count up the leading number.
    $$(".fact-num").forEach((el) => {
      const m = el.textContent.match(/^(\D*)(\d+)(.*)$/);
      if (!m) return;
      const n = { v: 0 };
      gsap.to(n, {
        v: +m[2], duration: 1.4, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
        onUpdate: () => { el.textContent = m[1] + Math.round(n.v) + m[3]; },
      });
    });

    // Section titles and the contact headline.
    $$(".section-title, .contact-title").forEach((el) =>
      riseLines(el, { scrollTrigger: { trigger: el, start: "top 85%", once: true } }));

    // Kickers, rows and blocks: a short rise, staggered within each batch.
    ScrollTrigger.batch(".section-head .kicker, .venture-meta, .venture-body > *, .job, .paper, .project, .award, .roles li, .skillset > div, .about-photo, .about-text > p, .skills > div, .contact-sub, .contact-actions, .socials", {
      start: "top 88%",
      once: true,
      onEnter: (els) => gsap.from(els, { autoAlpha: 0, y: 28, duration: 0.9, ease, stagger: 0.08 }),
    });

    // Venture names slide on a slight horizontal parallax while their block scrolls.
    $$(".venture-name").forEach((el) => {
      gsap.fromTo(el, { xPercent: -4 }, {
        xPercent: 4, ease: "none",
        scrollTrigger: { trigger: el.closest(".venture"), start: "top bottom", end: "bottom top", scrub: true },
      });
    });

    // Akasha: the incident replays itself the first time it scrolls into view.
    const simRun = $("[data-sim-run]");
    if (simRun) ScrollTrigger.create({ trigger: "[data-sim]", start: "top 70%", once: true, onEnter: () => simRun.click() });

    // 3D figures turn with the scroll on top of their own orbit.
    $$("canvas[data-scene]").forEach((c) => {
      ScrollTrigger.create({
        trigger: c, start: "top bottom", end: "bottom top", scrub: 0.6,
        onUpdate: (self) => c.setScrollYaw?.((self.progress - 0.5) * Math.PI),
      });
    });

    // Web fonts change line heights after these triggers are measured.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    // Scroll progress hairline, scrubbed.
    gsap.to(".progress span", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });
  } else if (!reduceMotion && "IntersectionObserver" in window) {
    release();
    const targets = $$(".section-head, .venture, .job, .paper, .project, .award, .roles li, .skillset > div, .about-photo, .about-text, .fact, .contact .wrap > *");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    targets.forEach((el) => { el.classList.add("reveal"); io.observe(el); });
  } else {
    release();
  }

  // ── Akasha: incident replay ────────────────────────────────────────────
  const sim = $("[data-sim]");
  if (sim) {
    const steps = $$(".sim-steps li", sim);
    const clock = $("[data-sim-clock]", sim);
    const out = $("[data-sim-event]", sim);
    const runBtn = $("[data-sim-run]", sim);
    const SPEED = 4;
    const END = 17.8;
    const events = [
      { at: 0, json: { source: "cam-14", zone: "sector-4", transport: "rtsp", model: "yolo-trt" } },
      { at: 2.4, json: { type: "FIRE_DETECTED", schema: "v1", zone_id: "sector-4", confidence: 0.94, shift: "B", ts: "02:41:07" } },
      { at: 3.1, json: { entity: "zone/sector-4", supervisor: "R. Iyer", incidents_14d: 2, query_ms: 80 } },
      { at: 4.0, json: { agent: "fire_incident_response", trigger: "FIRE_DETECTED", status: "running" } },
      { at: 9.5, json: { report: "incident-0412.pdf", languages: ["en", "hi"], severity_trend: "rising" } },
      { at: 17.8, json: { whatsapp: "delivered", pdf: "filed", memory: "written", humans_involved: 0 } },
    ];
    let raf = 0;

    function show(t) {
      clock.textContent = `${t.toFixed(1).padStart(4, "0")} s`;
      steps.forEach((li) => li.classList.toggle("is-on", t >= parseFloat(li.dataset.at)));
      const current = events.filter((e) => t >= e.at).pop();
      if (current) out.textContent = JSON.stringify(current.json, null, 2);
    }

    runBtn.addEventListener("click", () => {
      cancelAnimationFrame(raf);
      runBtn.textContent = "Replaying…";
      runBtn.disabled = true;
      if (reduceMotion) {
        show(END);
        runBtn.textContent = "Run it again";
        runBtn.disabled = false;
        return;
      }
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(((now - start) / 1000) * SPEED, END);
        show(t);
        if (t < END) raf = requestAnimationFrame(tick);
        else { runBtn.textContent = "Run it again"; runBtn.disabled = false; }
      };
      raf = requestAnimationFrame(tick);
    });
  }

  // ── Chef.ai: recipe graph ──────────────────────────────────────────────
  const dag = $("[data-dag]");
  if (dag) {
    const detail = $("[data-dag-detail]", dag);
    const NODES = [
      "Ingredient analyst — takes what YOLO-Seg found in the photo and Gemini enriches it: freshness, family, what's about to expire.",
      "Cuisine matcher — decides which cuisines these ingredients actually suit, so a fridge of paneer and peas doesn't get pasta.",
      "Retrieval — 3072-dim embeddings searched with an HNSW index over a 7,300-recipe corpus in pgvector. Runs in parallel with 3b.",
      "Generation — Gemini writes fresh recipes for gaps the corpus can't cover. Runs in parallel with 3a.",
      "Ranker — an LLM ranks the merged candidates against your mode, skill and dietary rules.",
      "Validator — rejects anything that needs ingredients you don't have or breaks a constraint.",
      "Enhancer — adds drink pairings, freshness flags and the step-by-step guide ChefGPT cooks from.",
    ];
    const buttons = $$("button[data-node]", dag);
    const select = (i) => {
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.node === String(i))));
      detail.textContent = NODES[i];
    };
    buttons.forEach((b) => b.addEventListener("click", () => select(+b.dataset.node)));
    select(0);
  }

  // ── Artemis: live-trip deviation alerts (75 m / 300 m) ─────────────────
  const route = $("[data-route]");
  if (route) {
    const slider = $("[data-route-dev]", route);
    const out = $("[data-route-out]", route);
    const line = $(".route-line", route);
    const you = $("[data-you]", route);
    const tether = $("[data-tether]", route);
    const near = $('[data-band="75"]', route);
    const far = $('[data-band="300"]', route);
    const L = line.getTotalLength();
    const at = line.getPointAtLength(L * 0.55);
    const ahead = line.getPointAtLength(L * 0.55 + 1);
    // unit normal to the route at the marker
    let nx = -(ahead.y - at.y), ny = ahead.x - at.x;
    const n = Math.hypot(nx, ny) || 1;
    nx /= n; ny /= n;
    const PX_PER_M = 0.12; // 400 m ≈ 48 px on this map
    near.style.strokeWidth = String(75 * PX_PER_M * 2);
    far.style.strokeWidth = String(300 * PX_PER_M * 2);
    const update = () => {
      const m = +slider.value;
      const x = at.x + nx * m * PX_PER_M, y = at.y + ny * m * PX_PER_M;
      you.setAttribute("cx", x); you.setAttribute("cy", y);
      tether.setAttribute("x1", at.x); tether.setAttribute("y1", at.y);
      tether.setAttribute("x2", x); tether.setAttribute("y2", y);
      const state = m >= 300 ? "alert" : m >= 75 ? "warn" : "ok";
      route.dataset.state = state;
      out.textContent = `${m} m off route → ${state === "alert" ? "deviation alert to trusted contacts" : state === "warn" ? "check-in prompt" : "all quiet"}`;
    };
    slider.addEventListener("input", update);
    update();
  }

  // ── Aligned but Inert: causal control vs Dice ──────────────────────────
  const inert = $("[data-inert]");
  if (inert) {
    // From the paper's results table (label-flip control, Dice WT).
    const V = [
      { control: 0.001, dice: 0.927, note: "Natural: concepts align at 0.96, yet rerouting flips almost nothing. The decoder ignores the bottleneck." },
      { control: 0.011, dice: 0.925, note: "Gated: cut the leaks around the module and the optimiser routes around the cut. Still inert." },
      { control: 0.636, dice: 0.927, note: "Direct: routing becomes an additive term of the output. The model has to consult it — for about one Dice point." },
    ];
    const btns = $$("[data-variant]", inert);
    const show = (k) => {
      btns.forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.variant === k)));
      const v = V[k];
      $('[data-bar="control"]', inert).style.transform = `scaleX(${Math.max(v.control, 0.004)})`;
      $('[data-bar="dice"]', inert).style.transform = `scaleX(${v.dice})`;
      $('[data-val="control"]', inert).textContent = v.control.toFixed(3);
      $('[data-val="dice"]', inert).textContent = v.dice.toFixed(3);
      $("[data-inert-note]", inert).textContent = v.note;
    };
    btns.forEach((b) => b.addEventListener("click", () => show(+b.dataset.variant)));
    show(0);
  }

  // ── work accordion ─────────────────────────────────────────────────────
  $$(".job-row").forEach((btn) => {
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
    });
  });

  // ── project filter ─────────────────────────────────────────────────────
  const filterBtns = $$("[data-filter]");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = btn.dataset.filter;
      filterBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      $$(".project").forEach((p) => {
        p.hidden = f !== "all" && !p.dataset.tags.split(" ").includes(f);
      });
    });
  });

  // ── copy email ─────────────────────────────────────────────────────────
  $$("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (await copy(btn.dataset.copy)) {
        toast("Email copied");
        const label = $("[data-copy-label]", btn);
        if (label) { label.textContent = "Copied"; setTimeout(() => (label.textContent = "Copy"), 1800); }
      } else {
        window.location.href = `mailto:${btn.dataset.copy}`;
      }
    });
  });

  // ── dialogs (shared focus handling) ────────────────────────────────────
  let lastFocus = null;
  function openDialog(el, focusEl) {
    lastFocus = document.activeElement;
    el.hidden = false;
    document.body.style.overflow = "hidden";
    (focusEl || el.querySelector("input, button"))?.focus();
  }
  function closeDialog(el) {
    el.hidden = true;
    document.body.style.overflow = "";
    lastFocus?.focus?.();
  }
  function trapTab(el, e) {
    if (e.key !== "Tab") return;
    const f = $$("a, button, input, textarea, [tabindex]:not([tabindex='-1'])", el).filter((n) => !n.disabled && n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ── command palette ────────────────────────────────────────────────────
  const palette = $("#palette");
  const input = $(".palette-input", palette);
  const list = $(".palette-list", palette);
  const go = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  const COMMANDS = [
    { label: "What I'm building", hint: "Section", run: go("building") },
    { label: "Akasha.ai", hint: "Venture", run: go("akasha") },
    { label: "Chef.ai", hint: "Venture", run: go("chefai") },
    { label: "Artemis", hint: "Venture", run: go("artemis") },
    { label: "Work experience", hint: "Section", run: go("work") },
    { label: "Research & papers", hint: "Section", run: go("research") },
    { label: "Siemens patent", hint: "Recognition", run: go("patent") },
    { label: "Projects", hint: "Section", run: go("projects") },
    { label: "Anatomy is Free (paper)", hint: "Research", run: go("research") },
    { label: "Aligned but Inert (paper)", hint: "Research", run: () => document.querySelector("[data-inert]")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" }) },
    { label: "Recognition & hackathons", hint: "Section", run: go("recognition") },
    { label: "Skills", hint: "Section", run: go("skills") },
    { label: "About me", hint: "Section", run: go("about") },
    { label: "Contact", hint: "Section", run: go("contact") },
    { label: "Copy email address", hint: "Action", run: async () => toast((await copy(EMAIL)) ? "Email copied" : EMAIL) },
    { label: "Write me a message", hint: "Action", run: () => openModal() },
    { label: "Toggle light / dark", hint: "Theme", run: toggleTheme },
    { label: "GitHub", hint: "Link", run: () => window.open("https://github.com/Vayuputra2401", "_blank", "noopener") },
    { label: "LinkedIn", hint: "Link", run: () => window.open("https://www.linkedin.com/in/pathikreet-chowdhury-489b77234/", "_blank", "noopener") },
  ];
  let filtered = COMMANDS;
  let sel = 0;

  function renderPalette() {
    const q = input.value.trim().toLowerCase();
    filtered = COMMANDS.filter((c) => (c.label + " " + c.hint).toLowerCase().includes(q));
    sel = Math.min(sel, Math.max(0, filtered.length - 1));
    list.innerHTML = "";
    if (!filtered.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "Nothing matches.";
      list.appendChild(li);
      return;
    }
    filtered.forEach((c, i) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === sel));
      li.innerHTML = `<span></span><span class="mono"></span>`;
      li.firstChild.textContent = c.label;
      li.lastChild.textContent = c.hint;
      li.addEventListener("mousemove", () => { if (sel !== i) { sel = i; renderPalette(); } });
      li.addEventListener("click", () => runCommand(i));
      list.appendChild(li);
    });
    list.children[sel]?.scrollIntoView({ block: "nearest" });
  }
  function runCommand(i) {
    const c = filtered[i];
    if (!c) return;
    closeDialog(palette);
    c.run();
  }
  function openPalette() {
    input.value = "";
    sel = 0;
    renderPalette();
    openDialog(palette, input);
  }

  $$("[data-palette-open]").forEach((b) => b.addEventListener("click", openPalette));
  input.addEventListener("input", () => { sel = 0; renderPalette(); });
  palette.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % Math.max(1, filtered.length); renderPalette(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + filtered.length) % Math.max(1, filtered.length); renderPalette(); }
    else if (e.key === "Enter") { e.preventDefault(); runCommand(sel); }
    else trapTab(palette, e);
  });
  palette.addEventListener("click", (e) => { if (e.target === palette) closeDialog(palette); });

  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || "");
    if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
      e.preventDefault();
      if (palette.hidden) openPalette(); else closeDialog(palette);
    } else if (e.key === "Escape") {
      if (!palette.hidden) closeDialog(palette);
      else if (!modal.hidden) closeDialog(modal);
    }
  });

  // ── theme ──────────────────────────────────────────────────────────────
  function toggleTheme() {
    const root = document.documentElement;
    const dark = root.dataset.theme
      ? root.dataset.theme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
    window.dispatchEvent(new Event("themechange"));
    toast(dark ? "Light theme" : "Dark theme");
  }

  // ── contact modal (EmailJS) ────────────────────────────────────────────
  const EMAILJS_PUBLIC_KEY = "7BZGP-ZYoJd0QYkxL";
  const EMAILJS_SERVICE_ID = "service_1q0rd5c";
  const EMAILJS_TEMPLATE_ID = "template_0qjnf3l";

  const modal = $("#contact-modal");
  const form = $("#contact-form");
  const formBody = $("[data-form-body]", modal);
  const formDone = $("[data-form-done]", modal);
  const formError = $("[data-form-error]", modal);

  function openModal() {
    formBody.hidden = false;
    formDone.hidden = true;
    formError.textContent = "";
    openDialog(modal, form.querySelector("input"));
  }
  $$("[data-modal-open]").forEach((b) => b.addEventListener("click", openModal));
  $$("[data-modal-close]").forEach((b) => b.addEventListener("click", () => closeDialog(modal)));
  modal.addEventListener("click", (e) => { if (e.target === modal) closeDialog(modal); });
  modal.addEventListener("keydown", (e) => trapTab(modal, e));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.textContent = "";
    const data = {
      from_name: form.name.value.trim(),
      from_email: form.email.value.trim(),
      subject: form.subject.value.trim() || "Portfolio contact",
      message: form.message.value.trim(),
    };
    if (!data.from_name || !data.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.from_email)) {
      formError.textContent = "Add your name, a valid email and a message.";
      return;
    }
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    btn.textContent = "Sending…";
    try {
      if (typeof emailjs === "undefined") throw new Error("EmailJS not loaded");
      emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, data);
      form.reset();
      formBody.hidden = true;
      formDone.hidden = false;
    } catch (err) {
      formError.textContent = `That didn't send. Email me directly at ${EMAIL}.`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Send";
    }
  });
})();
