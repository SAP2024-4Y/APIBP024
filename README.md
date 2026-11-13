# APIBP024 — TicketSphere Events & Ticketing API

Course: CS F424 API Design & Development | Section: S1 | Instructor: Vinaya Sathyanarayana

Dual REST + GraphQL API for event discovery and ticketing. Features cursor-based pagination, geospatial search (radius + bounding box), calendar time-window queries, JWT auth, rate limiting, and a React/Vite web UI — all backed by SQLite and served from a single Docker container.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| REST | Express 4 · Zod validation · Swagger UI (`/docs`) |
| GraphQL | Apollo Server 4 · DataLoader (N+1 prevention) |
| Database | SQLite via `better-sqlite3` (WAL mode) · 25 seeded events |
| Auth | JWT HS256 Bearer tokens |
| Pagination | Keyset / cursor-based (stable under concurrent writes) |
| Geo | Haversine + bounding-box pre-filter |
| Rate limiting | `express-rate-limit` · draft-6 `RateLimit-*` headers |
| UI | React 18 + Vite 5 + Tailwind CSS 3 + Leaflet |
| Tests | Jest + Supertest · 19 integration tests |
| CI | GitHub Actions (lint → test → Docker smoke test) |

## Team Details

| # | Name           | Roll No      | GitHub ID           | Email                                  |
|---|----------------|--------------|---------------------|----------------------------------------|
| 1 | Shafaque Amber | 2024SL70006  | 2024sl70006-lab     | 2024sl70006@wilp.bits-pilani.ac.in     |
| 2 | Eshika Singh   | 2024SL70008  | eshika06            | eshikasingh27@gmail.com                |

- Team ID: `APIBP024` (matches repository name and `team.json.team_id`)
- Chosen Approach: `A` — REST-First + GraphQL Layer

## Quick start

```bash
git clone https://github.com/SAP2024-4Y/APIBP024.git
cd APIBP024
docker compose up --build
```

| Endpoint        | URL                               |
|-----------------|-----------------------------------|
| REST API        | http://localhost:8080/api/v1      |
| Swagger UI      | http://localhost:8080/docs        |
| GraphQL Sandbox | http://localhost:8080/graphql     |
| Health          | http://localhost:8080/health      |
| Web UI          | http://localhost:8080             |

**Local dev (without Docker):**
```bash
npm install && npm run dev          # backend on :8080
cd ui && npm install && npm run dev # frontend on :5173 (proxies to :8080)
```
> Requires Node.js 20+

## Demo credentials

```
POST /api/v1/auth/token  { "username": "demo", "password": "demo-password" }
```

| Username    | Password          | Role       |
|-------------|-------------------|------------|
| `demo`      | `demo-password`   | user       |
| `admin`     | `admin-password`  | admin      |
| `eventco`   | `eventco-pass`    | organizer  |
| `livemusic` | `livemusic-pass`  | organizer  |

## Run tests

```bash
npm test                    # run once
npm test -- --watch         # watch mode
npm test -- --coverage      # with coverage report
```

Expected: **19 tests, 0 failures** — covers health, auth, events (list / geo / calendar), tickets, rate-limit headers, and GraphQL.

## Key endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/auth/token` | — | Get JWT token |
| `GET` | `/api/v1/events` | — | List events (filter, sort, paginate) |
| `GET` | `/api/v1/events/:id` | — | Single event |
| `GET` | `/api/v1/events/nearby` | — | Events within radius (`latitude`, `longitude`, `radius_km`) |
| `GET` | `/api/v1/events/bbox` | — | Events in bounding box (`min_lat`, `max_lat`, `min_lon`, `max_lon`) |
| `GET` | `/api/v1/events/schedule` | — | Events overlapping time window (`starts_at`, `ends_at`) |
| `GET` | `/api/v1/venues` | — | List venues |
| `GET` | `/api/v1/venues/:id` | — | Single venue |
| `GET` | `/api/v1/categories` | — | List all categories |
| `POST` | `/api/v1/tickets` | ✓ | Book a ticket |
| `GET` | `/api/v1/tickets` | ✓ | My tickets |
| `DELETE` | `/api/v1/tickets/:id` | ✓ | Cancel a ticket |
| `POST` | `/graphql` | optional | GraphQL endpoint (queries + mutations) |
| `GET` | `/docs` | — | Swagger UI |
| `GET` | `/health` | — | Health check |

