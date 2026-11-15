/**
 * The little me: an anime-style version of Pathikreet who keeps visitors
 * company. Same drawing as the GitHub README header.
 *
 * - Hero: he sits cross-legged on the section cube and pushes it round; his
 *   arm moves whenever the cube turns, and he hops off when it's tipped onto
 *   its top or bottom.
 * - After the hero he walks along the bottom edge as you scroll (direction
 *   follows the scroll), and when a section arrives he peeks in from the
 *   side or hangs from the top with a one-line tip, then ducks out.
 * - Click him for a tip. "Hide me" (or the ⌘K menu) puts him away for good
 *   in this browser. Reduced motion: no walker and no peeks.
 */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const STORE = "buddy-off";
  let off = false;
  try { off = localStorage.getItem(STORE) === "1"; } catch (e) {}

  // ── drawing parts (local 200-wide coordinate space) ──────────────────────
  const eye = (cx) =>
    `<ellipse class="b-white" cx="${cx}" cy="96" rx="7.2" ry="8.6"/>` +
    `<ellipse class="b-iris" cx="${cx + 0.6}" cy="97.2" rx="5.6" ry="7"/>` +
    `<ellipse class="b-pupil" cx="${cx + 0.6}" cy="98" rx="2.8" ry="3.8"/>` +
    `<circle class="b-hl" cx="${cx + 2.6}" cy="93.6" r="2.1"/><circle class="b-hl" cx="${cx - 1.6}" cy="100.4" r="1"/>`;

  const HEAD = `<g class="b-head">
    <path class="b-hair b-fo" d="M48 92 Q30 40 70 20 Q100 6 132 18 Q172 36 152 92 Q148 64 100 58 Q54 62 48 92 Z"/>
    <ellipse class="b-skin b-fo" cx="59" cy="94" rx="7.5" ry="10.5"/><ellipse class="b-skin b-fo" cx="141" cy="94" rx="7.5" ry="10.5"/>
    <path class="b-skin b-fo" d="M62 78 Q60 122 100 139 Q140 122 138 78 Q138 44 100 42 Q62 44 62 78 Z"/>
    <path class="b-hair b-fo" d="M53 84 Q44 34 90 24 Q132 14 150 46 Q157 64 149 86 L142 68 L137 84 L127 60 L119 80 L110 57 L100 78 L91 57 L83 80 L75 61 L68 82 L61 66 Z"/>
    <path class="b-strand" d="M70 40 Q88 30 104 34 M96 28 Q120 26 136 40 M64 56 Q74 44 88 42 M118 40 Q132 46 140 58"/>
    <path class="b-hair b-fo" d="M100 22 Q104 8 116 6 Q108 14 110 22 Z" style="stroke-width:2"/>
    <path class="b-ink" d="M71 77 Q81 72 91 76 M109 76 Q119 72 129 77" style="stroke-width:3.2"/>
    <g class="b-eyes">${eye(82)}${eye(118)}</g>
    <circle class="b-lens" cx="82" cy="96" r="14.5"/><circle class="b-lens" cx="118" cy="96" r="14.5"/>
    <path class="b-ink" d="M96.5 93 Q100 90 103.5 93 M67.5 94 L60 90 M132.5 94 L140 90"/>
    <path class="b-nose" d="M100 105 Q98 110 101.5 111"/>
    <ellipse class="b-blush" cx="69" cy="113" rx="6.5" ry="3.2"/><ellipse class="b-blush" cx="131" cy="113" rx="6.5" ry="3.2"/>
    <path class="b-mouth b-fo" d="M83 115 Q100 136 117 115 Q100 120 83 115 Z" style="stroke-width:2"/>
    <path class="b-tongue" d="M92 124 Q100 131 108 124 Q100 121 92 124 Z"/>
    <path class="b-teeth" d="M86 116.4 Q100 121 114 116.4 L112.4 119.4 Q100 123.6 87.6 119.4 Z"/>
  </g>`;

  const NECK = `<rect class="b-skin b-fo" x="89" y="126" width="22" height="24" rx="4"/>`;
  const SHIRT = `<path class="b-shirt b-fo" d="M57 150 Q100 140 143 150 L154 184 L139 190 L138 224 L62 224 L61 190 L46 184 Z"/>
    <path class="b-trim" d="M49 180 L61 185 M151 180 L139 185 M63 220 L137 220"/>
    <path class="b-trim" d="M100 156 L100 220" style="stroke-width:2"/>
    <circle class="b-logo" cx="81" cy="173" r="5"/><circle class="b-logo" cx="120" cy="173" r="6"/>
    <text class="b-script" x="64" y="204">New</text><text class="b-script" x="108" y="200">York</text>
    <path class="b-trim" d="M82 147 Q100 161 118 147"/>`;

  const hand = (cx, cy) =>
    `<ellipse class="b-skin b-fo" cx="${cx}" cy="${cy}" rx="11" ry="9"/>` +
    `<path class="b-finger" d="M${cx - 5} ${cy - 5} v6 M${cx} ${cy - 6} v7 M${cx + 5} ${cy - 5} v6"/>`;

  const slide = (cx, cy, flip) =>
    `<ellipse class="b-sole b-fo" cx="${cx}" cy="${cy + 6}" rx="21" ry="6.5"/>` +
    `<ellipse class="b-skin b-fo" cx="${cx + (flip ? 3 : -3)}" cy="${cy}" rx="14" ry="5"/>` +
    `<path class="b-strap b-fo" d="M${cx - 18} ${cy - 8} Q${cx} ${cy - 13} ${cx + 18} ${cy - 8} L${cx + 18} ${cy + 3} Q${cx} ${cy - 1} ${cx - 18} ${cy + 3} Z"/>`;

  const shadow = (id) =>
    `<defs><filter id="${id}" x="-15%" y="-15%" width="140%" height="140%"><feFlood flood-color="#e8572a"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs>`;

  function svg(viewBox, body, label) {
    const id = "bsil" + Math.random().toString(36).slice(2, 7);
    return `<svg class="buddy-svg" viewBox="${viewBox}" role="img" aria-label="${label}">${shadow(id)}
      <g filter="url(#${id})" transform="translate(7 7)" class="b-shadow">${body}</g><g>${body}</g></svg>`;
  }

  // Sitting cross-legged; right arm reaches down to push the cube.
  const SITTER = svg("22 0 190 268", `
    <g class="b-push">
      <path class="b-skin b-fo" d="M144 182 L156 176 L190 228 L178 236 Z"/>${hand(186, 236)}
      <path class="b-trim" d="M147 180 L157 175"/>
    </g>
    <path class="b-pants b-fo" d="M56 212 Q100 204 144 212 Q172 226 164 248 Q132 262 100 254 Q68 262 36 248 Q28 226 56 212 Z"/>
    <path class="b-fold" d="M60 232 Q80 240 100 236 Q120 240 140 232 M100 222 v14"/>
    ${slide(62, 248, false)}${slide(138, 248, true)}
    <path class="b-skin b-fo" d="M48 182 L60 186 L84 230 L72 236 Z"/>${hand(80, 234)}
    ${SHIRT}${NECK}${HEAD}`, "A drawing of Pathikreet sitting on the cube, spinning it");

  // Walking: separate legs and arms so they can swing.
  const WALKER = svg("30 0 140 332", `
    <g class="b-armR"><path class="b-skin b-fo" d="M139 184 L152 182 L150 226 L139 226 Z"/>${hand(145, 230)}</g>
    <g class="b-legR"><path class="b-pants b-fo" d="M100 214 L138 214 L136 300 L104 300 Z"/><path class="b-fold" d="M108 288 Q120 284 132 290"/>${slide(121, 308, true)}</g>
    <g class="b-legL"><path class="b-pants b-fo" d="M62 214 L100 214 L96 300 L64 300 Z"/><path class="b-fold" d="M68 288 Q80 284 92 290"/>${slide(79, 308, false)}</g>
    ${SHIRT}${NECK}
    <g class="b-armL"><path class="b-skin b-fo" d="M48 182 L61 184 L61 226 L50 226 Z"/>${hand(55, 230)}</g>
    ${HEAD}`, "A small drawing of Pathikreet walking along with you");

  // Peeking: head and two hands gripping the edge (the bottom of the box).
  const PEEKER = svg("36 0 128 162", `${HEAD}${hand(66, 150)}${hand(134, 150)}`, "Pathikreet peeking in");

  // ── hero: sit on the cube ────────────────────────────────────────────────
  const cubeRoot = document.querySelector("[data-cube]");
  const stage = cubeRoot && cubeRoot.querySelector(".cube-stage");
  if (stage) {
    const sit = document.createElement("div");
    sit.className = "cube-buddy";
    sit.setAttribute("aria-hidden", "true");
    sit.innerHTML = SITTER;
    stage.appendChild(sit);
    // cube.js marks the root while it turns (is-turning) or is tipped (is-tilted).
  }

  if (reduceMotion) return;

  // ── companion: walker + peeks ────────────────────────────────────────────
  const walker = document.createElement("button");
  walker.type = "button";
  walker.className = "buddy-walker";
  walker.setAttribute("aria-label", "The little me. Click for a tip.");
  walker.innerHTML = `<span class="buddy-flip">${WALKER}</span>`;

  const peek = document.createElement("div");
  peek.className = "buddy-peek";
  peek.innerHTML = `<button type="button" class="peek-inner" aria-label="The little me, peeking in. Click for a tip.">${PEEKER}</button>`;

  const bubble = document.createElement("div");
  bubble.className = "buddy-bubble";
  bubble.setAttribute("role", "status");
  bubble.innerHTML = `<p data-say></p><button type="button" class="buddy-hide mono">Hide me</button>`;

  document.body.append(walker, peek, bubble);
  const say = bubble.querySelector("[data-say]");

  const LINES = {
    building: { side: "right", text: "These three are my favourite problems. Akasha is the big one." },
    work: { side: "left", text: "200+ TB runs through the lakehouse I built. Every day." },
    research: { side: "top", text: "Two of these are under review at WACV 2027. Fingers crossed." },
    projects: { side: "right", text: "Try the filters — Agents is my favourite pile." },
    recognition: { side: "left", text: "Top 100 out of 75,000 teams. Still smiling about it." },
    skills: { side: "top", text: "Press ⌘K (or /) to jump anywhere." },
    about: { side: "right", text: "That's the real me. Same glasses." },
    contact: { side: "left", text: "Say hi — the form goes straight to my inbox." },
  };
  const TIPS = [
    "Drag the cube up top — I'll keep spinning it.",
    "Press ⌘K (or /) to jump anywhere.",
    "There's a dark mode toggle up in the nav.",
    "The wind in the hero is a real fluid simulation.",
    "Hit 'Run it' in the Akasha box to replay an incident.",
  ];
  let tip = 0;

  function hideBuddy() {
    off = true;
    try { localStorage.setItem(STORE, "1"); } catch (e) {}
    document.documentElement.classList.add("buddy-off");
    bubble.classList.remove("is-on");
  }
  function showBuddy() {
    off = false;
    try { localStorage.removeItem(STORE); } catch (e) {}
    document.documentElement.classList.remove("buddy-off");
  }
  window.portfolioBuddy = { hide: hideBuddy, show: showBuddy, isOff: () => off };
  if (off) document.documentElement.classList.add("buddy-off");

  let bubbleTimer = 0;
  function speak(text, anchor, side) {
    if (off) return;
    say.textContent = text;
    bubble.dataset.side = side;
    bubble.classList.add("is-on");
    const r = anchor.getBoundingClientRect();
    const bw = Math.min(260, window.innerWidth - 32);
    let x, y;
    if (side === "right") { x = r.left - bw - 12; y = r.top + r.height / 2 - 40; }
    else if (side === "left") { x = r.right + 12; y = r.top + r.height / 2 - 40; }
    else if (side === "top") { x = r.left + r.width / 2 - bw / 2; y = r.bottom + 12; }
    else { x = r.left + r.width / 2 - bw / 2; y = r.top - 96; }
    x = Math.max(16, Math.min(window.innerWidth - bw - 16, x));
    y = Math.max(72, Math.min(window.innerHeight - 110, y));
    bubble.style.width = bw + "px";
    bubble.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove("is-on"), 4200);
  }
  bubble.querySelector(".buddy-hide").addEventListener("click", hideBuddy);

  // walker
  const hero = document.getElementById("home");
  let lastY = window.scrollY, walkTimer = 0, peeking = false, peekTl = null;
  function place() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    const w = walker.offsetWidth || 64;
    walker.style.setProperty("--x", `${Math.round(12 + p * (window.innerWidth - w - 24))}px`);
    const inHero = window.scrollY < hero.offsetHeight * 0.6;
    walker.classList.toggle("is-out", inHero || peeking);
    // Back in the hero, he's sitting on the cube: any peek ducks out at once.
    if (inHero && peeking) {
      if (peekTl) peekTl.kill();
      if (window.gsap) window.gsap.set(peek, { autoAlpha: 0 }); else peek.style.opacity = "0";
      bubble.classList.remove("is-on");
      peeking = false;
    }
  }
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    if (y !== lastY) {
      walker.classList.toggle("face-left", y < lastY);
      walker.classList.add("is-walking");
      clearTimeout(walkTimer);
      walkTimer = setTimeout(() => walker.classList.remove("is-walking"), 220);
    }
    lastY = y;
    place();
  }, { passive: true });
  window.addEventListener("resize", place);
  place();
  walker.addEventListener("click", () => { speak(TIPS[tip++ % TIPS.length], walker, "bottom"); });

  // peeks, once per section per visit, never more often than every 7 s
  const seen = new Set();
  let lastPeek = 0;
  const OFF = { right: { x: 150 }, left: { x: -150 }, top: { y: -150 } };
  function doPeek(id) {
    const cfg = LINES[id];
    if (!cfg || off || seen.has(id) || peeking || performance.now() - lastPeek < 7000) return;
    if (window.scrollY < hero.offsetHeight * 0.6) return;
    seen.add(id);
    lastPeek = performance.now();
    peeking = true;
    place();
    peek.dataset.side = cfg.side;
    peek.style.left = cfg.side === "top" ? `${Math.round(window.innerWidth * (0.25 + Math.random() * 0.5))}px` : "";
    const from = OFF[cfg.side];
    const done = () => { peeking = false; place(); };
    if (window.gsap) {
      const tl = (peekTl = window.gsap.timeline({ onComplete: done }));
      tl.set(peek, { x: from.x || 0, y: from.y || 0, autoAlpha: 1 })
        .to(peek, { x: 0, y: 0, duration: 0.55, ease: "back.out(1.8)" })
        .add(() => speak(cfg.text, peek.querySelector(".peek-inner"), cfg.side))
        .to(peek, { x: from.x || 0, y: from.y || 0, duration: 0.45, ease: "power2.in" }, "+=4.2")
        .set(peek, { autoAlpha: 0 });
    } else {
      peek.style.opacity = "1";
      speak(cfg.text, peek.querySelector(".peek-inner"), cfg.side);
      setTimeout(() => { peek.style.opacity = "0"; done(); }, 4500);
    }
  }
  peek.querySelector(".peek-inner").addEventListener("click", (e) => {
    speak(TIPS[tip++ % TIPS.length], e.currentTarget, peek.dataset.side || "right");
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) doPeek(en.target.id); });
  }, { rootMargin: "-35% 0px -55% 0px" });
  Object.keys(LINES).forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
})();
