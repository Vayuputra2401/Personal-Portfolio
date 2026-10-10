/**
 * Hero backdrop: a stable-fluids solver on raw WebGL2 (no three.js).
 *
 * Stam, "Stable Fluids" (SIGGRAPH 1999): semi-Lagrangian advection, vorticity
 * confinement, Jacobi pressure projection. Drawn over ThreeUI's "Fluid Field"
 * noise shader (github.com/MengTo/threeui, MIT, (c) 2026 Meng To), recoloured
 * to cobalt and ice. Ported from the Chef.ai landing hero.
 *
 * Vayuputra means "son of the wind", so here the wind blows: gusts come in from
 * the left edge on their own, and the cursor (or a finger) stirs the air.
 *
 * - Pauses when the hero is off-screen or the tab is hidden.
 * - prefers-reduced-motion: the field is settled once and drawn as one frame.
 * - No WebGL2: the canvas is removed and the section's own background shows.
 */
(function () {
  "use strict";

  const SIM_RESOLUTION = 128;
  const PRESSURE_ITERATIONS = 20;
  const PRESSURE_RETAIN = 0.8;
  const VELOCITY_DISSIPATION = 0.22;
  const DYE_DISSIPATION = 0.85;
  const CURL_STRENGTH = 26;
  const SPLAT_RADIUS = 0.0024;

  const POINTER_FORCE = 6000;
  const POINTER_DYE = 0.15;
  const GUST_DYE = 0.06;
  const GUST_INTERVAL_MS = 160;
  const MAX_DT = 1 / 60;

  // Cobalt, sky, deep sea, ice. Hues held at 205-218deg: blue, never indigo.
  const PALETTE = [
    [0.16, 0.42, 0.86],
    [0.36, 0.68, 0.96],
    [0.07, 0.22, 0.52],
    [0.82, 0.91, 1.0],
  ];

  // ── GLSL ────────────────────────────────────────────────────────────────
  const BASE_VERT = `#version 300 es
precision highp float;
in vec2 aPosition;
uniform vec2 uTexel;
out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0);
  vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y);
  vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 fragColor;
`;

  const ADVECT_FRAG = `${HEAD}
uniform sampler2D uVelocity; uniform sampler2D uSource;
uniform vec2 uTexel; uniform float uDt; uniform float uDissipation;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexel;
  fragColor = texture(uSource, coord) / (1.0 + uDissipation * uDt);
}`;

  const SPLAT_FRAG = `${HEAD}
uniform sampler2D uTarget; uniform float uAspect; uniform vec3 uColor;
uniform vec2 uPoint; uniform float uRadius;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
  fragColor = vec4(texture(uTarget, vUv).xyz + splat, 1.0);
}`;

  const CURL_FRAG = `${HEAD}
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).y; float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x; float B = texture(uVelocity, vB).x;
  fragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

  const VORTICITY_FRAG = `${HEAD}
uniform sampler2D uVelocity; uniform sampler2D uCurl;
uniform float uCurlStrength; uniform float uDt;
void main() {
  float L = texture(uCurl, vL).x; float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x; float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= uCurlStrength * C;
  force.y *= -1.0;
  vec2 velocity = texture(uVelocity, vUv).xy + force * uDt;
  fragColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
}`;

  const DIVERGENCE_FRAG = `${HEAD}
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).x; float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y; float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) { L = -C.x; }
  if (vR.x > 1.0) { R = -C.x; }
  if (vT.y > 1.0) { T = -C.y; }
  if (vB.y < 0.0) { B = -C.y; }
  fragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

  const SCALE_FRAG = `${HEAD}
uniform sampler2D uTexture; uniform float uValue;
void main() { fragColor = uValue * texture(uTexture, vUv); }`;

  const PRESSURE_FRAG = `${HEAD}
uniform sampler2D uPressure; uniform sampler2D uDivergence;
void main() {
  float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;
  float div = texture(uDivergence, vUv).x;
  fragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`;

  const GRADIENT_FRAG = `${HEAD}
uniform sampler2D uPressure; uniform sampler2D uVelocity;
void main() {
  float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  fragColor = vec4(velocity, 0.0, 1.0);
}`;

  const DISPLAY_FRAG = `${HEAD}
uniform sampler2D uDye; uniform float uHasDye; uniform float uTime; uniform vec2 uResolution;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = vUv;
  uv.x *= uResolution.x / uResolution.y;

  vec3 base = vec3(0.031, 0.039, 0.052);
  vec2 st = uv * 0.7;
  st += vec2(snoise(st + uTime * 0.05), snoise(st - uTime * 0.05)) * 0.3;
  float beam = smoothstep(0.1, 0.8, snoise(vec2(st.x * 1.4 + st.y * 0.6 - uTime * 0.12, uTime * 0.02)));
  vec3 tone = mix(vec3(0.05, 0.16, 0.40), vec3(0.10, 0.30, 0.50), snoise(uv * 1.5 + uTime * 0.1) * 0.5 + 0.5);
  vec3 color = base + tone * beam * 0.26;

  vec3 dye = texture(uDye, vUv).rgb * uHasDye;
  color += dye / (1.0 + dye);

  // Keep the copy column legible: darken the left, where the headline sits.
  float shade = smoothstep(0.85, 0.05, vUv.x) * smoothstep(1.0, 0.25, vUv.y);
  color *= 1.0 - 0.5 * shade;

  fragColor = vec4(color, 1.0);
}`;

  // ── solver ──────────────────────────────────────────────────────────────
  function createFluid(canvas, dyeResolution) {
    const gl = canvas.getContext("webgl2", {
      alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power",
    });
    if (!gl || gl.isContextLost()) return null;

    const floatTargets = Boolean(
      gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"),
    );

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || "shader compile failed");
      }
      return shader;
    }

    let vert;
    try { vert = compile(gl.VERTEX_SHADER, BASE_VERT); } catch (e) { return null; }

    function program(frag) {
      const p = gl.createProgram();
      gl.attachShader(p, vert);
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
      gl.bindAttribLocation(p, 0, "aPosition");
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(p) || "program link failed");
      }
      const uniforms = {};
      const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) {
        const name = gl.getActiveUniform(p, i).name;
        uniforms[name] = gl.getUniformLocation(p, name);
      }
      return { program: p, uniforms };
    }

    let P;
    try {
      P = {
        display: program(DISPLAY_FRAG), advect: program(ADVECT_FRAG), splat: program(SPLAT_FRAG),
        curl: program(CURL_FRAG), vorticity: program(VORTICITY_FRAG), divergence: program(DIVERGENCE_FRAG),
        scale: program(SCALE_FRAG), pressure: program(PRESSURE_FRAG), gradient: program(GRADIENT_FRAG),
      };
    } catch (e) {
      return null;
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const owned = [];
    function target(w, h) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const t = { tex, fbo, w, h, texel: [1 / w, 1 / h] };
      owned.push(t);
      return complete ? t : null;
    }
    function double(w, h) {
      const a = target(w, h), b = target(w, h);
      if (!a || !b) return null;
      const d = { read: a, write: b, swap() { const t = d.read; d.read = d.write; d.write = t; } };
      return d;
    }
    function resolution(size) {
      let aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (aspect < 1) aspect = 1 / aspect;
      const min = Math.round(size), max = Math.round(size * aspect);
      return gl.drawingBufferWidth > gl.drawingBufferHeight ? [max, min] : [min, max];
    }

    let velocity = null, dye = null, pressure = null, divergence = null, curl = null;
    let simulated = false;

    function buildTargets() {
      for (const t of owned) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }
      owned.length = 0;
      simulated = false;
      if (!floatTargets) return;
      const [sw, sh] = resolution(SIM_RESOLUTION);
      const [dw, dh] = resolution(dyeResolution);
      velocity = double(sw, sh);
      pressure = double(sw, sh);
      divergence = target(sw, sh);
      curl = target(sw, sh);
      dye = double(dw, dh);
      simulated = Boolean(velocity && pressure && divergence && curl && dye);
    }

    function use(p) { gl.useProgram(p.program); return p.uniforms; }
    function tex(unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t.tex); return unit; }
    function blit(t) {
      if (t) { gl.viewport(0, 0, t.w, t.h); gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); }
      else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width === w && canvas.height === h && (simulated || !floatTargets)) return;
      canvas.width = w;
      canvas.height = h;
      buildTargets();
    }

    function splat(x, y, dx, dy, color) {
      if (!simulated) return;
      const aspect = canvas.width / canvas.height;
      const radius = aspect > 1 ? SPLAT_RADIUS * aspect : SPLAT_RADIUS;
      const u = use(P.splat);
      gl.uniform2f(u.uTexel, velocity.read.texel[0], velocity.read.texel[1]);
      gl.uniform1f(u.uAspect, aspect);
      gl.uniform2f(u.uPoint, x, y);
      gl.uniform1f(u.uRadius, radius);
      gl.uniform1i(u.uTarget, tex(0, velocity.read));
      gl.uniform3f(u.uColor, dx, dy, 0);
      blit(velocity.write); velocity.swap();
      gl.uniform1i(u.uTarget, tex(0, dye.read));
      gl.uniform3f(u.uColor, color[0], color[1], color[2]);
      blit(dye.write); dye.swap();
    }

    function step(dt) {
      if (!simulated) return;
      const tx = velocity.read.texel;
      let u;

      u = use(P.curl);
      gl.uniform2f(u.uTexel, tx[0], tx[1]);
      gl.uniform1i(u.uVelocity, tex(0, velocity.read));
      blit(curl);

      u = use(P.vorticity);
      gl.uniform2f(u.uTexel, tx[0], tx[1]);
      gl.uniform1i(u.uVelocity, tex(0, velocity.read));
      gl.uniform1i(u.uCurl, tex(1, curl));
      gl.uniform1f(u.uCurlStrength, CURL_STRENGTH);
      gl.uniform1f(u.uDt, dt);
      blit(velocity.write); velocity.swap();

      u = use(P.divergence);
      gl.uniform2f(u.uTexel, tx[0], tx[1]);
      gl.uniform1i(u.uVelocity, tex(0, velocity.read));
      blit(divergence);

      u = use(P.scale);
      gl.uniform2f(u.uTexel, tx[0], tx[1]);
      gl.uniform1i(u.uTexture, tex(0, pressure.read));
      gl.uniform1f(u.uValue, PRESSURE_RETAIN);
      blit(pressure.write); pressure.swap();

      u = use(P.pressure);
      gl.uniform2f(u.uTexel, tx[0], tx[1]);
      gl.uniform1i(u.uDivergence, tex(1, divergence));
      for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
        gl.uniform1i(u.uPressure, tex(0, pressure.read));
        blit(pressure.write); pressure.swap();
      }

      u = use(P.gradient);
      gl.uniform2f(u.uTexel, tx[0], tx[1]);
      gl.uniform1i(u.uPressure, tex(0, pressure.read));
      gl.uniform1i(u.uVelocity, tex(1, velocity.read));
      blit(velocity.write); velocity.swap();

      u = use(P.advect);
      gl.uniform2f(u.uTexel, tx[0], tx[1]);
      gl.uniform1f(u.uDt, dt);
      gl.uniform1i(u.uVelocity, tex(0, velocity.read));
      gl.uniform1i(u.uSource, tex(0, velocity.read));
      gl.uniform1f(u.uDissipation, VELOCITY_DISSIPATION);
      blit(velocity.write); velocity.swap();

      gl.uniform1i(u.uVelocity, tex(0, velocity.read));
      gl.uniform1i(u.uSource, tex(1, dye.read));
      gl.uniform1f(u.uDissipation, DYE_DISSIPATION);
      blit(dye.write); dye.swap();
    }

    function render(time) {
      const u = use(P.display);
      gl.uniform2f(u.uTexel, 1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight);
      gl.uniform1f(u.uTime, time);
      gl.uniform2f(u.uResolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1f(u.uHasDye, simulated ? 1 : 0);
      if (simulated) gl.uniform1i(u.uDye, tex(0, dye.read));
      blit(null);
    }

    gl.disable(gl.BLEND);
    resize();
    return { resize, splat, step, render };
  }

  // ── backdrop ────────────────────────────────────────────────────────────
  const canvas = document.getElementById("hero-fluid");
  const surface = document.getElementById("home");
  if (!canvas || !surface) return;

  const narrow = window.innerWidth < 768;
  // Touch screens have no hover to stir the air, so the wind carries more colour.
  const coarse = window.matchMedia("(pointer: coarse)").matches || narrow;
  const fluid = createFluid(canvas, narrow ? 256 : 512);
  if (!fluid) {
    canvas.remove();
    return;
  }
  surface.classList.add("has-fluid");

  const pick = () => PALETTE[Math.floor(Math.random() * PALETTE.length)];
  const tint = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

  // A gust enters from the left edge and drifts slightly upward, like air
  // coming off a field.
  const gust = (strength) => {
    const s = strength || 1;
    fluid.splat(
      0.0,
      0.15 + Math.random() * 0.8,
      (280 + Math.random() * 260) * s,
      (Math.random() - 0.35) * 140,
      tint(pick(), GUST_DYE * s * (coarse ? 1.8 : 1)),
    );
  };

  for (let i = 0; i < 7; i++) gust(1.7);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    for (let i = 0; i < 110; i++) {
      if (i % 8 === 0) gust();
      fluid.step(MAX_DT);
    }
    fluid.render(0);
    window.addEventListener("resize", () => { fluid.resize(); fluid.render(0); });
    return;
  }

  let prev = null;
  let hue = 0;
  surface.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    if (prev) {
      const aspect = rect.width / rect.height;
      let dx = x - prev.x;
      let dy = y - prev.y;
      if (aspect < 1) dx *= aspect; else dy /= aspect;
      if (dx !== 0 || dy !== 0) {
        hue = (hue + 0.02) % PALETTE.length;
        fluid.splat(x, y, dx * POINTER_FORCE, dy * POINTER_FORCE, tint(PALETTE[Math.floor(hue)], POINTER_DYE));
      }
    }
    prev = { x, y };
  }, { passive: true });
  surface.addEventListener("pointerleave", () => { prev = null; });

  // A click or tap releases a burst in every direction.
  surface.addEventListener("pointerdown", (e) => {
    if (e.target.closest("a, button")) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      fluid.splat(x, y, Math.cos(a) * 520, Math.sin(a) * 520, tint(pick(), 0.12));
    }
  });

  let frame = 0;
  let visible = true;
  let last = performance.now();
  let sinceGust = 0;
  const start = last;

  const tick = (now) => {
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;
    sinceGust += dt * 1000;
    if (sinceGust > GUST_INTERVAL_MS) { sinceGust = 0; gust(); }
    fluid.step(dt);
    fluid.render((now - start) / 1000);
    frame = requestAnimationFrame(tick);
  };
  const run = () => {
    if (frame || !visible || document.hidden) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };
  const halt = () => { cancelAnimationFrame(frame); frame = 0; };

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) run(); else halt();
  }).observe(canvas);
  document.addEventListener("visibilitychange", () => (document.hidden ? halt() : run()));
  window.addEventListener("resize", () => fluid.resize());

  run();
})();
