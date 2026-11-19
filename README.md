# PIXEL RIFT ARENA

2D pixel-art HTML5 fighting game. TypeScript strict · Phaser 3 · Vite · headless deterministic combat simulation · vitest.

## Status

Development is phase-based. See [docs/IMPLEMENTATION-STATUS.md](docs/IMPLEMENTATION-STATUS.md) for the honest Complete/Partial/Not-Implemented matrix, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system boundaries, [docs/ROADMAP.md](docs/ROADMAP.md) for remaining phases.

Current state: **Phases 1–3 (core engine, combat engine, character system) implemented and unit-tested. 42/42 tests green, typecheck clean, production build green.** Includes 2 fighters (Rift Brawler / Volt Blade), skills + ultimates + projectiles + clean-hit passives, Character Select, FSM bot that uses skills. Everything else (9 more maps, survival/boss AI, multiplayer server, full Combat Lab, audio) is **not implemented** yet and is not claimed to work. See [docs/IMPLEMENTATION-STATUS.md](docs/IMPLEMENTATION-STATUS.md).

## Commands

```bash
npm install        # install all workspaces
npm run dev        # dev server -> http://localhost:5173
npm run build      # production bundle -> client/dist/
npm run preview    # serve the production bundle
npm run test       # vitest run (headless sim tests)
npm run typecheck  # tsc on shared -> client -> server
npm run sprites    # regenerate procedural sprite sheets + animation manifest
npm run server     # multiplayer backend (NOT IMPLEMENTED YET — scaffold only)
```

## Controls (default, rebindable in Settings)

| Action | P1 | P2 |
|---|---|---|
| Move | A / D | ← / → |
| Crouch | S | ↓ |
| Jump | Space | ↑ |
| Dash | ShiftLeft | ShiftRight |
| Guard | J | Numpad1 |
| Light / Medium / Heavy | U / I / O | Numpad4 / 5 / 6 |

## Layout

```
client/    Phaser rendering, scenes, UI, procedural sprite tools, game data (JSON)
server/    WebSocket backend (scaffold — Phase 7)
shared/    types, constants — imported by client, server and tests
tests/     vitest suites against the headless simulation
docs/      architecture, roadmap, implementation status
```

The combat simulation (`BattleSim`, `FighterSim`, physics world) is pure TypeScript with zero Phaser imports and runs at 60 Hz fixed timestep. The same code drives the client, the unit tests, and will drive the future authoritative server.
