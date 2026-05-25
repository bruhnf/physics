# STEM Lab Backend

Express + Prisma + Postgres. Serves experiment + goal content to the mobile app.

## First-time setup

```bash
# 1. Install deps
npm install

# 2. Start Postgres in Docker
docker compose up -d

# 3. Generate Prisma client + apply schema
npm run prisma:migrate          # creates tables, generates @prisma/client

# 4. Seed with the bundled Physics experiments
npm run db:seed                 # writes categories + 6 experiments + 60 goals
```

## Day-to-day

```bash
# Start the dev server (hot reload via ts-node-dev)
npm run dev                      # → http://localhost:4000

# View / edit data visually
npm run prisma:studio            # opens Prisma Studio in browser

# Nuke + re-seed (full reset)
npm run db:reset
```

## API endpoints

All responses: `{ success: boolean, data?: T, error?: string }`

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | server status |
| GET | `/api/v1/categories` | all categories + tier counts |
| GET | `/api/v1/categories/:slug/experiments` | experiments in a category |
| GET | `/api/v1/experiments/:slug` | single experiment metadata + instructions |
| GET | `/api/v1/experiments/:slug/goals` | ordered goal configs for an experiment |

## Connecting from the iPhone dev client

For iPhone-on-same-WiFi → laptop-running-backend, the phone needs your machine's local IP (not `localhost`). Find it with `ipconfig` (Windows). Use `http://192.168.X.X:4000` in the frontend's API base URL config.

## Production deploy

Lightsail + Docker Compose per `../../docs/architecture/`. Not in scope for the MVP rebuild — local-only dev for now.
