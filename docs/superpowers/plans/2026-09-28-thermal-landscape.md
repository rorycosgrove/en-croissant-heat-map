# Thermal Landscape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add a continuous live White-cold/Black-hot field to En Croissant for manual moves, game playback and legal drag previews.

**Architecture:** A pure TypeScript calculator produces a signed Float32Array field from a board position. A Canvas renderer colours it with a fixed scale; an adapter connects the existing board and temporary chessops positions without changing the game tree or engine analysis.

**Tech Stack:** Existing React, TypeScript, chessops, Chessground, Jotai, Mantine, Canvas and Vitest. Preserve Rust/Tauri backend and SQLite format.

**Spec:** `docs/superpowers/specs/2026-09-28-thermal-landscape-design.md` (approved in conversation).

## Global Constraints
- White negative/cold; Black positive/hot; sum before colour mapping.
- Default weights: pawn 1, knight 3, bishop 3, rook 5, queen 10, king 3.
- Source radius 0.45 squares; directional spread 0.30 squares; distance decay 0.25 per square; saturation magnitude 20; initial field resolution 128x128.
- Geometric attacks include defended squares and pinned pieces; pawn influence is diagonal, knight influence is destination-based. Legal preview is separate.
- Fixed symmetric colour scale across moves. Never label field values as centipawns.
- Slider rays stop at the first occupied square; smoothing does not add attacks through blockers.
- Use the existing promotion dialog, database browsing, engine integration and game navigation.
- No native build claims without native build evidence. The user's database and Stockfish executable require a local acceptance check.
- Work on feature/thermal-landscape in rorycosgrove/en-croissant-heat-map; preserve licence; no upstream PR.

## Review Focus
- Invalid FEN during position editing: hide the field and display a brief error; do not crash the board (Task 1/3).
- Corrupt persisted settings: finite clamped defaults, never NaN pixels or infinite work (Task 1/3).
- Pointer cancellation or switching games mid-drag: discard hypothetical state immediately (Task 4).
- Resizing or flipping during preview: no stale coordinates or mirrored temperature (Task 3/4).
- Multiple mounted boards or unmount/remount: independent previews and complete listener/animation cleanup (Task 3/4).

## Files and responsibilities
- Create `src/features/heatmap/model.ts`: settings types/defaults/validation and influence primitives.
- Create `src/features/heatmap/field.ts`: pure primitive sampling and signed field generation.
- Create `src/features/heatmap/preview.ts`: legal clone-and-play, pointer-to-square conversion.
- Create `src/features/heatmap/render.ts`: field-to-RGBA mapping and orientation.
- Create `src/features/heatmap/HeatmapCanvas.tsx`: Canvas lifecycle, resize and transition.
- Create `src/features/heatmap/HeatmapControls.tsx`: enable/reset and settings UI.
- Create `src/features/heatmap/state.ts`: validated persisted settings atom.
- Create `src/features/heatmap/useHeatmapPreview.ts`: drag lifecycle and preview state.
- Modify `src/chessground/Chessground.tsx`: optional heatmap configuration and access to native board state.
- Modify `src/components/boards/Board.tsx`: pass authoritative FEN and mode, expose controls.
- Modify `src/styles/chessgroundBaseOverride.css`: scoped overlay stacking only.
- Create tests alongside the new modules as `*.test.ts` / `*.test.tsx`.
- Create `docs/thermal-landscape.md`: user operation and verification record.

### Task 1: Tested directional field
**Interfaces:** `HeatmapSettings` has enabled, opacity, spread, decay, scale and weights (Record<Role,number>). `DEFAULT_SETTINGS: HeatmapSettings`; `sanitizeSettings(input: unknown): HeatmapSettings`; `buildPrimitives(board: Board, settings: HeatmapSettings): InfluencePrimitive[]`; `sampleField(primitives: InfluencePrimitive[], x: number, y: number): number`; `calculateField(fen: string, settings: HeatmapSettings, resolution?: number): {values: Float32Array; resolution: number} | null`. Coordinates are square-centred, a1=(0.5,0.5), h8=(7.5,7.5).

