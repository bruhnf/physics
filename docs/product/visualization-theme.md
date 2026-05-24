# Visualization Theme — Design Decision

**Decided:** 2026-05-24  
**Status:** Approved — apply to all new UI and experiment work

---

## Default Theme: Minimalist Sci-Fi

The primary visual language for the entire app is a dark, minimalist sci-fi aesthetic — think NASA mission control meets a polished iOS app.

**Visual characteristics:**
- Near-black backgrounds (`#0d1117` or similar dark base)
- Cool blue accent palette: `#185FA5` (deep) → `#378ADD` (primary) → `#B5D4F4` (light)
- HUD-style overlays: variable readouts, status indicators, telemetry panels
- Geometric, flat UI elements — no skeuomorphic decoration
- Monospaced or geometric sans-serif typography
- Letter-spacing (`0.06–0.1em`) on labels and readouts for the technical feel
- Space as the ambient backdrop wherever context allows

**Semantic color use:**
- Blue — interactive elements, primary accent
- Green (`#1D9E75`) — success, stable state, orbit achieved, target reached
- Amber — warning, approaching a limit, unstable
- Red — failure, invalid input, experiment failed

**Rules:**
- This theme is the default for ALL UI: menus, navigation, level select, experiment control panels, score displays, settings
- No gradients on UI chrome elements — flat fills only
- No rounded decorative elements; geometric precision reinforces the aesthetic
- Animations should feel precise and intentional, not bouncy or playful

---

## Augmentation Theme: Realistic Simulation

Used selectively — applied only to the **simulation canvas** (the interior of an experiment scene) when showing a physical environment helps the player understand the concept being taught.

**Visual characteristics:**
- Naturalistic environments: terrain, sky, physical materials (wood, metal, rock, water)
- Environment shifts to match the physics context:
  - Earth — blue sky, green terrain, standard atmospheric haze
  - Moon — grey regolith, black sky, sharp shadows, no atmosphere
  - Mars — red/ochre terrain, hazy salmon sky, lower gravity feel
  - Deep space — star field, no environmental reference frame
- Physical objects look like real things (a cannon looks like a cannon, a rocket looks like a rocket)
- Feels like Kerbal Space Program meets a polished mobile game

**Rules:**
- NEVER used for navigation, menus, or control panels — those stay sci-fi
- The surrounding HUD and control panels remain in the sci-fi theme at all times
- Think of it as the player looking through a *window* into the physical world while remaining in a sci-fi lab
- Only reach for this style when the environment itself teaches something (e.g. showing the Moon's surface directly reinforces that gravity is weaker there)

---

## Resource Conservation — Critical Requirement

This game is inherently CPU and memory intensive. Physics simulations, animations, and real-time variable feedback all compete for the same budget. Resource discipline must be a first-class concern from day one.

**Mandatory practices:**

**Rendering:**
- Sci-fi chrome elements are flat geometric shapes — keep them that way; do not introduce textures, shadows, or blur on UI elements
- The simulation canvas is the only place expensive rendering is acceptable, and only when the experiment requires it
- Avoid rendering anything off-screen; cull objects that are outside the visible simulation bounds
- Prefer vector/canvas drawing (Skia) over raster image assets wherever possible

**Physics engine (Matter.js):**
- Only run the physics engine while an experiment is actively in progress — pause or stop it on menus, between levels, and when the app is backgrounded
- Limit the number of simultaneous rigid bodies; design experiments with the minimum body count needed to teach the concept
- Use simple collision shapes (circles, rectangles) over complex polygons unless visual accuracy demands it

**Animation (Reanimated):**
- Run animations on the UI thread via worklets — never drive animations from the JS thread
- Avoid animating properties that trigger layout recalculation (width, height, margin); animate transform and opacity only

**Assets:**
- Compress all image assets; prefer SVG/vector for backgrounds and environmental art where feasible
- Lazy-load experiment assets — do not preload all levels at startup
- Unload simulation assets when a player exits an experiment

**General:**
- Profile on a mid-range device (not just a flagship) — that is the performance target
- Any new experiment or UI component should be assessed for frame-rate impact before merging
