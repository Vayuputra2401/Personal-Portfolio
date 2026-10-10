/**
 * Tiny 3D graph renderer on Canvas 2D: nodes + edges, perspective projection,
 * drag to orbit. No three.js; the whole thing is a few KB.
 *
 * Two scenes use it:
 *   - [data-scene="skeleton"]  the LAST paper: a 21-joint skeleton with the
 *     physical bones, the adaptive (learned) edges an A-GCN adds, and the
 *     neighbouring frames a Temporal Shift Module mixes in.
 *   - [data-scene="molecule"]  MoleculeForge: caffeine, heavy atoms only.
 *
 * Every loop pauses off-screen. Reduced motion: no auto-orbit, no animation,
 * dragging still works.
 */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── math ────────────────────────────────────────────────────────────────
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  function rotZ(v, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
  }
  function rotX(v, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
  }
  // A limb segment that starts pointing down, is raised sideways by `side`
  // (towards +x when sign=1) and swung forward (+z) by `fwd`.
  const segment = (side, fwd, sign) => rotX(rotZ([0, -1, 0], side * sign), -fwd);

  // ── skeleton (LAST) ─────────────────────────────────────────────────────
  // 0 pelvis 1 spine 2 chest 3 neck 4 head
  // 5-8 left shoulder/elbow/wrist/hand   9-12 right
  // 13-16 left hip/knee/ankle/foot       17-20 right
  const BONES = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [2, 5], [5, 6], [6, 7], [7, 8],
    [2, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
  ];

  // The edges an adaptive graph convolution learns on top of the body graph.
  // Weights are per action: illustrative, chosen to show *that* they change.
  const ADAPTIVE = {
    wave: [[12, 4, 1], [12, 2, 0.7], [8, 12, 0.35], [12, 0, 0.3]],
    walk: [[8, 20, 1], [12, 16, 1], [16, 20, 0.6], [8, 12, 0.4]],
    squat: [[8, 14, 0.9], [12, 18, 0.9], [0, 4, 0.7], [16, 20, 0.35]],
  };

  function arm(shoulder, sign, upSide, upFwd, foreSide, foreFwd) {
    const elbow = add(shoulder, mul(segment(upSide, upFwd, sign), 0.28));
    const wrist = add(elbow, mul(segment(foreSide, foreFwd, sign), 0.25));
    const hand = add(wrist, mul(segment(foreSide, foreFwd, sign), 0.08));
    return [shoulder, elbow, wrist, hand];
  }
  function leg(hip, sign, thighFwd, shinFwd) {
    const knee = add(hip, mul(segment(0.03, thighFwd, sign), 0.42));
    const ankle = add(knee, mul(segment(0.0, shinFwd, sign), 0.42));
    const foot = add(ankle, [0, -0.03, 0.13]);
    return [hip, knee, ankle, foot];
  }

  function pose(action, t) {
    let pelvisY = 1.0, lean = 0, sway = 0;
    let lArm, rArm, lLeg, rLeg;

    if (action === "walk") {
      const p = Math.sin(t * 4);
      pelvisY = 1.0 + 0.025 * Math.abs(Math.cos(t * 4));
      lean = 0.05;
      lLeg = [p * 0.45, p * 0.45 - Math.max(0, -p) * 0.6 - 0.1];
      rLeg = [-p * 0.45, -p * 0.45 - Math.max(0, p) * 0.6 - 0.1];
      lArm = [0.12, -p * 0.5, 0.12, -p * 0.5 + 0.35];
      rArm = [0.12, p * 0.5, 0.12, p * 0.5 + 0.35];
    } else if (action === "squat") {
      const k = 0.5 - 0.5 * Math.cos(t * 2.2);
      pelvisY = 1.0 - 0.36 * k;
      lean = 0.35 * k;
      lLeg = [1.25 * k, -0.9 * k];
      rLeg = [1.25 * k, -0.9 * k];
      lArm = [0.15, 1.45 * k, 0.15, 1.5 * k];
      rArm = [0.15, 1.45 * k, 0.15, 1.5 * k];
    } else {
      // wave
      sway = 0.04 * Math.sin(t * 1.5);
      lLeg = [0, 0];
      rLeg = [0, 0];
      lArm = [0.1, 0.05, 0.1, 0.2];
      rArm = [2.0, 0.25, 2.75 + 0.45 * Math.sin(t * 6), 0.2];
    }

    const pelvis = [sway, pelvisY, 0];
    const up = (h) => add(pelvis, rotX([0, h, 0], lean));
    const spine = up(0.25), chest = up(0.45), neck = up(0.6), head = up(0.75);
    const shoulderL = add(chest, [0.2, 0.05, 0]);
    const shoulderR = add(chest, [-0.2, 0.05, 0]);

    return [
      pelvis, spine, chest, neck, head,
      ...arm(shoulderL, 1, lArm[0], lArm[1], lArm[2], lArm[3]),
      ...arm(shoulderR, -1, rArm[0], rArm[1], rArm[2], rArm[3]),
      ...leg(add(pelvis, [0.1, -0.02, 0]), 1, lLeg[0], lLeg[1]),
      ...leg(add(pelvis, [-0.1, -0.02, 0]), -1, rLeg[0], rLeg[1]),
    ].map((p) => [p[0], p[1] - 1.05, p[2]]);
  }

  // ── molecule (MoleculeForge): caffeine, heavy atoms ─────────────────────
  function caffeine() {
    const atoms = [];
    const bonds = [];
    const r = 0.7;
    // Six-membered ring, vertices at 30° + 60°k; ring atoms N1 C2 N3 C4 C5 C6.
    const hexEl = ["C", "N", "C", "N", "C", "C"];
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + (k * Math.PI) / 3;
      atoms.push({ el: hexEl[k], p: [r * Math.cos(a) - 0.35, r * Math.sin(a), 0] });
      bonds.push([k, (k + 1) % 6, k % 2 === 0 ? 2 : 1]);
    }
    // Fused five-membered ring on the right edge (atoms 0 and 5 shared).
    const A = atoms[5].p, B = atoms[0].p;
    const mid = mul(add(A, B), 0.5);
    const out = [1, 0, 0];
    const n7 = add(add(B, mul(out, 0.62)), [0, 0.12, 0]);
    const n9 = add(add(A, mul(out, 0.62)), [0, -0.12, 0]);
    const c8 = add(mid, mul(out, 1.05));
    atoms.push({ el: "N", p: n7 }, { el: "C", p: c8 }, { el: "N", p: n9 });
    bonds.push([0, 6, 1], [6, 7, 2], [7, 8, 1], [8, 5, 1]);
    // Substituents: two carbonyl O, three methyl C.
    const sub = (i, el, len, order) => {
      const p = atoms[i].p;
      const center = i <= 5 ? [-0.35, 0, 0] : mid;
      const d = [p[0] - center[0], p[1] - center[1], 0];
      const n = Math.hypot(d[0], d[1]);
      atoms.push({ el, p: add(p, mul([d[0] / n, d[1] / n, 0], len)) });
      bonds.push([i, atoms.length - 1, order]);
    };
    sub(1, "C", 0.55, 1); // N-methyl
    sub(2, "O", 0.5, 2);
    sub(3, "C", 0.55, 1);
    sub(4, "O", 0.5, 2);
    sub(6, "C", 0.55, 1);
    return { atoms, bonds };
  }

  // ── renderer ────────────────────────────────────────────────────────────
  function mount(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scene = canvas.dataset.scene;
    const root = canvas.closest("[data-graph-root]") || canvas.parentElement;

    let yaw = scene === "skeleton" ? 0.6 : 0.3;
    let pitch = scene === "skeleton" ? 0.12 : 0.5;
    let scrollYaw = 0; // set by main.js from scroll position (GSAP ScrollTrigger)
    let dragging = false;
    let last = null;
    let action = "wave";
    let showAdaptive = true;
    let showShift = false;
    let t = 0;
    let w = 0, h = 0, dpr = 1;

    const mol = scene === "molecule" ? caffeine() : null;

    function colors() {
      const cs = getComputedStyle(canvas);
      return {
        ink: cs.getPropertyValue("--g-ink").trim() || "#1a1714",
        accent: cs.getPropertyValue("--g-accent").trim() || "#e8572a",
        muted: cs.getPropertyValue("--g-muted").trim() || "#8a8076",
        ochre: cs.getPropertyValue("--g-ochre").trim() || "#c98a2b",
      };
    }
    let C = colors();
    const recolor = () => { C = colors(); if (!frame) draw(); };
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", recolor);
    window.addEventListener("themechange", recolor);

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function project(p) {
      const a = yaw + scrollYaw;
      const v = rotX([p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)], pitch);
      const d = 4.2;
      const s = d / (d - v[2]);
      const scale = Math.min(w, h) * (scene === "skeleton" ? 0.38 : 0.3);
      return { x: w / 2 + v[0] * s * scale, y: h / 2 - v[1] * s * scale, z: v[2], s };
    }

    function line(a, b, color, width, alpha, dash) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    function dot(p, r, color, alpha) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const depthAlpha = (z) => 0.45 + 0.55 * Math.max(0, Math.min(1, (z + 1.2) / 2.4));

    function drawSkeleton() {
      if (showShift) {
        for (const off of [-0.16, 0.16]) {
          const ghost = pose(action, t + off).map(project);
          for (const [i, j] of BONES) line(ghost[i], ghost[j], C.muted, 1, 0.35);
        }
      }
      const P = pose(action, t).map(project);
      // floor ring
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = C.muted;
      ctx.setLineDash([2, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k <= 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        const q = project([Math.cos(a) * 0.55, -1.07, Math.sin(a) * 0.55]);
        if (k === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();

      if (showAdaptive) {
        const pulse = reduceMotion ? 1 : 0.75 + 0.25 * Math.sin(t * 3);
        for (const [i, j, wgt] of ADAPTIVE[action]) {
          line(P[i], P[j], C.accent, 1 + wgt * 1.2, 0.25 + 0.6 * wgt * pulse, [4, 4]);
        }
      }
      const order = BONES.map((b) => [b, (P[b[0]].z + P[b[1]].z) / 2]).sort((a, b) => a[1] - b[1]);
      for (const [[i, j], z] of order) line(P[i], P[j], C.ink, 2.2, depthAlpha(z));
      P.map((p, i) => [p, i]).sort((a, b) => a[0].z - b[0].z).forEach(([p, i]) => {
        const r = i === 4 ? 7 : 3.2;
        dot(p, r * p.s * 0.85, i === 4 ? C.ink : C.ink, depthAlpha(p.z));
      });
    }

    function drawMolecule() {
      const P = mol.atoms.map((a) => project(a.p));
      const order = mol.bonds.map((b) => [b, (P[b[0]].z + P[b[1]].z) / 2]).sort((a, b) => a[1] - b[1]);
      for (const [[i, j, o], z] of order) {
        const a = P[i], b = P[j];
        if (o === 2) {
          const dx = b.y - a.y, dy = a.x - b.x;
          const n = Math.hypot(dx, dy) || 1;
          const ox = (dx / n) * 2.2, oy = (dy / n) * 2.2;
          line({ x: a.x + ox, y: a.y + oy }, { x: b.x + ox, y: b.y + oy }, C.ink, 1.6, depthAlpha(z));
          line({ x: a.x - ox, y: a.y - oy }, { x: b.x - ox, y: b.y - oy }, C.ink, 1.6, depthAlpha(z));
        } else {
          line(a, b, C.ink, 1.8, depthAlpha(z));
        }
      }
      mol.atoms.map((a, i) => [a, P[i]]).sort((x, y) => x[1].z - y[1].z).forEach(([a, p]) => {
        const color = a.el === "O" ? C.accent : a.el === "N" ? C.ochre : C.ink;
        const r = (a.el === "C" ? 5 : 6.5) * p.s;
        dot(p, r, color, 1);
      });
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      if (scene === "skeleton") drawSkeleton(); else drawMolecule();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }

    // drag to orbit
    canvas.addEventListener("pointerdown", (e) => {
      dragging = true;
      last = [e.clientX, e.clientY];
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      yaw += (e.clientX - last[0]) * 0.01;
      pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - last[1]) * 0.006));
      last = [e.clientX, e.clientY];
      if (!frame) draw();
    });
    const release = () => { dragging = false; };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);

    // keyboard orbit for people not using a pointer
    canvas.addEventListener("keydown", (e) => {
      const k = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
      if (!k) return;
      e.preventDefault();
      yaw += k[0];
      pitch = Math.max(-1.2, Math.min(1.2, pitch + k[1]));
      if (!frame) draw();
    });

    // controls (skeleton only)
    root.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        action = btn.dataset.action;
        root.querySelectorAll("[data-action]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        if (!frame) draw();
      });
    });
    root.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const on = btn.getAttribute("aria-pressed") !== "true";
        btn.setAttribute("aria-pressed", String(on));
        if (btn.dataset.toggle === "adaptive") showAdaptive = on;
        if (btn.dataset.toggle === "shift") showShift = on;
        if (!frame) draw();
      });
    });

    let frame = 0;
    let prevNow = 0;
    function tick(now) {
      const dt = Math.min((now - prevNow) / 1000, 0.05);
      prevNow = now;
      t += dt;
      if (!dragging) yaw += dt * (scene === "skeleton" ? 0.25 : 0.4);
      draw();
      frame = requestAnimationFrame(tick);
    }
    const run = () => {
      if (frame || reduceMotion || document.hidden) return;
      prevNow = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const halt = () => { cancelAnimationFrame(frame); frame = 0; };

    canvas.setScrollYaw = (v) => { scrollYaw = v; if (!frame) draw(); };

    resize();
    draw();
    let visible = false;
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) run(); else halt();
    }, { rootMargin: "100px" }).observe(canvas);
    document.addEventListener("visibilitychange", () => (document.hidden ? halt() : visible && run()));
    window.addEventListener("resize", () => { resize(); draw(); });
  }

  // Shared with the hero model (js/hero-model.js).
  window.PortfolioShapes = { pose, BONES, caffeine };

  document.querySelectorAll("canvas[data-scene]").forEach(mount);
})();