- [ ] Establish an isolated feature checkout. Install locked dependencies with `pnpm install --frozen-lockfile`; run baseline `pnpm test` and `pnpm build-vite`. Record failures unchanged from upstream. Do not modify lockfile to conceal baseline errors.
- [ ] Write failing tests for default weights, source signs, colour-swap negation, weight proportionality, cancellation, blockers, knight landing areas, pawn direction and board edges. Include these concrete assertions:
  ```ts
  expect(DEFAULT_SETTINGS.weights.queen).toBe(10);
  expect(DEFAULT_SETTINGS.weights.king).toBe(3);
  expect(sanitizeSettings({ scale: Number.NaN }).scale).toBe(20);
  expect(calculateField('invalid', DEFAULT_SETTINGS)).toBeNull();
  ```
  For a white rook at a1 and blocker a3, assert generated ray ends at a3 and no ray samples exist at a4-a8. For a white pawn e4, assert destinations d5/f5 and no e5. For a knight e4, assert exactly c3,c5,d2,d6,f2,f6,g3,g5. Compare samples before colour mapping for weight doubling and colour negation.
- [ ] Run `pnpm exec vitest run src/features/heatmap/field.test.ts`; confirm the missing implementation causes failure.
- [ ] Implement model/field interfaces. Represent sliding influence as ray segments with decay along distance and Gaussian transverse spread, evaluated directly or with length-normalized quadrature. Represent source/knight/pawn/king destinations as kernels. Use board occupancy, not move legality, for geometry. Return null for malformed FEN. Clamp settings to finite nonnegative weights 0..30, spread 0.1..1.5, decay 0..2, scale 1..100, opacity 0..1; defaults enabled=false, opacity=0.65. Limit resolution to integer 16..256.
- [ ] Run focused tests and verify 64/128/256 resolutions produce consistent sampled values within numerical tolerance, not differing strength from quadrature density. Commit `feat: calculate weighted chess temperature fields`.

### Task 2: Legal hypothetical positions
**Interfaces:** `previewMove(fen: string, from: Square, to: Square): {fen: string; promotes: boolean} | null`; `squareAtPointer(clientX: number, clientY: number, bounds: {left:number;top:number;width:number;height:number}, orientation: Color): Square | null`.

- [ ] Write failing preview tests: e2-e4 updates only a clone; e2-e5 returns null; captures remove the target; en passant removes the off-destination pawn; castling moves both pieces; promotions preview queen and set promotes=true; pinned illegal moves return null. Include input-FEN immutability, invalid FEN, outside/zero-size bounds and both orientations.
- [ ] Run `pnpm exec vitest run src/features/heatmap/preview.test.ts` and confirm failure before implementation.
- [ ] Implement with chessops clone/legal validation/play/serialization. Normalize Chessground castling destination conventions through the existing chessops integration; test both applicable encodings. Promotion previews always use queen; committed choice remains existing application behaviour.
- [ ] Run focused tests. Assert coordinate expectations: centre of top-left cell yields a8 for White orientation and h1 for Black orientation. Commit `feat: preview legal positions for thermal analysis`.

### Task 3: Continuous board rendering and settings
**Interfaces:** `fieldToRgba(values: Float32Array, scale: number, opacity: number): Uint8ClampedArray`; `HeatmapCanvas({fen, orientation, settings}: {fen:string;orientation:Color;settings:HeatmapSettings}): React.ReactNode`; `HeatmapControls(): React.ReactNode`; `heatmapSettingsAtom` persisted under a new heatmap-specific key.

