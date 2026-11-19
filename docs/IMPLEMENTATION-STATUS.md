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
| Scene management | ✅ | Boot, MainMenu, CharacterSelect, Battle, Training, Settings all reachable & functional |
| Camera | 🟡 | follow mid-point, bounds, shake; dynamic zoom / dead zone / split rules ❌ |
| Menu items with real function | 🟡 | Character Select routes VS Battle / VS AI / Combat Lab with real pick flow; Online Arena + Character Collection labeled "planned (see roadmap)" (rule 23.7) |

## Phase 2 — Combat Engine ✅

| Feature | State | Notes |
|---|---|---|
| Attacks with startup/active/recovery + per-frame hitboxes | ✅ | 5 attack types per fighter, full frame data in JSON |
| Hit detection (facing, range, invuln, active-window-only) | ✅ | 18 unit tests |
| Guard (high/low coverage, chip 10%, guard meter, guard break 45f) | ✅ | incl. facing-side bug fixed by tests |
| Perfect guard (6f window) punishing attacker | ✅ | |
| Combo engine (scaling 0.88^n floor 0.2, hitstun deterioration, knockback escalation, anti-infinite at 9 hits, 30f reset) | ✅ | |
| Hitstop by attack weight (3/6/9/14f) | ✅ | |
| Energy + cooldowns | ✅ | dash/attack/skill/ultimate cooldowns |
| Rounds (99s timer, KO, best-of, round reset) | ✅ | |
| Cancel system (chain at active-end, dash-cancel, guard-cancel, skill-cancel) | ✅ | skill-cancel injects slots 1–4 or ult (5) from cancel window |
| Throws, parry, dodge/roll, wall bounce, ground bounce | ❌ | Phase 4+ |
| Skills (melee strike / projectile / buff) + ultimates | ✅ | SkillDef data-driven; buff/proj trigger exactly at startup→active transition |
| Projectiles (sim + rendering + solid collision + lifetime) | ✅ | pooled sim array ≤ 24; per-tick collision vs hurtbox/solids; ProjectileLayer looping fx sprites; despawn poof |
| Clean-hit passives applied by sim | ✅ | trigger 'cleanHit' → speed-boost buff w/ per-passive cooldown; sprite tint + energyGlow feedback |

## Phase 3 — Character System & Character Select ✅

| Feature | State | Notes |
|---|---|---|
| Data-driven roster (no character list hardcoded in engine) | ✅ | ROSTER_IDS in DataLoader, profiles from JSON |
| fighter_002 "Volt Blade" (Assassin) | ✅ | distinct stats (SPD 125 / DEF 88), 3 skills, own palette + spiky-hair sprite set |
| Skill validation (dup ids/slots, hitbox/projectile/buff invariants) | ✅ | DataLoader.validateProfiles |
| Ultimate gate (energy cost 100, slot 5) | ✅ | |
| Buff system (speed/attack multipliers, expiry, clear on round reset) | ✅ | FighterSim buff fields; sim applies at startup frame |
| Passive system (trigger, cooldown, effect, stacking) | ✅ | momentum / flowState applied by sim |
| Character Select scene | ✅ | roster grid + animated preview + stats bars + skill/passive info; P1→P2 pick flow; keyboard & mouse |
| Bots use skills | ✅ | projectile at mid-range, melee strike when low HP / opportunistic, ultimate at full energy — all difficulty-seeded |

## Content

| Item | State |
|---|---|
| Characters | 2/20 (fighter_001 "Rift Brawler" Rushdown, fighter_002 "Volt Blade" Assassin) |
| Skills | 6: energyBall (projectile), risingCut (launcher), overdrive (ult buff) / voltDash (invuln strike), arcBolt (projectile), thunderCut (ult strike) |
| Maps | 1/10 (map_01 Neon Rooftop — ground, 3 one-way platforms, 1 mover, 3 modifier zones) |
| Animations | 20 anims × 2 chars / 642 frames; 7 effects per character (incl. auraBurst, energyBall, bolt) |
| Audio | None (no AudioSystem; only settings skeleton) |
| Bots / AI | Partial: FSM bot with skills, 5 seeded difficulties; NO survival/boss/team AI yet |
| Multiplayer | None (server scaffold only) |
| Combat Lab depth | Partial: passive dummy + frame-data overlay; no sub-labs, no dummy options |
| Save of stats/history | ❌ (settings save only) |

## Known issues / caveats

- **Resolution upgrade (fix round 2)**: internal canvas 640×360 → **960×540** (16:9, FIT, nearest). The battle scene renders the world through a camera zoomed 1.5× (identical world framing — same 640×360 view window —, fighters same apparent size) while ALL UI (HUD, menus, text) renders through a dedicated un-zoomed UI camera at 960×540 → text and HUD are ~1.5× sharper than before at the same apparent size. F toggles fullscreen in menu/select/battle/settings.
- **No browser playtest yet** — sandbox has no headless browser; verification is via vitest + `vite build` + a disposable real-Phaser headless harness (since removed) that reproduced and verified the fixes for the freeze bugs below. First real manual playtest pending.
- **Fixed 2025 (freeze round)**: three real bugs caused "pressing attack freezes the page": (1) Phaser keyboard event names are Phaser KeyMap names (`keydown-U`), not `event.code` (`keydown-KeyU`) — battle inputs were dead; BattleScene now wires window DOM listeners on `event.code`; (2) sprite-sheet manifest paths missing the `assets/` prefix → 404 textures → empty/missing animations; (3) playing a nonexistent animation throws mid-frame and kills Phaser's rAF chain → full-page freeze; BootScene skips missing textures/anims, FighterAnimator guards `play()` on `anims.exists`, and BattleScene create/update are wrapped in crash guards that render an on-screen RUNTIME ERROR panel instead of freezing.
- Procedural sprites are explicitly temporary stand-ins (replaceable via manifest) — not claimed to be final art.
- Bundle is ~1.25 MB minified (Phaser) — code-splitting deferred to Phase 10.
- fighter_002 reuses fighter_001's body rig with different palette/hair/skill poses — silhouette work is Phase 4/10 polish.
- Buff indicator is a temporary sprite tint (0xffdd88) + aura burst fx; HUD buff icon pending.
- Frame-advantage display, dummy options, and physics sandbox in training: not implemented.
- Solo control: in VS AI / Combat Lab P1 accepts BOTH WASD and arrow-key bindings (VS BATTLE keeps separate P1/P2 schemes).
- **Skill hotkeys (fix round 2)**: every skill + ultimate now has TWO bound key profiles — the primary (P1: Digit1–4 / H) and a new **alt cluster** right next to the attack keys (P1: K / L / ; / ' / P). Both profiles work simultaneously; rebindable + conflict-checked in Settings → "ALT SKILL KEYS (P1)" (covers saved-settings migration + conflict detection via tests). The battle HUD renders 5 skill slots per player showing the real key labels, dimmed while on cooldown or low energy.

## Tests run

`npm run test` — 51 passing across 6 suites (loop 4, physics 7, combat 18, bot AI 4, skills 9, settings 9: alt-binding defaults, legacy-save migration, conflict detection, alt-key intents). Tests caught and forced fixes for 10 real engine bugs (physics tunneling, shallow-floor teleport, guard direction inversion, cooldowns never ticking, sim constructor stats reference, accumulator epsilon, spawn alignment, guard-break pushback drift, passive trigger-string mismatch, grounded-settle in skill activation paths).

`npm run typecheck` — clean across shared/client/server.
`npm run build` — production build ✓.
