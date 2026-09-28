# En Croissant thermal landscape

Status: approved; initial implementation on feature/thermal-landscape. Native/visual acceptance checks are recorded in docs/thermal-landscape.md.

## Goal and scope
Extend En Croissant rather than build a separate chess application. Display one smooth signed temperature field beneath readable pieces: White cools, Black heats. Support manual exploration, game playback, and live legal-destination drag previews. Reuse existing Stockfish and SQLite game database integration, including the user's LumbrasGigaBase2025-06.db3. No database migration or engine modification.

## Inspected integration
Upstream: https://github.com/franciscoBSalgueiro/en-croissant
Inspected commit: 23f83142fcbd4d3af60a524855defe8c9a5703fe.

- src/components/boards/Board.tsx supplies currentNode.fen, orientation, legal destinations and promotion handling to the board.
- src/chessground/Chessground.tsx wraps the native Chessground API and manages its DOM container.
- chessops already supplies position handling. Vitest is configured through the package test script.
- Rust/Tauri remains the native backend. The current execution environment has Node and pnpm but no cargo executable on PATH.

## Model
Temperature(x,y) = Black influence(x,y) - White influence(x,y).
Default adjustable piece weights: pawn 1, knight 3, bishop 3, rook 5, queen 10, king 3. King 3 is a proposed visualization weight, not an exchange value.

Each piece supplies a compact smooth source at its occupied square plus a directional field. Rooks, bishops and queens emit along their movement rays, stopping at the first occupied square, including that endpoint as an attacked or defended square. Beyond the blocker there are no further directional samples. Knights emit disconnected smooth lobes at on-board attacked destinations, without fictitious travel paths. Kings emit adjacent-square influence. Pawns emit diagonal attack influence; forward pawn movement is not treated as control.

The field represents geometric attacks/defence, including pinned pieces, not a count of legal moves. This keeps both sides comparable independently of whose turn it is. Legal move validation is a separate preview concern. Position affects influence through occupied location, blockers and available attack geometry; this release does not add arbitrary positional bonuses.

Use smoothly decaying kernels around source and directional samples in board coordinates. Initial parameters: source radius 0.45 squares, directional transverse spread 0.30 squares, exponential distance decay 0.25 per square. Normalize sampling density so more ray samples do not create greater total strength merely through resolution changes. Clip computation at the board edges; do not wrap. Visual smoothing may extend sideways near blockers but must not create another attack ray through them.

Sum signed contributions before colour mapping. Use a fixed symmetric scale (initial saturation magnitude 20 influence units), blue through neutral to red, with no per-position normalization. Neutral can represent cancellation or inactivity. No implied centipawn or probability interpretation.

## Rendering and controls
Implement a pure field calculator, separate Canvas rendering, and a thin board adapter. Start at 128x128 samples with smooth enlargement. Render above board background and below pieces, highlights and annotations, with pointer-events disabled. Verify stacking against native Chessground DOM and keep its owned children intact. Support both board orientations, resize and high-DPI displays.

A compact Heatmap control provides enabled state, opacity, spread, distance decay, six piece weights, fixed scale and reset defaults. Persist settings using existing application state patterns. Clearly label White/cold, neutral, Black/hot, and heuristic influence. Keep Stockfish evaluation separate.

Recompute on position/settings changes and on changed legal hover destination, never continuously for unchanged pointer coordinates. Interpolate successive fields briefly; respect reduced-motion settings. Skip computation when disabled.

## Move and preview behaviour
The existing game-tree FEN is authoritative. Stepping games, loading PGNs/database games and completed moves update the same renderer.

During an active drag, translate pointer position using board orientation and bounds. For a legal destination, clone the actual position and play the move through chessops. Render that hypothetical result without writing the game tree, changing the real board or sending a hypothetical position to Stockfish. Handle captures, en passant and castling through the chess library. Preview promotion as queen with a visible promotion-preview label; the existing promotion choice determines the committed result. Invalid destination, leaving the board, cancellation, lost focus, drop or changed game position clears preview. Ignore premoves and editing-mode drags for legal previews; committed editing changes may still update the field.

## Validation and acceptance
1. Baseline tests/frontend build before changes; native build when Rust and platform libraries are available.
2. Calculator tests: colour/sign symmetry, weight proportionality before colour saturation, exact cancellation, finite bounded output, ray blockers, pawn direction, knight destinations and boundary clipping.
3. Preview tests: legal/illegal destination, pinned move rejection, captures, en passant, castling, promotion and restoration without tree mutation.
4. Integration tests: manual moves and playback share updates; flip/resize preserve alignment; overlay preserves dragging/clicking; disable stops computation.
5. Visual inspection: continuous fields across square boundaries, readable pieces, fixed scale across moves and legal drag preview restoring correctly.
6. Measure calculation/render timing with a full board; report observed timings rather than promise unmeasured frame rates.
7. Check native startup, database game load and Stockfish analysis on a supported desktop. The user's actual database and executable are unavailable in this environment; do not claim those checks passed without evidence.

## Repository and delivery
Destination: https://github.com/rorycosgrove/en-croissant-heat-map, feature branch feature/thermal-landscape. The user created the repository and connector write access has been verified. Preserve upstream history and GPL licence. Do not overwrite an existing fork or publish changes upstream. Deliver source, tests, setup instructions and an honest validation record.

## Review
The core visual requirements were agreed in conversation. This document makes the additional model defaults explicit for review. Next stage after review: implementation plan and execution under the selected Superpowers workflow.

## Approved extension boundary
After specification approval, the user confirmed implementing the existing smooth field first while supporting future simulation. HeatModel exposes setPosition, advance, reset and getField; an optional animated flag enables time stepping. The initial directional backend is static. Source generation remains separate from rendering and board interaction. No fluid solver is part of this release.