- [ ] Write failing renderer tests: equal numerical field values produce equal colours across unrelated frames; negative values blue, positive red, zero neutral; saturation clamps symmetrically. Test settings reload/reset and corrupt input recovery. Canvas lifecycle tests spy on context/ResizeObserver/animation hooks rather than assert fake visual correctness.
- [ ] Run `pnpm exec vitest run src/features/heatmap` and confirm new tests fail.
- [ ] Implement Canvas at 128x128 field resolution with smooth high-DPI enlargement and a 120ms interpolation between signed fields. Use immediate updates for reduced motion. A disabled map must skip calculation and cancel animation; unmount disposes observers and frames. Catch invalid field input and render a brief accessible error outside the board.
- [ ] Integrate optional overlay into Chessground without adding React-managed children to its mutable board subtree. Inspect installed Chessground DOM lifecycle and choose a stable sibling layer: transparent board background over a separate background/Canvas stack when enabled, with highlights and pieces above it. Restore existing background when disabled. Verify against native redraw, piece fading and annotations.
- [ ] Add Mantine controls using the settings atom: enabled, opacity, spread, decay, scale, six weights and reset; add colour legend and heuristic label. Use existing localization conventions for new UI strings. Read authoritative currentNode.fen for manual moves and game playback.
- [ ] Test two mounted boards, orientation, resize, disabled calculation, remount cleanup, settings reset and current-FEN rerenders using React DOM test utilities. Run focused tests and `pnpm build-vite`. Commit `feat: render configurable thermal landscape on the board`.

### Task 4: Drag preview and end-to-end verification
**Interfaces:** `useHeatmapPreview({fen, api, enabled, editing, viewOnly}: {fen:string;api:Api|null;enabled:boolean;editing:boolean;viewOnly:boolean}): {previewFen:string|null;promotes:boolean}`; optional wrapper heatmap configuration carries the full FEN, settings and mode. Canvas reads previewFen ?? authoritativeFen.

- [ ] Write failing lifecycle tests: legal destination changes preview; repeated pointer events in the same square calculate once; invalid hover restores authoritative field; drop/cancel/blur/outside clears state; changed FEN resets; editing/viewOnly/premoves do not preview; orientation/resize invalidates cached destination; separate boards have independent state.
- [ ] Run focused tests and confirm failure before implementation.
- [ ] Implement using observed native Chessground drag state and pointer/touch lifecycle, not guessed APIs. Inspect installed type definitions before coupling. Validate from/to through Task 2, cache by full FEN/from/to/orientation/settings, and never dispatch store moves or Stockfish analysis for a preview. Clear on pointerup, pointercancel, touchend, touchcancel, blur, disable, FEN replacement and unmount. Show `Queen promotion preview` when needed.
- [ ] Run all feature tests, full `pnpm test`, `pnpm build-vite` and lint. Diagnose regressions; record independently reproduced baseline failures separately. Preserve actual outputs in the verification record.
- [ ] Run an interactive desktop acceptance check where Tauri is available: open game from database, step forward/back, drag/cancel, capture, flip and resize, castle, en passant and promotion. Check readable pieces/highlights, continuous field and fixed scale. Confirm Stockfish follows committed positions only. If unavailable, mark these checks explicitly unrun and provide exact local procedure.
- [ ] Measure calculator timing over 100 iterations of a full starting board and a middlegame at resolution 128; report environment, median and p95. Profile before adding GPU/worker complexity. Review screenshots at desktop and narrow board sizes; do not use the generated concept as proof of real rendering.
- [ ] Write usage/setup documentation including safe reuse of the existing database, engine path configuration, the geometric-control caveat, slider meanings and native verification limitations. Commit `feat: update thermal landscape during legal drags`.
- [ ] Request whole-branch code review, resolve concrete findings and rerun affected checks. Push feature branch and provide its URL and exact local checkout instructions. Do not merge into master unless requested.

## Execution handoff
Recommend native execution in this session: these four tasks share small stable interfaces and one existing board integration. An independent whole-branch review follows implementation. Subagent-driven execution is an alternative with a separate implementer/reviewer cycle per task. Await the user's plan review and execution choice under the selected Superpowers workflow.

