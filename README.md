<p align="center">
  <img src="https://img.shields.io/badge/status-beta-blueviolet?style=for-the-badge" alt="Status: Beta" />
  <img src="https://img.shields.io/badge/next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/react-19-61DAFB?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/typescript-strict-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript Strict" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License: MIT" />
</p>

<h1 align="center">🛡️ BugBouncer</h1>

<p align="center">
  <strong>Research-as-a-Service — Deterministic Stability Verification for Modern SaaS</strong>
</p>

<p align="center">
  <em>Stop debugging ghosts. Start shipping with mathematical confidence.</em>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-the-problem">The Problem</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-features">Features</a> •
  <a href="#-project-structure">Project Structure</a> •
  <a href="#-contributing">Contributing</a>
</p>

---

## 🧠 What Is BugBouncer?

BugBouncer is a **local-first stability engine** that detects invisible architectural failures in Next.js / Supabase / Clerk applications — the kind of bugs that pass TypeScript checks, look correct in development, but silently corrupt state in production.

We call them **Ghost Collisions**: hydration races, orphaned server actions, void payloads, and schema drift that accumulate into a "Zombie State Mountain" — an app that *looks* alive but is architecturally dead.

BugBouncer doesn't just find these bugs. It tells you **why** they exist, delivers **framework-specific fix prompts** ready for Cursor or Bolt, and proves it all with a **causal trace** — a mathematical proof of authority order.

> **Think of it as:** A senior QA engineer who works at 2 AM, never misses a race condition, and hands you the exact code to fix it — all without ever seeing your source code.

---

## 🔥 The Problem

High-velocity founders building with AI-assisted tools (Cursor, Bolt, v0) ship features fast — but introduce **invisible failure modes** even faster:

| Failure Mode | What Happens | Why It's Invisible |
|:---|:---|:---|
| **Orphaned Action** | Server action succeeds, but client state never updates | Network drop occurs *after* server commit |
| **Void Payload** | `.map()` crashes on nullish API response | TypeScript types say it's safe — runtime says otherwise |
| **Hydration Race** | UI flickers or desyncs under latency | Only manifests in production network conditions |
| **URL-State Rot** | Browser back button breaks app state | Query params desync from React state silently |
| **OAuth Bounce** | Auth tokens expire mid-session | Concurrent auth + data fetches create race windows |
| **Schema Drift** | Database schema evolves, client code doesn't | Supabase migrations create invisible type gaps |

**The cost:** 10–15 hours/week of "hidden debugging work." Founders hire senior QA ($15k/mo) or ignore the bugs until they become a refactor mountain that halts all velocity.

**BugBouncer eliminates the research.** You get the fix, not the homework.

---

## ⚡ Quick Start

### Prerequisites

