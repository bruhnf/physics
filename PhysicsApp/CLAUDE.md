# PhysicsApp — Source Code Root

This is the codebase for Physics, a multi-level STEM game designed to teach concepts of physics through interactive experiments and puzzles.
See `../CLAUDE.md` for full project context and product vision.

## Tech Stack

### Monorepo Layout

```
PhysicsApp/
├── CLAUDE.md              ← This file
├── backend/               ← Node.js REST API
├── frontend/              ← React Native mobile app (Expo) — iOS + Android
└── website/               ← Static landing + legal pages
```

**Platform strategy:** Mobile only — iOS and Android share one Expo codebase. No web client at this time. Platform-specific code (e.g., store/billing) is isolated behind thin adapter modules — never scattered through shared game logic.

### Backend

- **Runtime:** Node.js + TypeScript
- **Framework:** Express
- **ORM:** Prisma
- **Database:** PostgreSQL 15
- **Cache/Queue:** Redis 7 + BullMQ (async job processing, scheduled tasks)
- **Auth:** JWT (15-min access token + 30-day refresh token, bcrypt cost ≥ 12)
- **Logging:** Winston with daily file rotation
- **Security middleware:** Helmet, CORS, express-rate-limit
- **Dev tooling:** ts-node-dev (hot reload)

### Frontend (Mobile)

- **Framework:** React Native via Expo (managed workflow with native modules) — **SDK 56**
- **Build/distribution:** EAS Build (TestFlight + Google Play internal testing)
- **Routing:** expo-router (file-based, lives in `src/app/`) — replaces React Navigation; typed routes enabled
- **State management:** Zustand
- **Graphics/simulation canvas:** React Native Skia — vector-first, GPU-accelerated, identical render on iOS and Android
- **Physics engine:** Matter.js (2D rigid-body); ticked from a Reanimated `useFrameCallback` worklet on the UI thread. `react-native-game-engine` may be layered in for entity bookkeeping if a scene's complexity warrants it.
- **Animation:** React Native Reanimated 4 with `react-native-worklets` — worklet-driven on the UI thread (never JS-thread driven). With Reanimated 4 the worklets package is separate and the legacy babel plugin is no longer required.
- **In-App Purchases:** expo-iap (covers Apple StoreKit + Google Play Billing) — wired up but **unused at MVP** (game launches free); receipt-validation libraries listed under External Services below
- **Secure storage:** expo-secure-store
- **Language:** TypeScript

### Website

- Static HTML/CSS/JS (vanilla), served by nginx container
- Landing page, legal pages (Terms, Privacy Policy)

### AI / External Services

- **Object storage:** AWS S3
- **Email:** AWS SES
- **Geo-IP:** ip-api.com / MaxMind GeoLite2
- **Payments (deferred — not active at MVP):** When IAP is enabled, Apple side uses App Store Server Notifications V2 + App Store Server API verified via @apple/app-store-server-library; Android side uses the Google Play Developer API for receipt validation. No web payment provider — game is mobile-only.

### Infrastructure / Hosting

- **Host:** AWS Lightsail (Ubuntu 22.04)
- **Containerization:** Docker + Docker Compose (docker-compose.prod.yml)
- **Reverse proxy / TLS:** Nginx + Let's Encrypt (certbot)
- **Intrusion prevention:** Fail2ban (custom jails)
- **Backups:** Lightsail snapshots, S3 versioning, nightly pg_dump to S3 with Glacier IR lifecycle
- **Monitoring:** UptimeRobot on /health every 5 min
- **Deploys:** Manual SSH + git pull + docker compose up -d --build + prisma migrate deploy

### Design System

**Primary style — Minimalist sci-fi:**
Dark backgrounds (near-black), cool blue accent palette, HUD-style overlays, geometric UI elements, technical readouts. Think NASA mission control meets a polished iOS app. This is the default for all experiment UI, menus, and navigation.

**Augmentation style — Realistic simulation:**
Used selectively when a physical environment grounds the concept — terrain, sky, gravity-specific color palette (e.g. Mars red, lunar grey). Applied to the experiment *scene* (the simulation canvas) while the surrounding UI stays sci-fi. Never used for navigation or menus.

**Why this split works:** The sci-fi chrome (HUD, panels, sliders) is flat geometric shapes — low GPU overhead on mobile. The simulation canvas does the heavy lifting only when the experiment demands it.

**Design rules:**
- Dark background (`#0d1117` or similar) for all UI chrome
- Blue accent ramp (`#185FA5` → `#378ADD` → `#B5D4F4`) as the primary color system
- Green (`#1D9E75`) for success/stable states; Amber for warnings; Red for failure
- Typography: monospaced or geometric sans — reinforce the technical aesthetic
- All text in `letter-spacing: 0.06–0.1em` for the HUD feel
- No gradients on UI elements; gradients only allowed in simulation scene backgrounds

> **Full spec:** [`../docs/product/visualization-theme.md`](../docs/product/visualization-theme.md) is the authoritative source — including the **resource-conservation rules** (body counts, animation thread discipline, asset lifecycle, mid-range device as performance target). Read it before building any experiment or UI component.

## Coding Standards

### TypeScript

- Strict mode enabled in all tsconfig files
- No `any` types without an explicit comment explaining why
- Prefer `interface` over `type` for object shapes
- Use enums for fixed sets of values (user roles, status codes, condition types)
- Async/await over raw promises — no nested .then() chains

### File Naming

- Components: `PascalCase.tsx` (e.g., `ExperimentCanvas.tsx`, `HudOverlay.tsx`)
- Utilities/helpers: `camelCase.ts` (e.g., `calculateOrbitalVelocity.ts`, `formatSiUnit.ts`)
- Constants: `SCREAMING_SNAKE_CASE` inside files, `camelCase.ts` filenames
- Prisma models: `PascalCase` singular (e.g., `Experiment`, `PlayerProgress`, `LevelScore`)
- API routes: kebab-case URLs (e.g., `/api/v1/experiments`, `/api/v1/player-progress`)

### Project Conventions

- All API endpoints versioned under `/api/v1/`
- Every endpoint returns consistent shape: `{ success: boolean, data?: T, error?: string }`
- Database migrations via Prisma Migrate — never edit the database schema directly
- Environment variables in `.env` files (never committed) with `.env.example` as template
- Secrets and tokens stored in expo-secure-store on mobile, never AsyncStorage
- Platform detection (`Platform.OS`) isolated to adapter files — never inline in game logic or UI
- IAP provider chosen at runtime via the adapter pattern (StoreKit on iOS, Google Play Billing on Android) — wiring stays dormant until monetization is enabled

### Error Handling

- Backend: centralized error handler middleware, never swallow errors silently
- Frontend: error boundaries at route level, toast notifications for recoverable errors
- All API calls wrapped in try/catch with user-friendly error messages
- Log errors with Winston on backend, console.error on frontend (replace with crash reporting before launch)

### Testing

- Test files co-located with source: `ComponentName.test.tsx` or `service.test.ts`
- Aim for integration tests on API routes and unit tests on business logic
- Test framework to be established (Jest is the default expectation)

### Git

- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Feature branches off `main`, merge via pull request (even solo — keeps history clean)
- Never commit `.env`, `node_modules`, or build artifacts
