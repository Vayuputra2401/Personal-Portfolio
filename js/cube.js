/**
 * Hero cube: the site's six sections as the faces of one box.
 *
 * - Drag (or flick) to turn it; it keeps spinning a little, then settles on
 *   the nearest face. Left alone, it idles slowly.
 * - Whichever face points at you is highlighted and says where it goes.
 *   Clicking it (or Enter) scrolls there. A drag never counts as a click.
 * - The list under it turns the cube to a section; arrow keys turn it 90°.
 * - Plain CSS 3D transforms, no WebGL. Pauses off-screen. Reduced motion:
 *   no idle spin, turns are instant.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-cube]");
  if (!root) return;
  const stage = root.querySelector(".cube-stage");
  const cube = root.querySelector(".cube");
  const faces = Array.from(root.querySelectorAll(".face"));
  const pills = Array.from(root.querySelectorAll("[data-cube-go]"));
  const live = root.querySelector(".cube-live");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Cube angles (deg) that put each face in front: rotateX, rotateY.
  const TARGET = [[-20, -26], [-20, -116], [-20, -206], [-20, 64], [-70, -26], [70, -26]];
  const LABEL = faces.map((f) => f.querySelector(".face-kick").textContent);

  const st = { rx: -18, ry: -28, vx: 0, vy: 0 };
  let dragging = false;
  let moved = 0;
  let last = null;
  let idleAt = performance.now();
  let front = -1;
  let tween = null;

  // ── which face is in front: transform each face's normal by the cube's
  //    rotation and take the one pointing most toward the viewer (+z).
  const faceMatrices = faces.map((f) => new DOMMatrixReadOnly(getComputedStyle(f).transform));
  function frontFace() {
    const m = new DOMMatrix().rotateSelf(st.rx, 0, 0).rotateSelf(0, st.ry, 0);
    let best = 0, bestZ = -Infinity;
    faceMatrices.forEach((fm, i) => {
      const n = m.multiply(fm).transformPoint(new DOMPoint(0, 0, 1, 0));
      if (n.z > bestZ) { bestZ = n.z; best = i; }
    });
    return best;
  }

  // The buddy sitting on top reads these: is-turning (his arm pushes) and
  // is-tilted (cube on its top/bottom face, so he hops off).
  let prevRy = st.ry, turnTimer = 0;
  function markMotion() {
    if (Math.abs(st.ry - prevRy) > 0.04) {
      root.classList.add("is-turning");
      clearTimeout(turnTimer);
      turnTimer = setTimeout(() => root.classList.remove("is-turning"), 160);
    }
    prevRy = st.ry;
    root.classList.toggle("is-tilted", Math.abs(st.rx) > 42);
  }

  function render() {
    cube.style.transform = `translateZ(calc(var(--s) * -0.5)) rotateX(${st.rx}deg) rotateY(${st.ry}deg)`;
    markMotion();
    const f = frontFace();
    if (f !== front) {
      front = f;
      faces.forEach((el, i) => el.classList.toggle("is-front", i === f));
      pills.forEach((b, i) => b.setAttribute("aria-pressed", String(i === f)));
      live.textContent = `Facing: ${LABEL[f]} — click it or press Enter to open`;
    }
  }

  // ── turning to a face: shortest way round on Y ───────────────────────────
  function turnTo(i, duration = 0.9) {
    let [tx, ty] = TARGET[i];
    ty += Math.round((st.ry - ty) / 360) * 360;
    st.vx = st.vy = 0;
    if (tween) tween.kill?.();
    if (reduceMotion || !window.gsap) {
      st.rx = tx; st.ry = ty; render();
      return;
    }
    tween = window.gsap.to(st, { rx: tx, ry: ty, duration, ease: "power3.out", onUpdate: render });
  }
  function settle() {
    // nearest face to where the spin ended
    turnTo(frontFace(), 0.7);
  }

  // ── pointer: drag with inertia ───────────────────────────────────────────
  stage.addEventListener("pointerdown", (e) => {
    dragging = true;
    moved = 0;
    last = [e.clientX, e.clientY, performance.now()];
    if (tween) tween.kill?.();
    stage.setPointerCapture(e.pointerId);
    root.classList.add("is-dragging");
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const now = performance.now();
    const dx = e.clientX - last[0], dy = e.clientY - last[1];
    const dt = Math.max(1, now - last[2]);
    moved += Math.abs(dx) + Math.abs(dy);
    st.ry += dx * 0.45;
    st.rx = Math.max(-90, Math.min(90, st.rx - dy * 0.45));
    st.vy = (dx * 0.45) / dt * 16;
    st.vx = (-dy * 0.45) / dt * 16;
    last = [e.clientX, e.clientY, now];
    render();
  });
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    idleAt = performance.now();
    root.classList.remove("is-dragging");
    // Pointer capture sends the click to the stage, not the face link, so a
    // tap is resolved here: the front face opens, any other face turns to it.
    if (moved <= 6 && e && e.type === "pointerup") {
      const hit = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.classList?.contains("face"));
      const i = faces.indexOf(hit);
      if (i === front) faces[i].click();
      else if (i >= 0) turnTo(i);
      return;
    }
    if (reduceMotion) settle();
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);

  // A drag is not a click.
  faces.forEach((f, i) => f.addEventListener("click", (e) => {
    if (moved > 6) { e.preventDefault(); return; }
    if (i !== front) { e.preventDefault(); turnTo(i); }
  }));

  pills.forEach((b) => b.addEventListener("click", () => { idleAt = performance.now(); turnTo(+b.dataset.cubeGo); }));

  stage.addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === "Enter" || k === " ") { e.preventDefault(); faces[front].click(); return; }
    const step = { ArrowLeft: [0, 90], ArrowRight: [0, -90], ArrowUp: [-90, 0], ArrowDown: [90, 0] }[k];
    if (!step) return;
    e.preventDefault();
    idleAt = performance.now();
    if (tween) tween.kill?.();
    if (step[0]) {
      const t = st.rx + step[0] > 45 ? 70 : st.rx + step[0] < -45 ? -70 : -20;
      if (window.gsap && !reduceMotion) tween = window.gsap.to(st, { rx: t, duration: 0.6, ease: "power3.out", onUpdate: render });
      else { st.rx = t; render(); }
    } else {
      const ty = Math.round((st.ry + 26 + step[1]) / 90) * 90 - 26;
      if (window.gsap && !reduceMotion) tween = window.gsap.to(st, { ry: ty, rx: Math.abs(st.rx) > 45 ? -20 : st.rx, duration: 0.6, ease: "power3.out", onUpdate: render });
      else { st.ry = ty; render(); }
    }
  });

  // ── loop: inertia, then idle drift ───────────────────────────────────────
  let raf = 0, visible = true, prev = performance.now(), coasting = false;
  function tick(now) {
    const dt = Math.min(50, now - prev) / 16;
    prev = now;
    if (!dragging && (Math.abs(st.vx) > 0.02 || Math.abs(st.vy) > 0.02)) {
      coasting = true;
      st.ry += st.vy * dt;
      st.rx = Math.max(-90, Math.min(90, st.rx + st.vx * dt));
      st.vx *= Math.pow(0.93, dt);
      st.vy *= Math.pow(0.93, dt);
      render();
    } else if (coasting && !dragging) {
      coasting = false;
      settle();
    } else if (!dragging && !reduceMotion && now - idleAt > 4500 && !(tween && tween.isActive?.())) {
      st.ry -= 0.12 * dt; // slow idle drift
      st.rx += (-20 - st.rx) * 0.02 * dt;
      render();
    }
    raf = requestAnimationFrame(tick);
  }
  const run = () => { if (!raf && visible && !document.hidden) { prev = performance.now(); raf = requestAnimationFrame(tick); } };
  const halt = () => { cancelAnimationFrame(raf); raf = 0; };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? run() : halt(); }).observe(stage);
  document.addEventListener("visibilitychange", () => (document.hidden ? halt() : run()));

  render();

  // Entrance: the cube tumbles in and lands on "Building now".
  if (window.gsap && !reduceMotion) {
    window.gsap.fromTo(st, { rx: -200, ry: 260 }, {
      rx: TARGET[0][0], ry: TARGET[0][1], duration: 1.8, delay: 0.5, ease: "power4.out", onUpdate: render,
      onComplete: () => { idleAt = performance.now(); },
    });
    window.gsap.from(stage, { y: -40, autoAlpha: 0, duration: 1.2, delay: 0.4, ease: "power3.out" });
    window.gsap.from(".cube-nav li", { y: 10, autoAlpha: 0, duration: 0.5, stagger: 0.05, delay: 1.4, ease: "power2.out" });
  } else {
    turnTo(0);
  }
  run();
})();
