/**
 * Hero model: one point cloud that morphs between shapes from my work.
 *
 *   01 Skeleton      Anatomy is Free (skeleton action recognition) — waves hello
 *   02 Caffeine      MoleculeForge
 *   03 Edge camera   Akasha's Eye layer, with a detection box in its frustum
 *   04 Bowl          Chef.ai, with steam rising
 *
 * Canvas 2D, no three.js. GSAP drives the morphs, the intro and the scroll-out
 * when it is loaded; a small built-in tween covers it when it isn't.
 *
 * Interaction: the model leans toward the cursor, points scatter away from it,
 * drag spins it (with inertia), click or the list moves to the next shape,
 * arrow keys work when it has focus. It pauses off-screen. Reduced motion:
 * no auto-advance, no idle spin, morphs are instant.
 */
(function () {
  "use strict";

  const root = document.querySelector(".hero-model");
  const canvas = root && root.querySelector("canvas");
  const S = window.PortfolioShapes;
  if (!canvas || !S) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const N = window.innerWidth < 768 ? 260 : 340;
  const AUTO_MS = 6500;

  // ── shape definitions: polylines in model space, radius ≈ 1 ────────────
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const ring = (c, r, axis, n) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const u = Math.cos(a) * r, v = Math.sin(a) * r;
      pts.push(axis === "x" ? add(c, [0, u, v]) : axis === "y" ? add(c, [u, 0, v]) : add(c, [u, v, 0]));
    }
    return pts;
  };

  const SHAPES = [
    {
      name: "Skeleton",
      note: "Anatomy is Free · skeleton action recognition",
      lines(t) {
        const P = S.pose("wave", t).map((p) => scale(p, 1.05));
        return S.BONES.map(([i, j]) => ({ pts: [P[i], P[j]], accent: false, ends: true }))
          .concat([{ pts: ring(P[4], 0.11, "z", 10), accent: false }]);
      },
    },
    {
      name: "Caffeine",
      note: "MoleculeForge · molecule generation",
      lines() {
        // scaled down: the molecule is wider than the other shapes
        const m = S.caffeine();
        const out = m.bonds.map(([i, j]) => ({ pts: [scale(add(m.atoms[i].p, [-0.25, 0, 0]), 0.72), scale(add(m.atoms[j].p, [-0.25, 0, 0]), 0.72)] }));
        m.atoms.forEach((a) => {
          if (a.el === "C") return;
          out.push({ pts: ring(scale(add(a.p, [-0.25, 0, 0]), 0.72), 0.09, "z", 8), accent: a.el === "O" });
        });
        return out;
      },
    },
    {
      name: "Edge camera",
      note: "Akasha.ai · eye layer",
      lines() {
        const out = [];
        // camera body
        const b = [[-1.0, -0.22, -0.22], [-0.45, 0.22, 0.22]];
        const corners = [];
        for (const x of [b[0][0], b[1][0]]) for (const y of [b[0][1], b[1][1]]) for (const z of [b[0][2], b[1][2]]) corners.push([x, y, z]);
        [[0, 1], [0, 2], [1, 3], [2, 3], [4, 5], [4, 6], [5, 7], [6, 7], [0, 4], [1, 5], [2, 6], [3, 7]]
          .forEach(([i, j]) => out.push({ pts: [corners[i], corners[j]] }));
        out.push({ pts: ring([-0.4, 0, 0], 0.15, "x", 14), accent: true });
        // frustum
        const apex = [-0.35, 0, 0];
        const far = [[1.0, -0.5, -0.38], [1.0, 0.5, -0.38], [1.0, 0.5, 0.38], [1.0, -0.5, 0.38]];
        far.forEach((f, i) => {
          out.push({ pts: [apex, f] });
          out.push({ pts: [f, far[(i + 1) % 4]] });
        });
        // detection box in the far plane
        const d = [[1.0, -0.32, -0.05], [1.0, 0.05, -0.05], [1.0, 0.05, 0.24], [1.0, -0.32, 0.24]];
        d.forEach((p, i) => out.push({ pts: [p, d[(i + 1) % 4]], accent: true }));
        return out;
      },
    },
    {
      name: "Bowl",
      note: "Chef.ai · fridge to meal",
      lines(t) {
        const out = [];
        const R = 0.8, cy = 0.05;
        for (let k = 1; k <= 5; k++) {
          const th = 0.25 + (k / 5) * (Math.PI / 2 - 0.25);
          out.push({ pts: ring([0, cy - R * Math.cos(th), 0], R * Math.sin(th), "y", 20) });
        }
        out.push({ pts: ring([0, cy - R - 0.02, 0], 0.28, "y", 12) });
        // steam
        for (let s = 0; s < 3; s++) {
          const x0 = (s - 1) * 0.28;
          const pts = [];
          for (let i = 0; i <= 10; i++) {
            const y = cy + 0.15 + i * 0.085;
            pts.push([x0 + 0.07 * Math.sin(y * 7 + t * 2 + s * 2), y, 0.05 * Math.cos(y * 5 + t * 1.5 + s)]);
          }
          out.push({ pts });
        }
        return out;
      },
    },
  ];

  // ── sampling: fixed (line, u) specs per shape, evaluated every frame ──
  function polyAt(pts, u) {
    const f = u * (pts.length - 1);
    const i = Math.min(Math.floor(f), pts.length - 2);
    const k = f - i;
    const a = pts[i], b = pts[i + 1];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }
  function polyLen(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
    return L;
  }

  SHAPES.forEach((shape) => {
    const lines = shape.lines(0);
    const lens = lines.map((l) => polyLen(l.pts));
    const total = lens.reduce((a, b) => a + b, 0);
    const raw = lens.map((L) => (L / total) * N);
    const counts = raw.map((r) => Math.max(1, Math.floor(r)));
    let left = N - counts.reduce((a, b) => a + b, 0);
    const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
    for (let k = 0; left > 0; k = (k + 1) % order.length, left--) counts[order[k][1]]++;
    for (let k = 0; left < 0; k = (k + 1) % counts.length) if (counts[k] > 1) { counts[k]--; left++; }

    const specs = [];
    lines.forEach((l, li) => {
      const c = counts[li];
      for (let s = 0; s < c; s++) {
        const u = c === 1 ? 0.5 : s / (c - 1);
        specs.push({ li, u, accent: !!l.accent, node: !!l.ends && (s === 0 || s === c - 1) });
      }
    });
    // Sort by height so a morph moves points roughly vertically, not across.
    specs.forEach((sp) => (sp.y = polyAt(lines[sp.li].pts, sp.u)[1]));
    specs.sort((a, b) => a.y - b.y);
    shape.specs = specs;
  });

  function evaluate(shape, t) {
    const lines = shape.lines(t);
    return shape.specs.map((sp) => polyAt(lines[sp.li].pts, sp.u));
  }

  // ── state ───────────────────────────────────────────────────────────────
  const delay = Array.from({ length: N }, () => Math.random());
  const scatter = Array.from({ length: N }, () => {
    const a = Math.random() * Math.PI * 2, z = Math.random() * 2 - 1, r = 2.2 + Math.random() * 1.6;
    return [Math.cos(a) * r * Math.sqrt(1 - z * z) - 2.5, Math.sin(a) * r * Math.sqrt(1 - z * z), z * r];
  });
  const push = Array.from({ length: N }, () => [0, 0]);

  const morph = { k: 1, intro: reduceMotion ? 1 : 0 };
  let from = 0, to = 0;
  let t = 0;
  let yaw = -0.5, spin = 0, tiltX = 0, tiltY = 0, lean = [0, 0];
  let pointer = null;
  let w = 0, h = 0;
  let lastInteract = 0;
  const view = { scale: 1, alpha: 1 };

  const navItems = Array.from(root.querySelectorAll("[data-shape]"));

  function colors() {
    const cs = getComputedStyle(root);
    return {
      dot: cs.getPropertyValue("--m-dot").trim() || "#ede6da",
      accent: cs.getPropertyValue("--m-accent").trim() || "#e8572a",
    };
  }
  const C = colors();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── tweening: GSAP when present ─────────────────────────────────────────
  function tween(obj, vars) {
    if (window.gsap) return window.gsap.to(obj, vars);
    const start = performance.now();
    const keys = Object.keys(vars).filter((k) => typeof vars[k] === "number" && k !== "duration" && k !== "delay");
    const init = Object.fromEntries(keys.map((k) => [k, obj[k]]));
    const dur = (vars.duration || 1) * 1000;
    const d0 = (vars.delay || 0) * 1000;
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const step = (now) => {
      const p = Math.min(1, Math.max(0, (now - start - d0) / dur));
      keys.forEach((k) => (obj[k] = init[k] + (vars[k] - init[k]) * ease(p)));
      if (p < 1) requestAnimationFrame(step);
      else vars.onComplete && vars.onComplete();
    };
    requestAnimationFrame(step);
  }

  function select(i) {
    if (i === to && morph.k === 1) return;
    from = to;
    to = ((i % SHAPES.length) + SHAPES.length) % SHAPES.length;
    navItems.forEach((b, j) => b.setAttribute("aria-pressed", String(j === to)));
    if (reduceMotion) { morph.k = 1; draw(); return; }
    morph.k = 0;
    window.gsap?.killTweensOf(morph, "k");
    tween(morph, { k: 1, duration: 1.6, ease: "expo.inOut" });
  }
  const next = () => select(to + 1);

  // ── drawing ─────────────────────────────────────────────────────────────
  function rot(p, a, b) {
    const x = p[0] * Math.cos(a) + p[2] * Math.sin(a);
    const z = -p[0] * Math.sin(a) + p[2] * Math.cos(a);
    const y = p[1] * Math.cos(b) - z * Math.sin(b);
    return [x, y, p[1] * Math.sin(b) + z * Math.cos(b)];
  }
  const smooth = (x) => x * x * (3 - 2 * x);

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const A = evaluate(SHAPES[from], t);
    const B = evaluate(SHAPES[to], t);
    const sA = SHAPES[from].specs, sB = SHAPES[to].specs;
    const sc = Math.min(w, h) * 0.34 * view.scale;
    const cx = w / 2, cy = h / 2;
    const pts = new Array(N);

    for (let i = 0; i < N; i++) {
      // per-point stagger so the morph flows instead of snapping
      const ki = smooth(Math.min(1, Math.max(0, morph.k * 1.5 - delay[i] * 0.5)));
      const ii = smooth(Math.min(1, Math.max(0, morph.intro * 1.6 - delay[i] * 0.6)));
      let p = [A[i][0] + (B[i][0] - A[i][0]) * ki, A[i][1] + (B[i][1] - A[i][1]) * ki, A[i][2] + (B[i][2] - A[i][2]) * ki];
      if (ii < 1) p = [scatter[i][0] + (p[0] - scatter[i][0]) * ii, scatter[i][1] + (p[1] - scatter[i][1]) * ii, scatter[i][2] + (p[2] - scatter[i][2]) * ii];
      const v = rot(p, yaw + lean[0], 0.18 + lean[1]);
      const persp = 3.6 / (3.6 - v[2]);
      let x = cx + v[0] * persp * sc, y = cy - v[1] * persp * sc;

      // the cursor parts the cloud
      if (pointer) {
        const dx = x - pointer[0], dy = y - pointer[1];
        const d = Math.hypot(dx, dy);
        const R = 70;
        if (d < R && d > 0.01) {
          const f = (1 - d / R) * 26;
          push[i][0] += ((dx / d) * f - push[i][0]) * 0.25;
          push[i][1] += ((dy / d) * f - push[i][1]) * 0.25;
        }
      }
      push[i][0] *= 0.9;
      push[i][1] *= 0.9;
      x += push[i][0];
      y += push[i][1];

      const spec = ki > 0.5 ? sB[i] : sA[i];
      pts[i] = { x, y, z: v[2], s: persp, accent: spec.accent, node: spec.node };
    }

    pts.sort((a, b) => a.z - b.z);
    for (const p of pts) {
      const depth = Math.max(0, Math.min(1, (p.z + 1.3) / 2.6));
      ctx.globalAlpha = view.alpha * (0.25 + 0.75 * depth);
      ctx.fillStyle = p.accent ? C.accent : C.dot;
      const r = (p.node ? 2.6 : p.accent ? 2 : 1.45) * p.s;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── loop ────────────────────────────────────────────────────────────────
  let frame = 0, prev = 0, sinceAuto = 0;
  function tick(now) {
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    t += dt;
    if (!dragging) {
      yaw += spin * dt;
      spin += (0.32 - spin) * Math.min(1, dt * 1.5); // inertia settles to idle spin
    }
    lean[0] += (tiltX - lean[0]) * Math.min(1, dt * 4);
    lean[1] += (tiltY - lean[1]) * Math.min(1, dt * 4);
    if (now - lastInteract > 9000) {
      sinceAuto += dt * 1000;
      if (sinceAuto > AUTO_MS) { sinceAuto = 0; next(); }
    }
    draw();
    frame = requestAnimationFrame(tick);
  }
  let visible = true;
  const run = () => {
    if (frame || !visible || document.hidden) return;
    prev = performance.now();
    frame = requestAnimationFrame(tick);
  };
  const halt = () => { cancelAnimationFrame(frame); frame = 0; };

  // ── input ───────────────────────────────────────────────────────────────
  const hero = document.getElementById("home");
  let dragging = false, dragX = 0, dragMoved = 0;

  hero.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer = [e.clientX - r.left, e.clientY - r.top];
    tiltX = ((e.clientX / window.innerWidth) - 0.5) * 0.5;
    tiltY = ((e.clientY / window.innerHeight) - 0.5) * 0.3;
    if (dragging) {
      const dx = e.clientX - dragX;
      dragX = e.clientX;
      dragMoved += Math.abs(dx);
      yaw += dx * 0.008;
      spin = dx * 0.5;
      if (!frame) draw();
    }
  }, { passive: true });
  hero.addEventListener("pointerleave", () => { pointer = null; tiltX = tiltY = 0; });

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    dragX = e.clientX;
    dragMoved = 0;
    lastInteract = performance.now();
    canvas.setPointerCapture(e.pointerId);
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    if (dragMoved < 6) next(); // a click, not a drag
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", () => { dragging = false; });
  canvas.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); select(to - 1); }
    else return;
    lastInteract = performance.now();
  });
  navItems.forEach((b, i) => b.addEventListener("click", () => { lastInteract = performance.now(); select(i); }));

  // ── start ───────────────────────────────────────────────────────────────
  resize();
  window.addEventListener("resize", () => { resize(); if (!frame) draw(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? run() : halt(); }).observe(canvas);
  document.addEventListener("visibilitychange", () => (document.hidden ? halt() : run()));
  navItems.forEach((b, j) => b.setAttribute("aria-pressed", String(j === 0)));

  if (reduceMotion) {
    draw();
    return;
  }

  // Intro: the cloud blows in from the left, on the wind, and assembles.
  tween(morph, { intro: 1, duration: 2.4, delay: 0.5, ease: "power3.out" });

  // Leaving the hero: the model drifts back and fades (scrubbed to scroll).
  if (window.gsap && window.ScrollTrigger) {
    window.gsap.to(view, {
      scale: 0.75, alpha: 0.2, ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
    });
  }

  run();
})();
