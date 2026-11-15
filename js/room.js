/**
 * Hero: the little me's room — an isometric diorama in the site's flat,
 * outlined box style. Every object is a way into the portfolio:
 *
 *   whiteboard → Building now     laptop (him) → Work     bookshelf → Research
 *   boxes → Projects   patent + trophy → Recognition   paper plane → Contact
 *   Jim Beam (the cat) → About    window → switches light / dark (sun / moon)
 *
 * Plain SVG built here; no WebGL. The room tilts a little with the pointer,
 * objects drop in on load, and small idle loops keep it alive (typing, blink,
 * the cat breathing, wind past the window, the plane). Reduced motion: no
 * entrance, tilt or loops.
 */
(function () {
  "use strict";

  const host = document.querySelector("[data-room]");
  if (!host) return;
  const art = window.BuddyArt;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── isometric projection: x runs to the back-right wall, y to the
  //    back-left wall, z is up. Floor is 240 × 240.
  const OX = 300, OY = 214;
  const P = (x, y, z = 0) => [OX + (x - y), OY + (x + y) / 2 - z];
  const pt = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  const poly = (pts, cls, extra = "") => `<path class="${cls}" d="M${pts.map((q) => pt(P(...q))).join(" L")} Z" ${extra}/>`;
  function box(x, y, z, w, d, h, top, left, right, cls = "") {
    return `<g class="${cls}">` +
      poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], `r-ol ${left}`) +
      poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], `r-ol ${right}`) +
      poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], `r-ol ${top}`) + "</g>";
  }
  // Text laid flat on a wall: wall A (y = 0) reads along +x, wall B (x = 0) along −y.
  const onWallA = (x, z) => { const p = P(x, 0, z); return `matrix(1 0.5 0 1 ${p[0].toFixed(1)} ${p[1].toFixed(1)})`; };
  const onWallB = (y, z) => { const p = P(0, y, z); return `matrix(1 -0.5 0 1 ${p[0].toFixed(1)} ${p[1].toFixed(1)})`; };
  const floorEllipse = (cx, cy, r, cls, z = 0) => {
    const c = P(cx, cy, z);
    return `<ellipse class="${cls}" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(r * Math.SQRT2).toFixed(1)}" ry="${(r * Math.SQRT2 / 2).toFixed(1)}"/>`;
  };
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

  // ── the shell: floor slab and two walls ─────────────────────────────────
  let planks = "";
  for (let y = 30; y < 240; y += 30) planks += `<path class="r-plank" d="M${pt(P(0, y))} L${pt(P(240, y))}"/>`;
  const shell = `<g data-drop>
    ${box(-10, -10, -16, 250, 250, 16, "r-floor", "r-slab", "r-slab2")}
    ${planks}
    ${box(-10, 0, 0, 10, 240, 168, "r-cap", "r-cap2", "r-wallB")}
    ${box(-10, -10, 0, 250, 10, 168, "r-cap", "r-wallA", "r-cap2")}
  </g>`;

  // ── window on wall A: sky follows the theme; wind drifts past ───────────
  const winPts = [[132, 0, 72], [214, 0, 72], [214, 0, 148], [132, 0, 148]];
  let wind = "";
  [88, 102, 118, 134].forEach((z, i) => { wind += `<path class="r-wind" style="animation-delay:${-i * 1.3}s" d="M${pt(P(134, 0, z))} L${pt(P(212, 0, z + 2))}"/>`; });
  const sun = P(196, 0, 131);
  const windowSvg = `<a class="obj" href="#home" data-key="window" aria-label="Window: switch between day and night (light and dark theme)" data-drop>
    <clipPath id="r-win"><path d="M${winPts.map((q) => pt(P(...q))).join(" L")} Z"/></clipPath>
    ${poly(winPts, "r-ol r-sky")}
    <g clip-path="url(#r-win)">
      <g class="r-sun"><circle cx="${sun[0]}" cy="${sun[1]}" r="9"/></g>
      <g class="r-moon"><circle class="r-moonC" cx="${sun[0]}" cy="${sun[1]}" r="8.5"/><circle class="r-moonCut" cx="${sun[0] + 4}" cy="${sun[1] - 3}" r="7.5"/>
        <circle class="r-star" cx="${P(150, 0, 136)[0]}" cy="${P(150, 0, 136)[1]}" r="1.4"/><circle class="r-star" cx="${P(165, 0, 112)[0]}" cy="${P(165, 0, 112)[1]}" r="1.1"/><circle class="r-star" cx="${P(144, 0, 96)[0]}" cy="${P(144, 0, 96)[1]}" r="1.2"/></g>
      ${wind}
    </g>
    <path class="r-ol r-frame" d="M${pt(P(173, 0, 72))} L${pt(P(173, 0, 148))} M${pt(P(132, 0, 110))} L${pt(P(214, 0, 110))}"/>
    ${box(128, 0, 66, 90, 8, 5, "r-sill", "r-sill2", "r-sill2")}
  </a>`;

  // ── patent frame + trophy shelf on wall A → Recognition ──────────────────
  const tro = P(108, 7, 76);
  const recognition = `<a class="obj" href="#recognition" data-key="recognition" aria-label="Framed patent and trophy: Recognition" data-drop>
    ${poly([[28, 0, 86], [90, 0, 86], [90, 0, 140], [28, 0, 140]], "r-ol r-cert")}
    ${poly([[34, 0, 92], [84, 0, 92], [84, 0, 134], [34, 0, 134]], "r-certIn")}
    <g transform="${onWallA(39, 126)}"><text class="r-certT">PATENT</text><text class="r-certS" y="9">GRANTED · 2025</text><rect class="r-certL" x="0" y="15" width="30" height="2"/><rect class="r-certL" x="0" y="20" width="22" height="2"/></g>
    <circle class="r-ol r-seal" cx="${P(78, 0, 98)[0]}" cy="${P(78, 0, 98)[1]}" r="6"/>
    ${box(94, 0, 62, 32, 14, 5, "r-shelf", "r-shelf2", "r-shelf2")}
    <g transform="translate(${tro[0].toFixed(1)} ${tro[1].toFixed(1)})">
      <path class="r-ol r-gold" d="M-10 -26 L10 -26 Q10 -12 2 -9 L2 -4 L7 -1 L-7 -1 L-2 -4 L-2 -9 Q-10 -12 -10 -26 Z"/>
      <path class="r-ol" fill="none" d="M-10 -23 Q-17 -22 -11 -15 M10 -23 Q17 -22 11 -15"/>
      <rect class="r-ol r-goldD" x="-9" y="-1" width="18" height="5" rx="1"/>
    </g>
  </a>`;

  // ── whiteboard on wall B → Building now ──────────────────────────────────
  const building = `<a class="obj" href="#building" data-key="building" aria-label="Whiteboard listing Akasha, Chef.ai and Artemis: Building now" data-drop>
    ${poly([[0, 146, 64], [0, 228, 64], [0, 228, 140], [0, 146, 140]], "r-ol r-board")}
    <g transform="${onWallB(224, 132)}">
      <text class="r-boardK">BUILDING NOW</text>
      <rect class="r-tick" x="0" y="8" width="7" height="7"/><text class="r-boardT" x="11" y="15">Akasha.ai</text>
      <rect class="r-tick on" x="0" y="23" width="7" height="7"/><text class="r-boardT" x="11" y="30">Chef.ai</text>
      <rect class="r-tick on" x="0" y="38" width="7" height="7"/><text class="r-boardT" x="11" y="45">Artemis</text>
      <path class="r-marker" d="M54 52 q6 -3 12 0"/>
    </g>
    ${box(0, 146, 58, 6, 82, 4, "r-shelf", "r-shelf2", "r-shelf2")}
  </a>`;

  // ── bookshelf against wall B → Research ──────────────────────────────────
  let books = "";
  const BOOK = ["r-b1", "r-b2", "r-b3", "r-b4", "r-b5"];
  [3, 53, 103].forEach((z0) => {
    let y = 26;
    while (y < 112) {
      const w = 7 + Math.floor(rnd() * 6), h = 30 + Math.floor(rnd() * 13);
      if (y + w > 114) break;
      books += poly([[30, y, z0], [30, y + w, z0], [30, y + w, z0 + h], [30, y, z0 + h]], `r-ol r-book ${BOOK[Math.floor(rnd() * BOOK.length)]}`, 'style="stroke-width:1.4"');
      y += w + 1;
    }
  });
  const research = `<a class="obj" href="#research" data-key="research" aria-label="Bookshelf: Research" data-drop>
    ${box(0, 20, 0, 30, 100, 152, "r-wood", "r-wood2", "r-woodIn")}
    ${books}
    ${[50, 100].map((z) => poly([[30, 20, z], [30, 120, z], [30, 120, z + 3], [30, 20, z + 3]], "r-ol r-wood2")).join("")}
  </a>`;

  // ── cardboard boxes → Projects ───────────────────────────────────────────
  const tape = (x, y, z, w, d) => `<path class="r-tape" d="M${pt(P(x + w / 2, y, z))} L${pt(P(x + w / 2, y + d, z))}"/>`;
  const projects = `<a class="obj" href="#projects" data-key="projects" aria-label="Stack of boxes, things I built: Projects" data-drop>
    ${box(176, 18, 0, 54, 50, 40, "r-cbT", "r-cbL", "r-cbR")}${tape(176, 18, 40, 54, 50)}
    ${box(184, 26, 40, 40, 36, 32, "r-cbT", "r-cbL", "r-cbR")}${tape(184, 26, 72, 40, 36)}
    <g transform="matrix(1 0.5 0 1 ${P(179, 68, 22)[0].toFixed(1)} ${P(179, 68, 22)[1].toFixed(1)})"><text class="r-cbText">THINGS I BUILT</text></g>
    ${box(200, 74, 0, 30, 28, 22, "r-cbT", "r-cbL", "r-cbR")}${tape(200, 74, 22, 30, 28)}
  </a>`;

  // ── Jim Beam, asleep on the rug → About ──────────────────────────────────
  const c = P(74, 196, 0);
  const cat = `<a class="obj" href="#about" data-key="about" aria-label="Jim Beam the cat, asleep: About" data-drop>
    <g transform="translate(${c[0].toFixed(1)} ${c[1].toFixed(1)})">
      <!-- tabby: grey-brown coat, dark stripes, ringed tail, the "M" on the forehead -->
      <path class="r-tailO" d="M20 -1 Q40 0 36 -14 Q33 -21 27 -17"/>
      <path class="r-tail" d="M20 -1 Q40 0 36 -14 Q33 -21 27 -17"/>
      <path class="r-tailRing" d="M29 -1.5 l1 -4.5 M35 -5 l-4 -2 M35.5 -12 l-4.5 1"/>
      <g class="r-breathe">
        <path class="r-ol r-cat" d="M-24 -4 Q-30 -22 -8 -24 Q16 -26 24 -10 Q28 0 18 2 L-20 2 Q-26 0 -24 -4 Z"/>
        <path class="r-belly" d="M-16 1 Q-4 -6 12 0 Z"/>
        <path class="r-stripe" d="M-10 -23.5 q3 7 0 12 M-2 -24.5 q3 8 0 13 M6 -24 q3 7 0 12 M14 -21 q3 6 0 10 M20 -15 q2 4 0 7"/>
      </g>
      <g transform="translate(-22 -10)">
        <path class="r-ol r-cat" d="M-12 4 Q-14 -10 -8 -12 L-6 -20 L-1 -13 Q3 -14 6 -13 L10 -20 L11 -11 Q15 -6 12 4 Z"/>
        <path class="r-pink" d="M-6.5 -13.5 l1 -4 l2.6 3.4 z M8.5 -13.5 l1 -4 l-2.6 3.4 z"/>
        <path class="r-stripe" d="M-1 -12 l1 4 l1 -3 l1 3 l1 -4 M-11 -2 h4 M-11.5 1 h4 M11 -2 h-4 M11.5 1 h-4"/>
        <ellipse class="r-muzzle" cx="1" cy="1.5" rx="5.5" ry="3.4"/>
        <path class="r-ink2" d="M-6 -4 q2 2 4 0 M4 -4 q2 2 4 0"/>
        <path class="r-pink" d="M-0.5 0 l1.5 1.2 l1.5 -1.2 z"/>
      </g>
      <text class="r-zzz" x="-36" y="-30">z</text><text class="r-zzz r-zzz2" x="-44" y="-42">z</text>
    </g>
  </a>`;

  // ── him, on a cushion, typing → Work ─────────────────────────────────────
  let me = "";
  if (art) {
    const s = 0.6, base = P(146, 150, 0);
    const body = `
      <path class="b-pants b-fo" d="M56 212 Q100 204 144 212 Q172 226 164 248 Q132 262 100 254 Q68 262 36 248 Q28 226 56 212 Z"/>
      ${art.slide(62, 248, false)}${art.slide(138, 248, true)}
      ${art.SHIRT}${art.NECK}
      <g class="r-typeL"><path class="b-skin b-fo" d="M47 181 L60 185 Q70 204 80 214 L71 222 Q57 206 47 181 Z"/></g>
      <g class="r-typeR"><path class="b-skin b-fo" d="M153 181 L140 185 Q130 204 120 214 L129 222 Q143 206 153 181 Z"/></g>
      <rect class="r-ol r-lid" x="66" y="190" width="68" height="40" rx="4"/>
      <circle class="r-sticker" cx="100" cy="209" r="8"/><text class="r-stickerT" x="100" y="213">λ</text>
      <rect class="r-ol r-base" x="62" y="229" width="76" height="6" rx="2"/>
      ${art.HEAD}`;
    me = `<a class="obj" href="#work" data-key="work" aria-label="Me, typing on a laptop: Work" data-drop data-me>
      ${floorEllipse(146, 150, 40, "r-ol r-cushion")}
      ${floorEllipse(146, 150, 40, "r-cushionTop", 7)}
      <g class="buddy-svg" transform="translate(${(base[0] - 100 * s).toFixed(1)} ${(base[1] - 252 * s - 6).toFixed(1)}) scale(${s})">${body}</g>
    </a>`;
  }

  // ── paper plane, looping through the room → Contact ──────────────────────
  const plane = `<a class="obj obj-plane" href="#contact" data-key="contact" aria-label="Paper plane: Contact">
    <g class="r-plane"><path class="r-ol r-paper" d="M-14 -6 L16 0 L-14 7 L-8 0 Z"/><path class="r-ol r-paper2" d="M-8 0 L16 0 L-10 4 Z"/></g>
  </a>`;

  const rug = floorEllipse(140, 158, 78, "r-ol r-rug") + floorEllipse(140, 158, 62, "r-rugIn");

  host.innerHTML = `
    <div class="room-stage">
      <svg class="room-svg" viewBox="40 0 520 470" role="group" aria-label="My room. Each object opens a part of this site.">
        <defs><filter id="r-sil" x="-10%" y="-10%" width="125%" height="125%"><feFlood flood-color="#e8572a"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs>
        <g class="room-shadow" filter="url(#r-sil)" transform="translate(12 12)">${box(-10, -10, -16, 250, 250, 16, "", "", "")}${box(-10, 0, 0, 10, 240, 168, "", "", "")}${box(-10, -10, 0, 250, 10, 168, "", "", "")}</g>
        ${shell}${windowSvg}${recognition}${building}${research}
        <g data-drop>${rug}</g>
        ${projects}${cat}${me}${plane}
      </svg>
      <div class="room-tag mono" aria-hidden="true"></div>
    </div>
    <p class="room-hint mono">Everything in my room opens something. Hover, then click.</p>`;

  const stage = host.querySelector(".room-stage");
  const svgEl = host.querySelector(".room-svg");
  const tag = host.querySelector(".room-tag");
  const NAMES = {
    building: "01 · Building now", work: "02 · Work", research: "03 · Research", projects: "04 · Projects",
    recognition: "05 · Recognition", contact: "06 · Contact", about: "07 · About · Jim Beam", window: "Day ⇄ night",
  };

  // label next to the hovered / focused object
  function showTag(el) {
    const key = el.dataset.key;
    tag.textContent = `${NAMES[key]}${key === "window" ? "" : " ↗"}`;
    const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
    tag.style.left = `${Math.round(r.left - s.left + r.width / 2)}px`;
    tag.style.top = `${Math.round(r.top - s.top - 10)}px`;
    tag.classList.add("is-on");
    host.querySelectorAll(".room-nav [data-for]").forEach((b) => b.classList.toggle("is-hot", b.dataset.for === key));
  }
  function hideTag() {
    tag.classList.remove("is-on");
    host.querySelectorAll(".room-nav [data-for]").forEach((b) => b.classList.remove("is-hot"));
  }
  svgEl.querySelectorAll(".obj").forEach((o) => {
    o.addEventListener("pointerenter", () => showTag(o));
    o.addEventListener("pointerleave", hideTag);
    o.addEventListener("focus", () => showTag(o));
    o.addEventListener("blur", hideTag);
  });
  // the list under the room lights up its object
  host.querySelectorAll(".room-nav [data-for]").forEach((b) => {
    const o = svgEl.querySelector(`.obj[data-key="${b.dataset.for}"]`);
    if (!o) return;
    b.addEventListener("pointerenter", () => { o.classList.add("is-hot"); showTag(o); });
    b.addEventListener("pointerleave", () => { o.classList.remove("is-hot"); hideTag(); });
  });

  // window: day ⇄ night = the theme toggle
  const win = svgEl.querySelector('[data-key="window"]');
  win.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector("[data-theme-toggle]")?.click();
  });

  if (reduceMotion) { host.classList.add("is-still"); return; }

  // gentle tilt with the pointer
  const hero = document.getElementById("home");
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  hero.addEventListener("pointermove", (e) => {
    tilt.tx = (e.clientX / window.innerWidth - 0.5) * 10;
    tilt.ty = (e.clientY / window.innerHeight - 0.5) * -6;
  }, { passive: true });
  hero.addEventListener("pointerleave", () => { tilt.tx = tilt.ty = 0; });
  let raf = 0, visible = true;
  function tick() {
    tilt.x += (tilt.tx - tilt.x) * 0.08;
    tilt.y += (tilt.ty - tilt.y) * 0.08;
    stage.style.transform = `perspective(1200px) rotateY(${tilt.x.toFixed(2)}deg) rotateX(${tilt.y.toFixed(2)}deg)`;
    raf = requestAnimationFrame(tick);
  }
  const run = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick); };
  const halt = () => { cancelAnimationFrame(raf); raf = 0; };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? run() : halt(); host.classList.toggle("is-paused", !visible); }).observe(stage);
  document.addEventListener("visibilitychange", () => (document.hidden ? halt() : run()));
  run();

  // entrance: room rises, objects drop in, he lands last
  if (window.gsap) {
    const drops = svgEl.querySelectorAll("[data-drop]");
    window.gsap.from(svgEl.querySelector(".room-shadow"), { autoAlpha: 0, duration: 0.6, delay: 0.5 });
    window.gsap.from(drops, { y: -46, autoAlpha: 0, duration: 0.7, ease: "back.out(1.7)", stagger: 0.09, delay: 0.5 });
    window.gsap.from(".room-nav li, .room-hint", { y: 10, autoAlpha: 0, duration: 0.5, stagger: 0.05, delay: 1.6, ease: "power2.out" });
  }
})();
