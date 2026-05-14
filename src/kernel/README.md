# BugBouncer Causal Kernel

The Causal Kernel is the core runtime of BugBouncer, responsible for intercepting, observing, and recording application state changes with a <50ms latency budget.

## Architectural Constraints

### 1. Mandatory snake_case
All internal trace metadata, SharedWorker payloads, and SQLite Ledger keys **MUST** use `snake_case`. 
- **Reason**: Optimizes zero-copy performance via `SharedArrayBuffer` and ensures deterministic key alignment with the persistence layer.
- **Enforcement**: Linting and runtime validation will reject camelCase keys.

### 2. Kernel Panic Protocol
If an unhandled exception occurs within the kernel or any observer, it must be caught and routed through `kernel.panic()`.
- **Behavior**: The kernel will immediately detach from the target application, flushing all remaining traces to the Ledger before terminating the bridge.
- **Safety**: This prevents the kernel from ever blocking the target application's main thread.

### 3. Isolation
The kernel operates in a separate execution context from the UI (Next.js App).
- Communication occurs via `postMessage` (traces) and tRPC (registry).
- Heavy processing (DAG mapping, logic synthesis) happens in the `SharedWorker`.

## Directory Structure
- `observer/`: Fiber and DOM mutation observers.
- `proxy/`: Network and Fetch interception logic.
- `bridge/`: SharedArrayBuffer and Atomics bridge to workers.
