# 🚀 Space Valley

**A gravity-driven, multi-planet 3D exploration game**

Suit up. Pick your world. Feel the gravity change under your feet.

> **▶ Play it now:** [\[github link\]](https://sapienzainteractivegraphicscourse.github.io/final-project-space-valley/)

---

## Overview

Space Valley is a browser-based 3D exploration game built with **Three.js** and JavaScript. You play an astronaut dropped onto a celestial body of the solar system, feel free to walk, jump, look around, and throw objects across a landscape scattered with obstacles of every size.

What makes each visit different is the planet you choose. Every world in the game runs on its own **real astronomical gravity value**, that visibly reshapes how the character moves. Jump height, stride length, walking cadence, and even how "floaty" or "heavy" each step feels are all derived live from the current planet's gravity, so Mercury never feels like Jupiter, and the Moon never feels like Earth.

A dynamic sun tracks across the sky, casting real-time shadows that shift in length and softness as it rises and sets, while a procedural starfield and a planet-specific atmosphere color the horizon behind you.

---

## Key Features

- 🪐 **9 explorable worlds** — Mercury, Venus, Earth, the Moon, Mars, Jupiter, Saturn, Uranus, and Neptune — each with its own real gravity value, sky color, sun intensity, and ground texture.
- 🏃 **Gravity-aware movement** — walk speed, stride length, jump arc, and even a subtle low-gravity "bounce" in your gait all scale with the current planet's gravity in real time.
- 🧱 **Full physics-based collision system** — static obstacles block and redirect movement with wall-sliding, low obstacles can be jumped and landed on top of, and a tunneling-safe correction pass keeps you from ever getting stuck inside geometry.
- 🔴 **Throwable projectiles** — launch physical spheres that arc under the current planet's gravity, bounce off the ground and off obstacles, and eventually despawn to keep things tidy.
- 🎥 **Dual camera modes** — switch freely between first-person and a fully orbit-able third-person camera (look up/down included), both of which stay collision-aware so the view never clips through walls or dives underground.
- 🌗 **Dynamic day/night cycle** — a moving sun drives real-time shadow casting, atmosphere color shifts, and star visibility, with Earth featuring its own dedicated dusk/day/night sky gradient.
- 🖥️ **Mission-console styled UI** — a NASA-inspired planet selection screen with live telemetry styling to kick off your mission.

---

## How to Play — Controls

| Category | Key | Action |
|---|---|---|
| **Movement** | `W` `A` `S` `D` | Move forward / left / backward / right |
| | Mouse | Look around (first & third person) |
| | `Space` | Jump |
| **View** | `V` | Toggle between first-person and third-person camera |
| **Action** | `F` | Throw a projectile in the direction your character is facing |
| | Click (on canvas) | Lock the mouse pointer to start looking around |

> 💡 **Tip:** your jump, stride, and throw arc all behave differently depending on which planet you're standing on — try the same moves on the Moon and then on Jupiter to feel the difference.

---

## Tech Stack & Tools

**Core engine**
- [Three.js](https://threejs.org) — WebGL 3D rendering, scene graph, lights, shadow mapping, raycasting, geometry
- JavaScript (ES6 Modules) — no framework, no bundler required, just clean modular game logic

**Rendering & lighting**
- `THREE.DirectionalLight` with shadow mapping (shadow-mapped sun, tuned bias / normalBias for crisp, non-detached shadows)
- Procedural starfield built from raw `BufferGeometry` points
- Custom per-planet atmosphere & fog configuration

**Physics & gameplay logic**
- Custom-built lightweight physics module (no external physics engine) handling gravity, jumping, AABB collision resolution, sphere-vs-box projectile bouncing, and camera collision via raycasting + 3D overlap correction

**Animation**
- Procedural, code-driven limb and camera animation (no external animation library required for the character)

**UI / Front-end**
- HTML + CSS, custom "mission control" design system
- Google Fonts: `Orbitron`, `Space Grotesk`, `JetBrains Mono`

**Browser APIs**
- Pointer Lock API for mouselook
- `requestAnimationFrame`-driven game loop

---

## Credits

Built with [Three.js](https://threejs.org). Fonts courtesy of [Google Fonts](https://fonts.google.com).

Have fun, watch your step on Jupiter, and don't forget to look up once in a while — the sky changes with you. 🌌