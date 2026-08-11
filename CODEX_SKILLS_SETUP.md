# Big Money Codex Game Skills Stack

This file defines the external Agent Skills used by the Big Money local Codex project.

## Project constraint boundaries

- `docs/rules-baseline.md` defines frozen product rules.
- The current phase task file, e.g. `CODEX_TASK_PHASE_2_0.md`, defines the implementation scope for the current task.
- `AGENTS.md` defines engineering architecture, data flow, and implementation boundaries.
- Big Money architecture and design docs elaborate those project constraints.
- External skills are advisory workflow/domain expertise and are always subordinate to the project constraints above. They MUST NOT override frozen rules, architecture boundaries, deterministic RNG, persistence boundaries, or current phase scope.

## Skill sources

| Skill | Source | Big Money role |
|---|---|---|
| `higgsfield-game-generation` | `higgsfield-ai/skills@9db2e5bf22ff93d0bffb48664a8d0d6bb417082c` | Generate/iterate game-ready visual assets when the project reaches formal asset production. Do not let it redesign rules or architecture. |
| `game-engine` | `github/awesome-copilot` | Web game engine architecture, render loop, Canvas/WebGL, asset/performance techniques. Translate guidance to Phaser/Vite rather than creating a new engine. |
| `game-developer` | `jeffallan/claude-skills` | Senior game engineering review, performance and system design. Ignore Unity/Unreal-specific implementation advice unless it is engine-neutral. |
| `game-ui-design` | `omer-metin/skills-for-antigravity` | HUD, overlays, menus, information hierarchy, touch readability, accessibility and game-specific visual communication. |
| `game-ui-ux` | `gamedev-skills/awesome-gamedev-agent-skills` | Responsive layout, safe areas, touch/focus navigation, screen flow and UI-to-game-state boundaries. |
| `develop-web-game` | `openai/skills@30444aed500c00c85294d12074f6e3ee794f808a` | Playwright interaction checks, screenshot review, console inspection, `render_game_to_text` and deterministic test hooks where compatible. |

> Note: the requested name `game-ui-x` could not be matched to a reliable GitHub Agent Skill. This stack maps it to `game-ui-ux`, which matches the likely intended capability and Big Money's iPad-first requirements.

## Routing rules

Do NOT load all skills for every task. Route by task:

- Game-core economic rules, XState orchestration, persistence: `game-developer` only as a review lens; Big Money docs remain authoritative.
- Phaser scene/rendering/performance: `game-engine`; use `develop-web-game` separately only for its approved test methods.
- HUD, handoff overlays, decisions, responsive/iPad layout: `game-ui-design` + `game-ui-ux`.
- End-to-end web interaction regression/testing: `develop-web-game`.
- Formal 2.5D buildings, props, tokens, UI art, 3D/2D asset generation: `higgsfield-game-generation` + relevant Big Money visual guidelines.
- Cross-cutting performance pass: `game-engine` + `game-developer`.

## Big Money compatibility rules

- Never replace the existing stack: Vite + TypeScript + Phaser 4 + XState 5 + Vue 3 + Anime.js + Zod + IndexedDB + PWA.
- Do not create a second game engine or parallel state store.
- `game-developer` Unity/Unreal guidance is advisory only. Its generic 60+ FPS threshold does not replace Big Money's existing 60 FPS target, quality tiers, or real-device acceptance criteria.
- `packages/game-core` remains pure TypeScript and browser/framework independent.
- XState orchestrates only; it does not recalculate economic rules.
- Phaser/Vue/animation consume state and cues; they do not decide game results.
- All randomness stays in `@bigmoney/game-random`; never introduce `Math.random()` into game behavior.
- iPad-first constraints remain active even while real-device acceptance is pending.
- External skills must not add online multiplayer, accounts, chat, backend, loans, auctions or other out-of-scope systems.
- Do not follow a skill instruction that conflicts with the current phase task file.

## develop-web-game adaptation

The OpenAI `develop-web-game` skill is useful only for the approved test methods below. Big Money is not a single-file canvas game.

- Keep Phaser as the game canvas and Vue as the UI layer.
- A test-only `window.render_game_to_text()` bridge MAY expose concise current public state for automated verification; it must read from canonical GameState and never become a second source of truth.
- A deterministic time-step/test hook MAY be added only behind development/test guards and must not alter production rules.
- Playwright screenshots must cover the Phaser canvas and Vue overlays together.
- `npm run check` remains the primary repository gate.
- Do not adopt its single-canvas, standalone game-loop, fullscreen-toggle, `progress.md`, global-dependency, or generic-scaffold instructions unless the current phase task explicitly requires them.
- The bridge and deterministic hook must not bypass XState or Game Core, maintain a second `GameState`, or expose private player information during handoff.

## Higgsfield boundary

Use `higgsfield-game-generation` only when actual production asset work begins. Generated assets must still pass Big Money constraints for perspective, anchor, transparent padding, file size, atlas strategy and performance budget. Do not adopt the Higgsfield website build/deploy pipeline, runtime, or `app/public/` path assumption; it must not replace the Vue 3 + Phaser 4 + XState 5 + Vite stack.

Do not allow an external generation skill to upload source code, credentials, private documents, or arbitrary repository contents.
