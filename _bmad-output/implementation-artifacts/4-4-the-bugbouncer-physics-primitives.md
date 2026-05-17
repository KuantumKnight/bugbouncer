# Story 4.4: The @bugbouncer/physics Primitives

Status: done

## Story

As a Developer,
I want to import Kill-Switches and Phase-Locked Rendering primitives from `@bugbouncer/physics`,
so that I can manually enforce stability, knowing I can safely remove them later.

## Acceptance Criteria

1. **Given** the `@bugbouncer/physics` library is installed, **When** I use its primitives (FR12) and later run the "Eject" path (FR14), **Then** the primitives are removed automatically, **And** there are zero compilation errors left behind (NFR-R3).

## Tasks / Subtasks

- [x] Task 1: Path Mapping and Foundation Registry (AC1, FR12)
  - [x] Subtask 1.1: Map `@bugbouncer/physics` import alias in `tsconfig.json` to `./src/hooks/physics/index.ts` to allow seamless imports.
  - [x] Subtask 1.2: Implement central `PhysicsRegistry` in `src/hooks/physics/registry.ts` with lock states, kill states, listener subscription, and central notification registry.
- [x] Task 2: Hooks Implementation (AC1, FR12)
  - [x] Subtask 2.1: Implement `useKillSwitch` hook in `src/hooks/physics/hooks.ts` with state sync and registry subscription.
  - [x] Subtask 2.2: Implement `usePhaseLockedRendering` hook in `src/hooks/physics/hooks.ts` that locks rendering based on `is_ready` state and tracks states in the central registry.
- [x] Task 3: React Components & Library Index Exports (AC1, FR12)
  - [x] Subtask 3.1: Implement `<KillSwitch />` wrapper component in `src/hooks/physics/components.tsx` rendering child or fallback.
  - [x] Subtask 3.2: Implement `<PhaseLockedRendering />` wrapper component in `src/hooks/physics/components.tsx`.
  - [x] Subtask 3.3: Add exports in `src/hooks/physics/index.ts`.
- [x] Task 4: Eject CLI Script Implementation (AC1, FR14, NFR-R3)
  - [x] Subtask 4.1: Implement `scripts/eject-physics.ts` using regular expressions to unwrap JSX tags (`<KillSwitch>`, `<PhaseLockedRendering>`) and replace hook invocations with literal `false` values, ensuring compiler compatibility on eject.
- [x] Task 5: End-to-End Verification & Story Closeout (AC1, NFR-R3)
  - [x] Subtask 5.1: Create unit and rendering integration tests for all hooks, components, and the regex ejection script.
  - [x] Subtask 5.2: Complete all 94 project tests successfully.

## Dev Notes

- **Path mapping**: `@bugbouncer/physics` is resolved seamlessly using tsconfig path mapping.
- **Eject script compiler-safety**: The eject script preserves typescript compiler safety by converting hook results directly to a static `false` boolean literal rather than deleting variables completely, avoiding undefined reference compile errors.

### Complete Status

- **Task 1 Complete**: central `PhysicsRegistry` fully implemented, offering robust listener subscription and lock/kill switch tracking.
- **Task 2 Complete**: hooks `useKillSwitch` and `usePhaseLockedRendering` fully functional with automatic registry subscriptions.
- **Task 3 Complete**: React rendering components `<KillSwitch>` and `<PhaseLockedRendering>` built with flexible fallback interfaces, properly exported via library index.
- **Task 4 Complete**: Automated `eject-physics.ts` CLI script implemented, verified to cleanly strip imports, recursively unwrap JSX components, and replace hooks with `false` literals to maintain type-check safety.
- **Task 5 Complete**: Full 94-test suite passing successfully with 100% success rate.

### File List

- `tsconfig.json`
- `src/hooks/physics/registry.ts`
- `src/hooks/physics/hooks.ts`
- `src/hooks/physics/components.tsx`
- `src/hooks/physics/index.ts`
- `src/hooks/physics/__tests__/registry.test.ts`
- `src/hooks/physics/__tests__/hooks.test.ts`
- `src/hooks/physics/__tests__/components.test.tsx`
- `scripts/eject-physics.ts`
- `scripts/__tests__/eject.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-4-the-bugbouncer-physics-primitives.md`

## Dev Agent Record

### Agent Model Used

Antigravity (BMad Create Story Workflow)

### Completion Notes List

- Implemented standard `@bugbouncer/physics` library package paths, registry subscriptions, useKillSwitch hooks, usePhaseLockedRendering hooks, and associated JSX rendering elements.
- Implemented and verified recursive JSX unwrapping regex-based eject compiler-safe CLI script.
- All 94 test cases pass flawlessly.