## Sample REST call

```bash
# Get a token
export TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo-password"}' | jq -r .token)

# List events — cursor pagination, filters, sort
curl "http://localhost:8080/api/v1/events?status=published&category=music&limit=5&sort=min_price&order=asc"

# Next page — paste next_cursor from previous response
curl "http://localhost:8080/api/v1/events?limit=5&after=<next_cursor>"

# Geo — events within 10 km of a point
curl "http://localhost:8080/api/v1/events/nearby?latitude=40.75&longitude=-73.99&radius_km=10"

# Bounding box
curl "http://localhost:8080/api/v1/events/bbox?min_lat=40.4&max_lat=40.9&min_lon=-74.3&max_lon=-73.7"

# Calendar — events overlapping a time window
curl "http://localhost:8080/api/v1/events/schedule?starts_at=2026-12-01T00:00:00Z&ends_at=2026-12-31T23:59:59Z"

# Book a ticket (auth required)
curl -X POST http://localhost:8080/api/v1/tickets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_id":"<EVENT_ID>","quantity":1}'

# Cancel a ticket (auth required)
curl -X DELETE http://localhost:8080/api/v1/tickets/<TICKET_ID> \
  -H "Authorization: Bearer $TOKEN"
```

## Sample GraphQL call

```graphql
query {
  events(first: 5, status: "published", category: "music") {
    edges { node { id title min_price venue { name city } } }
    pageInfo { hasNextPage endCursor }
  }
}

query {
  nearbyEvents(latitude: 40.75, longitude: -73.99, radius_km: 10) {
    distance_km
    event { id title venue { name city } starts_at }
  }
}
```

Add `Authorization: Bearer <token>` header for mutations (`bookTicket`, `cancelTicket`).

## Architecture

Approach A — REST-First + GraphQL Layer. Both interfaces share the same SQLite layer.

```
Client
 ├── REST   →  /api/v1/*  →  Express routers  ─┐
 └── GQL    →  /graphql   →  Apollo resolvers  ─┴→  SQLite (WAL)
                                └── DataLoaders batch venue lookups (N+1 prevention)
```

- **Pagination:** base64url cursor encodes `(sortField, sortValue, id)` — no offset drift
- **Geo:** bounding-box pre-filter + Haversine re-rank; results include `distance_km`
- **Errors:** 15 domain codes → HTTP status on REST, `extensions.code` on GraphQL

See [`docs/ADR.md`](docs/ADR.md) for full design decisions and [`docs/openapi.yaml`](docs/openapi.yaml) for the full REST spec.

## Error codes

All errors return `{ "error": { "code": "...", "message": "..." } }` on REST and `extensions.code` on GraphQL.

| Code | HTTP | Code | HTTP |
|---|---|---|---|
| `AUTH_REQUIRED` | 401 | `EVENT_NOT_FOUND` | 404 |
| `AUTH_INVALID_TOKEN` | 401 | `VENUE_NOT_FOUND` | 404 |
| `AUTH_INVALID_CREDENTIALS` | 401 | `TICKET_NOT_FOUND` | 404 |
| `FORBIDDEN` | 403 | `EVENT_SOLD_OUT` | 409 |
| `BOOKING_CONFLICT` | 409 | `EVENT_CANCELLED` | 409 |
| `TICKET_ALREADY_CANCELLED` | 409 | `VALIDATION_ERROR` | 422 |
| `RATE_LIMITED` | 429 | `INTERNAL_ERROR` | 500 |
| `USER_NOT_FOUND` | 404 | | |

Rate limit: 200 req / 15 min on all API routes; 20 req / 15 min on `/auth/token`. Headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