- **Node.js** ≥ 18.17
- **npm** ≥ 9.x
- A [Clerk](https://clerk.com) account (for dashboard authentication)

### Installation

```bash
# Clone the repository
git clone https://github.com/KuantumKnight/bugbouncer.git
cd bugbouncer

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Clerk keys (see below)
```

### Environment Setup

Create a `.env.local` file in the project root:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the BugBouncer dashboard.

### Available Scripts

| Command | Description |
|:---|:---|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Create production build |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run test suite (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

---

## 🔬 How It Works

BugBouncer operates through a three-stage pipeline that runs entirely on your local machine:

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR APPLICATION (Target)                     │
└──────────┬──────────────────┬──────────────────┬────────────────┘
           │                  │                  │
     ┌─────▼─────┐    ┌──────▼──────┐    ┌──────▼──────┐
     │   Fiber    │    │   Network   │    │   Schema    │
     │  Observer  │    │   Proxy     │    │   Drift     │
     │            │    │             │    │  Detector   │
     └─────┬─────┘    └──────┬──────┘    └──────┬──────┘
           │                  │                  │
           └──────────┬───────┘──────────────────┘
                      │
              ┌───────▼────────┐
              │  Causal Kernel │  ← DAG Authority Mapping
              │   (Runtime)    │  ← Phase Mismatch Detection
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │   Stability    │  ← SQLite/OPFS (Local-Only)
              │    Ledger      │  ← AES-256 Encrypted
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │  Fix Generator │  ← Ghost Hooks / Physics Primitives
              │  + RAG Engine  │  ← Cursor-Ready Prompts
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │  Certification │  ← Grade A/B/C Reports
              │    Report      │  ← Causal Trace Proofs
              └────────────────┘
```

### Stage 1: Observe (The Causal Kernel)

The **Causal Kernel** attaches non-blocking observers to your running application:

- **Fiber Observer** — Traverses the React 19 Fiber tree to detect hydration mismatches, state authority conflicts, and render-phase anomalies. Operates via `requestIdleCallback` to stay under the **<50ms overhead budget**.
- **Network Observer** — Intercepts fetch/XHR calls to detect orphaned actions, void payloads, and timing-dependent failures.
- **Schema Drift Detector** — Monitors Supabase schema changes and detects when your client-side types diverge from database reality.

### Stage 2: Analyze (The Stability Ledger)

Every observation is written to a **local SQLite database** (via OPFS) as an immutable trace entry. The ledger:

- Maps component dependencies into a **Directed Acyclic Graph (DAG)**
- Identifies **State Authority** violations (which component "owns" shared state?)
- Correlates traces across async boundaries using deterministic `trace_id` propagation
- **Never leaves your machine** — 100% local data residency, AES-256 encrypted at rest

### Stage 3: Resolve (Fix Delivery)

When a violation is detected, BugBouncer generates:

- **Ghost Hooks** — Zero-dependency, inlined fix wrappers (e.g., `SafeHydration`, `useStableAuth`) that can be copy-pasted into your codebase
- **Physics Primitives** — Production-grade synchronization contracts from `@bugbouncer/physics` (<1KB)
- **Cursor-Ready Prompts** — Framework-specific fix prompts optimized for AI coding assistants
- **Certification Reports** — Notion-compatible Grade A/B/C stability reports with full causal traces

---

## 🏗️ Architecture

### Core Design Principles

| Principle | Implementation |
|:---|:---|
| **Zero-Edit Integration** | Observers attach automatically — no code instrumentation required |
| **Local-First Privacy** | All traces, schemas, and ledger data stay on your machine |
| **Kernel Panic Safety** | BugBouncer never crashes your app — all kernel errors are caught and isolated |
| **100% Ejectability** | Every Ghost Hook is dependency-free — remove BugBouncer, keep the fixes |
| **Deterministic Proofs** | Every fix comes with a causal trace proving *why* it works |

### Technology Stack

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Runtime** | Next.js 16 + React 19 | App Router, Server Components, Turbopack |
| **Language** | TypeScript (Strict) | Type safety across the entire kernel |
| **Auth** | Clerk v7 | Dashboard authentication & workspace management |
| **Persistence** | SQLite (WASM) + OPFS | Local-first stability ledger |
| **Cloud Sync** | Supabase | Optional cloud registry for shared patterns |
| **Styling** | Tailwind CSS v4 | "Clinical Dark" surgical interface |
| **Testing** | Vitest + Testing Library | Unit, integration, and fuzzer tests |
| **Encryption** | Web Crypto API (AES-256-GCM) | At-rest encryption for ledger data |

### System Boundaries

```
┌─────────────────────────────────────────────────┐
│                  LOCAL MACHINE                   │
│                                                  │
│  ┌──────────┐  SharedArrayBuffer  ┌───────────┐ │
│  │  Kernel   │◄──────────────────►│  Ledger   │ │
│  │ (Main     │   Zero-Copy        │  Worker   │ │
│  │  Thread)  │   Atomics          │ (SQLite)  │ │
│  └──────────┘                     └───────────┘ │
│       │                                │         │
│       │ postMessage                    │         │
│       ▼                                ▼         │
│  ┌──────────┐                   ┌───────────┐   │
│  │ Dashboard │                  │  Encrypted │   │
│  │   UI      │                  │   OPFS     │   │
│  └──────────┘                   └───────────┘   │
│                                                  │
├──────────────────────────────────────────────────┤
│              OPTIONAL CLOUD SYNC                 │
│  ┌──────────────┐    ┌────────────────────┐      │
│  │   Supabase    │    │  Anonymized Hashes │      │
│  │  (Registry)   │    │  Only — No Source  │      │
│  └──────────────┘    └────────────────────┘      │
└──────────────────────────────────────────────────┘
```

---

## ✨ Features

### 🔍 Causal Kernel Runtime
- **React 19 Fiber Traversal** — Deep hooks into the reconciliation engine
- **Non-Blocking Observer** — `requestIdleCallback` ensures <50ms overhead
- **DAG Authority Mapping** — Automatically maps component state ownership
- **Phase Mismatch Detection** — Catches hydration races in real-time

### 🧪 Stability Fuzzer
- **20-Point Deterministic Audit Matrix** — Covers Auth, State, Data, and Integration domains
- **Schema-Proxy Fuzzing** — Injects malformed payloads into real hooks
- **PRNG-Seeded Reproducibility** — Same seed = same results, every time
- **Shadow Data Regex Suite** — Detects void payloads and malformed responses
- **URL-State Rot Detection** — Catches query param / React state desyncs

### 🔐 Privacy-First Architecture
- **100% Local Data Residency** — Traces never leave your machine
- **AES-256-GCM Encryption** — Ledger data encrypted at rest via Web Crypto API
- **Structural Hashing** — Only anonymized AST hashes reach the cloud
- **PII Auto-Redaction** — Passwords, tokens, API keys automatically masked
- **Configurable Safe Zones** — Exclude sensitive components from observation

### 📋 Fix Delivery System
- **Ghost Hooks** — Zero-dependency inlined wrappers ready for production
- **Physics Primitives** — `@bugbouncer/physics` synchronization contracts (<1KB)
- **Cursor-Ready Prompts** — AI-assistant optimized fix generation
- **Eject Script** — `npm run eject:physics` removes all BugBouncer primitives cleanly

### 📊 Certification & Reporting
- **Grade A/B/C Reports** — Notion-compatible stability certification
- **Causal Traces** — Mathematical proof of authority order for every issue
- **Audit History** — Persistent record of stability improvements over time

---

## 📁 Project Structure

```
bugbouncer/
├── src/
│   ├── app/                    # Next.js 16 App Router
│   │   ├── api/                # API routes
│   │   ├── layout.tsx          # Root layout with Clerk provider
│   │   ├── page.tsx            # Dashboard landing page
│   │   └── globals.css         # Global styles (Tailwind v4)
│   │
│   ├── kernel/                 # 🧠 The Causal Kernel Runtime
│   │   ├── ast/                # AST parsing, extraction & structural hashing
│   │   │   ├── parser.ts       # TypeScript AST parser
│   │   │   ├── extractor.ts    # Component dependency extractor
│   │   │   ├── hasher.ts       # Structural hash generator
│   │   │   └── types.ts        # AST type definitions
│   │   ├── bridge/             # SharedArrayBuffer + Atomics bridge
│   │   │   └── ledger-client.ts
│   │   ├── config/             # Safe Zones & Exclusion engine
│   │   │   └── engine.ts       # ConfigEngine with mask_payload()
│   │   ├── fuzzer/             # 20-Point Deterministic Fuzzer
│   │   │   ├── index.ts        # Fuzzer orchestrator
│   │   │   ├── hydration.ts    # Hydration race detector
│   │   │   ├── network.ts      # Network failure simulator
│   │   │   ├── coherence.ts    # State coherence validator
│   │   │   ├── url_state.ts    # URL-state rot detector
│   │   │   ├── shadow_data.ts  # Shadow data regex suite
│   │   │   └── prng.ts         # Seeded PRNG for reproducibility
│   │   ├── generator/          # Fix prompt & report generation
│   │   │   ├── certification.ts # Grade A/B/C report builder
│   │   │   ├── prompt_builder.ts
│   │   │   ├── rules.ts        # Remediation rule engine
│   │   │   └── validator.ts    # Fix syntax validator
│   │   ├── mapper/             # DAG authority mapper
│   │   │   └── dag.ts          # Directed Acyclic Graph builder
│   │   ├── observers/          # Runtime observers
│   │   │   ├── fiber.ts        # React 19 Fiber traversal
│   │   │   └── network.ts      # Fetch/XHR interceptor
│   │   ├── rag/                # Local RAG pipeline
│   │   │   └── index.ts        # Causal Ledger retrieval
│   │   ├── supabase/           # Schema drift detection
│   │   │   ├── client.ts       # Supabase client wrapper
│   │   │   ├── drift_detector.ts # Schema drift engine
│   │   │   └── types.ts
│   │   └── context.ts          # Causal context (trace_id propagation)
│   │
│   ├── ledger/                 # 💾 The Stability Ledger
│   │   ├── db/                 # SQLite/OPFS initialization
│   │   │   ├── init.ts         # Database bootstrap
│   │   │   └── crypto.ts       # AES-256-GCM encryption layer
│   │   └── schema/             # Ledger schema definitions
│   │       ├── trace.ts        # Trace event schema
│   │       └── rag.ts          # RAG index schema
│   │
│   ├── hooks/                  # 🪝 Ghost Hooks & Physics
│   │   ├── stability/          # Ghost Hook implementations
│   │   └── physics/            # Motion & canvas primitives
│   │
│   ├── components/             # 🎨 UI Components
│   │   ├── ui/                 # shadcn/ui primitives
│   │   └── surgical/           # High-density surgical cards
│   │
│   ├── types/                  # 📝 Type Definitions
│   │   ├── ledger.ts           # Ledger event types
│   │   └── trace.d.ts          # Trace type declarations
│   │
│   ├── lib/                    # 🔧 Utilities
│   │   └── utils.ts            # Shared helpers (cn, etc.)
│   │
│   └── proxy.ts                # Network proxy entry point
│
├── workers/                    # 🔄 Web Workers
│   └── ledger.worker.ts        # SharedWorker for SQLite persistence
│
├── scripts/                    # 🛠️ Build & Maintenance Scripts
│   └── eject-physics.ts        # Clean removal of physics primitives
│
├── clerk-nextjs/               # 🔑 Clerk Auth Integration Module
│
├── .bugbouncer/                # 📦 Runtime Data (gitignored)
│   └── audit_history.json      # Local audit history
│
├── .env.example                # Environment variable template
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript configuration (strict)
├── vitest.config.ts            # Test configuration
└── next.config.ts              # Next.js configuration
```

---

## 🧪 Testing

BugBouncer uses [Vitest](https://vitest.dev/) with co-located test files following the `__tests__` directory convention.

```bash
# Run all tests
npm test

# Run in watch mode during development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

**Test categories:**

- **Unit Tests** — Kernel modules (AST parser, fuzzer, config engine)
- **Integration Tests** — Observer ↔ Ledger ↔ Generator pipeline
- **Fuzzer Tests** — Deterministic reproduction using seeded PRNG

---

## 🔒 Privacy & Security

BugBouncer is built with a **zero-trust, local-first** security model:

| Guarantee | How It's Enforced |
|:---|:---|
| **Source code never leaves your machine** | All analysis runs locally via browser APIs |
| **Traces are encrypted at rest** | AES-256-GCM via Web Crypto API |
| **PII is auto-redacted** | ConfigEngine masks passwords, tokens, API keys, SSNs |
| **Cloud sync is opt-in** | Only anonymized structural hashes reach Supabase |
| **Safe Zones** | Exclude sensitive components/routes from observation |
| **100% Ejectability** | Remove BugBouncer entirely with zero compilation errors |

---

## 🗺️ Roadmap

### ✅ Phase 1 — MVP (Current)
- [x] Causal Kernel Runtime (Fiber + Network observers)
- [x] 20-Point Deterministic Audit Matrix
- [x] Local Stability Ledger (SQLite/OPFS + AES-256)
- [x] Schema Drift Detection (Supabase)
- [x] Ghost Hook + Cursor-Ready Fix Generation
- [x] Grade A/B/C Certification Reports
- [x] ConfigEngine (Safe Zones + PII Masking)
- [x] Clerk Authentication (Dashboard)

### 🔄 Phase 2 — Growth
- [ ] Framework expansion (Remix, SvelteKit)
- [ ] CI/CD pre-merge guardrails (GitHub Actions integration)
- [ ] Team-wide shared Stability Ledger
- [ ] Multi-tenant auth pattern support
- [ ] `@bugbouncer/physics` npm package release

### 🔮 Phase 3 — Vision
- [ ] Autonomous self-healing agents
- [ ] Global Stability Index (community-driven failure patterns)
- [ ] Real-time collaborative debugging
- [ ] Enterprise SSO & audit compliance

---

## 🤝 Contributing

We welcome contributions! BugBouncer is built to be extended.

### Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/your-username/bugbouncer.git`
3. **Install** dependencies: `npm install`
4. **Create** a feature branch: `git checkout -b feat/your-feature`
5. **Make** your changes with tests
6. **Run** the test suite: `npm test`
7. **Push** to your branch: `git push origin feat/your-feature`
8. **Open** a Pull Request

### Development Guidelines

- **Naming:** Use `snake_case` for all trace metadata and kernel-internal functions
- **Naming:** Use `PascalCase` for React components, `camelCase` for Server Actions
- **Testing:** Co-locate tests in `__tests__/` directories within each module
- **Error Handling:** Follow the "Kernel Panic" pattern — never crash the target app
- **Privacy:** Never exfiltrate raw schema data — use Structural Hashing
- **Ejectability:** Every Ghost Hook must be dependency-free

### Code Quality

```bash
npm run lint          # ESLint
npm test              # Vitest
npm run test:coverage # Coverage report
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Sarvesh M** — [@KuantumKnight](https://github.com/KuantumKnight)

---

<p align="center">
  <br />
  <strong>BugBouncer</strong> — Moving software from the Age of Autocomplete into the Age of Verification.
  <br />
  <em>Because "it works on my machine" is not a stability guarantee.</em>
  <br /><br />
  <a href="https://github.com/KuantumKnight/bugbouncer/issues">Report Bug</a> •
  <a href="https://github.com/KuantumKnight/bugbouncer/issues">Request Feature</a>
</p>
