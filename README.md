# Support Ticket Dashboard

A high-performance, resilient support ticket dashboard built with Next.js App Router, React 19, Redux Toolkit, Tailwind CSS, and Vitest. Designed to handle large datasets, edge-case test data, optimistic UI mutations with rollback, and real-time live polling.

---

## 🚀 Quick Setup & Installation

### 1. Prerequisites
- **Node.js**: `v20.x` or `v22.x` (verified on Node `v22.16.0`)
- **npm**: `v10.x`

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/coder-Yash886/Support-Ticket-Assignment.git
cd Support-Ticket-Assignment

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
```

### 3. Environment Variables
Stored in `.env.local` (never committed to git):
```env
# Server-only AI triage secret (never prefixed with NEXT_PUBLIC_)
TRIAGE_API_KEY=fake-secret-triage-key-safe-server-only

# Chaos middleware switch ("on" for realistic network jitter & fault injection, "off" for stable tests)
FAKE_API_CHAOS=on
```

### 4. Running the Application
```bash
# Start development server with Turbopack
npm run dev

# Run automated Vitest test suite
npm test

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

---

## 📁 Project Architecture & Folder Map

```
src/
├── app/
│   ├── api/
│   │   └── tickets/
│   │       ├── route.ts              # GET list (search, filters, keyset cursor pagination)
│   │       ├── counts/route.ts       # GET header counts (my tickets & review queue)
│   │       ├── updates/route.ts      # GET live updates (?since=<serverTime>)
│   │       └── [id]/
│   │           ├── route.ts          # GET single ticket
│   │           ├── claim/route.ts    # POST claim ticket with X-Agent-Id check & 409 conflict
│   │           ├── status/route.ts   # PATCH status with state machine verification (canMove)
│   │           ├── triage/route.ts   # PATCH review queue actions (accept & change)
│   │           └── retriage/route.ts # POST server-only AI triage using TRIAGE_API_KEY
│   ├── tickets/
│   │   ├── page.tsx                  # Main responsive tickets list (table & 375px mobile card)
│   │   └── [id]/
│   │       ├── page.tsx              # Ticket detail view with optimistic actions & safe rendering
│   │       └── not-found.tsx         # Custom 404 screen
│   ├── review/
│   │   └── page.tsx                  # AI Review Queue with human-in-the-loop validation
│   ├── layout.tsx                    # Root layout with Redux Providers and global Header
│   └── page.tsx                      # Automatic redirect to /tickets
├── components/
│   ├── Header.tsx                    # Navigation, agent selector, and real-time badge counts
│   ├── FiltersBar.tsx                # Debounced search (350ms) and multi-field dropdown filters
│   ├── TicketRow.tsx                 # React.memo table row & mobile card with XSS escaping
│   ├── SlaBadge.tsx                  # Accessible SLA status badge (Late, At Risk, On Track)
│   ├── SlaCountdown.tsx              # Isolated 1s ticker keeping parent rows pure
│   ├── NewTicketsBanner.tsx          # Non-intrusive floating banner for buffered incoming tickets
│   └── Providers.tsx                 # Client Redux store wrapper
├── hooks/
│   └── useLiveUpdates.ts             # 5s background polling with tab pause & exponential backoff
├── lib/
│   ├── http.ts                       # Client fetch wrapper with auto-retry for safe GETs
│   ├── normalize.ts                  # Defensive normalizer handling all 12 edge cases
│   ├── safeUrl.ts                    # URL sanitizer blocking javascript: and data: links
│   ├── sla.ts                        # SLA deadline calculation and exact boundary rules
│   ├── ticker.ts                     # Single global 1-second ticker using useSyncExternalStore
│   └── utils.ts                      # clsx and tailwind-merge helper (cn)
├── server/
│   ├── db.ts                         # In-memory store singleton on globalThis with cursor pagination
│   ├── seed.ts                       # 2,000 realistic seed tickets + 12 test tickets (deduped)
│   ├── chaos.ts                      # Network delay (300-1500ms), 10% 500 error, 25% claim 409
│   ├── rules.ts                      # Shared transition rules & Enterprise P1 constraint
│   └── simulator.ts                  # Lazy arrival simulator (new ticket every 5-10s)
├── store/
│   ├── index.ts                      # Redux store configuration and typed hooks
│   ├── ticketsSlice.ts               # createEntityAdapter with optimistic snapshots & rollback
│   ├── filtersSlice.ts               # Mirrored URL filters state
│   ├── agentSlice.ts                 # Active agent switcher with localStorage hydration
│   └── selectors.ts                  # High-performance memoized selectors
└── types/
    └── ticket.ts                     # TypeScript types, enums, and interfaces
```

---

## 🧪 Testing Suite (Vitest)

Run the automated test suite with:
```bash
npm test
```

### Tests Summary:
- **`src/server/seed.test.ts`**: Verifies all 12 test tickets (`T-2001` through `T-2012`), ensuring deduplication, XSS protection, future date clamping, unknown agent handling, and prompt injection defense.
- **`src/server/rules.test.ts`**: Verifies state transitions (`canMove`), enterprise minimum P1 constraints, 10-character reason requirements, and agent validation.
- **`src/lib/normalize.test.ts`**: Tests safe parsing of dates without timezone (UTC default), clamping future dates, and normalizer fallbacks.
- **`src/lib/sla.test.ts`**: Verifies exact SLA boundary conditions (exactly 20% left is `on_track`, strictly under 20% is `at_risk`, `<= 0` is `late`).
- **`src/server/db.test.ts`**: Tests in-memory database operations and proves keyset cursor pagination yields **zero duplicates and zero skipped rows** when new tickets are interleaved.
- **`src/store/ticketsSlice.test.ts`**: Tests optimistic claiming, HTTP 409 rollback, status transitions, and incoming ticket banner buffering.

---

## ⚡ Speed & Performance Optimization Checklist

1. **Debounced Search with Cancellation**:
   - Typing in the search bar debounces for **350ms** before pushing to the URL.
   - An `AbortController` cancels pending in-flight requests when new characters are typed, preventing race conditions.
2. **Per-Row Memoization (`React.memo`)**:
   - `TicketRow` components are wrapped in `React.memo` and receive only their ticket `id`.
   - Modifying one ticket's status re-renders **only that single row**. All other rows remain unrendered.
3. **Isolated 1-Second SLA Countdown**:
   - The entire app shares a **single global timer** managed by `useSyncExternalStore` in `src/lib/ticker.ts`.
   - Only the tiny `<SlaCountdown />` leaf component re-renders every second; parent table rows are never re-rendered.
4. **Lightweight Footprint**:
   - No heavy libraries (no Moment.js, no Lodash, no bulky component frameworks). Built purely with Redux Toolkit and Tailwind CSS.
5. **Mobile Responsiveness at 375px**:
   - Desktop displays a dense table grid.
   - Viewports under 640px automatically transition into responsive card views with `min-w-0` and `break-words`, completely eliminating horizontal scrolling.

---

## 📖 Key Architectural Decisions

Detailed rationale for all security tradeoffs, edge-case resolutions, and data lifecycles can be found in [**`DECISIONS.md`**](./DECISIONS.md).
