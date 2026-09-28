# Thermal landscape

This branch adds a smooth, live, signed heat field to En Croissant's shared board. White cools toward blue; Black heats toward red. It is a material-weighted spatial model, not a Stockfish evaluation or a fluid simulation.

## Use

1. Build and open En Croissant using the existing desktop setup below.
2. Open an analysis board or a game from your database.
3. Click **Heatmap** in the top player bar and enable **Thermal landscape**.
4. Move pieces or step through the game. The field follows the current position.
5. Drag your side's piece over a legal destination to preview the resulting position without adding a move or changing Stockfish's input. Drop to commit. Move outside the board or cancel to restore the committed field.

Promotion drag previews use a queen and show a label. The existing promotion dialog still controls the actual move. Premoves and position-editing drags do not generate hypothetical legal previews. Completed position edits do update the field. The overlay does not capture mouse/touch events.

Settings are stored locally. Reset defaults disables the map. Queen 10, rook 5, bishop 3, knight 3, pawn 1, king 3. King weight is visual influence, not exchange value. Opacity changes visibility; spread changes directional width; decay controls weakening with distance; fixed scale sets the symmetric saturation threshold. Values are clamped to safe finite ranges. The scale never automatically changes between positions.

## Local development

Clone the `feature/thermal-landscape` branch of this repository and open it in VS Code. Use Node compatible with upstream Vite 8 (the implementation was tested with Node 24.19.0) and pnpm 10, matching the upstream CI workflow. Install with `pnpm install --frozen-lockfile`. Run `pnpm test` and `pnpm build-vite` for tests and the frontend build. Use `pnpm dev` for the Tauri desktop application or `pnpm build` for the native executable.

The desktop build also requires the platform's Tauri prerequisites, including Rust/Cargo and, on Windows, the C++ build tools and WebView2. The upstream README links to Tauri's platform-specific instructions. A successful Vite build alone is not a desktop build.

Reuse your existing Stockfish executable and `LumbrasGigaBase2025-06.db3` through En Croissant's existing settings and database browser. No schema migration, database re-encoding or engine changes are included.

## Model and extension boundary

`model.ts` converts occupancy into signed source kernels and directional primitives. Sliding rays end at the first occupied square, including defended pieces. Pawn influence uses diagonal attack destinations; knights have destination lobes with no connecting travel path. Pins do not suppress geometric heat. Source kernels have radius 0.45 squares; directional contributions start at half the signed piece weight and decay spatially. The axial envelope fades over half a square at a ray endpoint. Smoothing describes a continuous visual field, not additional legal attacks.

`field.ts` exports the backend contract:

- `setPosition(fen, settings)` replaces the source state.
- `advance(seconds)` advances a time-dependent model; the initial model does nothing here.
- `reset()` releases current field state.
- `getField()` returns a square Float32Array field or null for unavailable input.
- `animated` optionally enables the renderer's time loop. The current backend is static and only calculates on input changes.

Values are ordered rank 1 to rank 8, each row file a to h. The renderer owns orientation, fixed signed colour mapping, opacity, resolution scaling and short transitions. A future fluid solver can implement this interface and reuse chess source generation. It must keep dimensions consistent during a rendered transition and implement deterministic reset. No dependency on the game tree or Stockfish belongs in the model.

`preview.ts` clones and plays validated chessops moves. `useHeatmapPreview.ts` observes native Chessground drags without mutating committed game state. The canvas is a sibling outside Chessground's owned DOM, between board background and native pieces/highlights.

## Verification record

- Baseline: 40 existing tests passed; frontend type check and Vite build passed.
- Final: **68 tests passed** across 12 files; `npm run build-vite` passed (including TypeScript checking); `npm run lint` completed with **0 errors and 52 warnings** across the existing application. Tests cover signed symmetry, weight scaling, blockers, destinations, finite settings, model lifecycle, fixed colour mapping, legal previews including castling/en passant/promotion, cancellation and drag-unmount cleanup, persistence, and native board/canvas integration in jsdom.
- Independent review found two drag-lifecycle issues. Both were reproduced with failing tests, fixed, and rerun successfully.
- Field timing on this Linux executor, Node 24.19.0, 128x128, 100 samples: starting position median 9.13 ms / p95 11.14 ms; sparse open position median 5.69 ms / p95 7.30 ms. These measure calculation only, not browser frame rate or the user's PC.
- Native Tauri build and startup were not run: Cargo is unavailable in the executor.
- Visual browser check timed out. Pixel appearance, native device input, actual database loading and the user's Stockfish installation remain local acceptance checks. Unit/DOM tests are not a substitute for these checks.
- The existing frontend build emits chunk-size/plugin-timing warnings. The environment's pnpm 11 generated build-approval configuration incompatible with the project's pnpm 10 setup; that generated change was removed. Validation used the installed locked dependencies with npm scripts/local executables; no dependency versions or lockfiles changed.

## Local acceptance checks

Enable the map, load a database game and step forward/backward. Confirm a continuous field with readable pieces and unchanged colour scale. Drag to legal and illegal destinations; cancel, leave the board, flip and resize. Check capture, castling, en passant and promotion. Verify that Stockfish analyses committed positions only, and close a board during dragging. Check mouse and touch if both are used. Report visual or native issues with a FEN and reproduction steps.

## Implementation decisions
- Added the user-approved optional time-stepping model boundary; the initial backend remains static. A future dynamic solver still needs its own numerical validation.
- Used an isolated sibling worktree to preserve the original checkout; no existing user changes were overwritten.
- Used npm scripts with the installed locked dependency tree for verification because pnpm 11 attempted to rewrite the pnpm 10 build-approval configuration. The repository configuration was restored. Local pnpm 10 installation remains a separate environment check.
- Native startup, database/engine checks, touch-device behavior and visual QA remain unverified rather than inferred from DOM tests. No minor review findings were deferred.
