# Implementation Status (honest matrix)

Legend: ✅ Complete · 🟡 Partial · ❌ Not Implemented

## Phase 1 — Core Engine ✅

| Feature | State | Notes |
|---|---|---|
| Fixed-timestep game loop (60 Hz sim, per-frame render) | ✅ | injectable rAF/clock, headless `advance()` |
| Deterministic AABB physics (solids, one-way, movers, rider carry) | ✅ | unit-tested incl. mover carry & one-way landing |
| Map modifier zones (gravity/friction/movement/force) | ✅ | engine support + map_01 uses them; zone *visuals* partial |
| Input system (19 actions, buffers, TTL, rebindable) | ✅ | keyboard; gamepad/touch ❌ |
| Settings system with persistence | ✅ | localStorage adapter, conflict detection, export/import, reset |
| Scene management | ✅ | Boot, MainMenu, Battle, Training, Settings all reachable & functional |
| Camera | 🟡 | follow mid-point, bounds, shake; dynamic zoom / dead zone / split rules ❌ |
| Menu items with real function | 🟡 | VS Battle, Combat Lab, Settings functional; Online Arena + Character Collection are labeled "planned (see roadmap)" (rule 23.7) |

## Phase 2 — Combat Engine ✅

| Feature | State | Notes |
|---|---|---|
| Attacks with startup/active/recovery + per-frame hitboxes | ✅ | 5 attack types for fighter_001, full frame data in JSON |
| Hit detection (facing, range, invuln, active-window-only) | ✅ | 18 unit tests |
| Guard (high/low coverage, chip 10%, guard meter, guard break 45f) | ✅ | incl. facing-side bug fixed by tests |
| Perfect guard (6f window) punishing attacker | ✅ | |
| Combo engine (scaling 0.88^n floor 0.2, hitstun deterioration, knockback escalation, anti-infinite at 9 hits, 30f reset) | ✅ | |
| Hitstop by attack weight (3/6/9/14f) | ✅ | |
| Energy + cooldowns | ✅ | dash/attack cooldowns; skills themselves ❌ (see Phase 3) |
| Rounds (99s timer, KO, best-of, round reset) | ✅ | |
| Cancel system (chain at active-end, dash-cancel, guard-cancel) | ✅ | cancel windows data-driven |
| Throws, projectiles, parry, dodge/roll, wall bounce, ground bounce | ❌ | Phase 3+ |
| Skills 1–4, ultimates, passives wired into sim | ❌ | passive declared in fighter_001.json but **not applied** by sim |

## Content

| Item | State |
|---|---|
| Characters | 1/20 (fighter_001 "Rift Brawler") |
| Skills | 0/6 per character set (basics + air + dash_attack only) |
| Maps | 1/10 (map_01 Neon Rooftop — ground, 3 one-way platforms, 1 mover, 3 modifier zones) |
| Animations | 16 anims / 186 frames / 4 effects for fighter_001 (procedural, temp assets by design) |
| Audio | None (no AudioSystem; only settings skeleton) |
| Bots / AI | None |
| Multiplayer | None (server scaffold only) |
| Combat Lab depth | Partial: passive dummy + frame-data overlay; no sub-labs, no dummy options |
| Save of stats/history | ❌ (settings save only) |

## Known issues / caveats

- **No browser playtest yet** — sandbox has no headless browser; all verification is via vitest + `vite build`. First real manual playtest pending.
- Procedural sprites are explicitly temporary stand-ins (replaceable via manifest) — not claimed to be final art.
- Bundle is ~1.25 MB minified (Phaser) — code-splitting deferred to Phase 10.
- Passive 'momentum' is data-only: displayed by data layer, no gameplay effect in sim yet.
- Frame-advantage display, dummy options, and physics sandbox in training: not implemented.

## Tests run

`npm run test` — 29 passing across 3 suites (loop 4, physics 7, combat 18). Tests caught and forced fixes for 8 real engine bugs (physics tunneling, shallow-floor teleport, guard direction inversion, cooldowns never ticking, sim constructor stats reference, accumulator epsilon, spawn alignment, guard-break pushback drift).
