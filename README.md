# Pathikreet Chowdhury — portfolio

https://vayuputra2401.github.io/Personal-Portfolio/

Static site: `index.html`, `css/site.css`, `js/*.js`. No build step; GitHub Pages serves it as is.

## What's in it

| File | What it does |
|---|---|
| `js/fluid.js` | Hero background. A stable-fluids solver (Stam 1999) on raw WebGL2, drawn over ThreeUI's "Fluid Field" shader (MIT, Meng To). Wind gusts in from the left on its own; the cursor or a tap stirs it. Pauses off-screen; reduced motion draws one settled frame; no WebGL2 means a plain ink background. |
| `js/graph3d.js` | A few-KB 3D renderer on Canvas 2D (no three.js). Draws the Anatomy is Free skeleton (bones, BRASP's fixed left/right shifts, body regions) and a caffeine molecule for MoleculeForge. Drag or arrow keys to orbit. |
| `js/main.js` | GSAP + ScrollTrigger + SplitText motion (masked line reveals, count-ups, scroll-linked 3D orbit), with an IntersectionObserver fallback. Also the Akasha incident replay, the Chef.ai recipe graph, the "Aligned but Inert" chart, the work accordion, project filter, ⌘K / `/` command menu and the EmailJS contact form. |
| `js/cube.js` | Hero: the site's six sections as faces of one CSS 3D cube (no WebGL). Drag or flick to turn it, it settles on the nearest face; the face in front lights up and opens its section on click or Enter; the list under it turns the cube; arrow keys work. GSAP entrance, pauses off-screen, reduced motion = no idle spin. |

## Design rules

Same anti-slop rules as Chef.ai: two surfaces (ink `#0d0c0b`, paper `#f3eee6`) and one accent (ember `#e8572a`, always with ink text on it). Instrument Serif for display, Geist for UI, Geist Mono uppercase for labels. No gradient text, glow blobs, glass, purple, icon tiles, hover lifts or hover shadows. Every section sits in 2D boxes: 2px borders with solid offset shadows (ember on the lead card), pill labels and chips — the same language as the GitHub profile README. Light and dark follow the system and can be switched with the toggle in the nav (remembered per browser).

## Run locally

```bash
python3 -m http.server 8000   # → http://localhost:8000
```
