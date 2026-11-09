# TicketSphere — Events & Ticketing API

**Course:** CS F424 API Design & Development · Section S1 · Instructor: Vinaya Sathyanarayana
**Team ID:** `APIBP024` · **Approach:** A — REST-First + GraphQL Layer

| # | Name | Roll No | GitHub ID | Email |
|---|------|---------|-----------|-------|
| 1 | Shafaque Amber | 2024SL70006 | 2024sl70006-lab | 2024sl70006@wilp.bits-pilani.ac.in |
| 2 | Eshika Singh | 2024SL70008 | eshika06 | eshikasingh27@gmail.com |

---

## What's inside

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| REST framework | Express 4 |
| GraphQL | Apollo Server 4 (`expressMiddleware`) |
| Database | SQLite via `better-sqlite3` (WAL mode) |
| Auth | JWT Bearer (`jsonwebtoken`) |
| Pagination | Keyset / cursor-based |
| Geo search | Haversine formula + bounding-box pre-filter |
| Rate limiting | `express-rate-limit` with `RateLimit-*` headers |
| UI | React 18 + Vite 5 + Tailwind CSS 3 + Leaflet |
| Tests | Jest + Supertest (19 integration tests) |
| Container | Docker multi-stage build |

---

## Prerequisites

| Tool | Minimum version | Check |
|---|---|---|
| Node.js | 20 | `node -v` |
| npm | 9 | `npm -v` |
| Docker + Docker Compose | 24 / v2 | `docker -v && docker compose version` |
| Git | any | `git --version` |

---

## Option 1 — Docker (recommended, zero setup)

```bash
git clone https://github.com/SAP2024-4Y/APIBP024.git
cd APIBP024
docker compose up --build
```

That's it. On first start the container:
- Runs schema migrations
- Seeds **25 events across 7 real cities** (idempotent — safe to restart)

| Service | URL |
|---|---|
| REST API | http://localhost:8080/api/v1 |
| Swagger UI | http://localhost:8080/docs |
| GraphQL Sandbox | http://localhost:8080/graphql |
| Health check | http://localhost:8080/health |
| Web UI | http://localhost:8080 |

**Stop and restart without losing data:**
```bash
docker compose down          # SQLite data volume is preserved
docker compose up            # seeds are skipped (idempotent guard)
```

**Full reset (wipe data):**
```bash
docker compose down -v       # removes the sqlite_data volume
docker compose up --build
```

---

## Option 2 — Local development

### Step 1 — clone and install backend dependencies

```bash
git clone https://github.com/SAP2024-4Y/APIBP024.git
cd APIBP024
npm install
```

### Step 2 — environment variables (optional — defaults work out of the box)

```bash
cp .env.example .env        # if the file exists, otherwise skip
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `DATA_DIR` | `./data` | Directory for the SQLite file |
| `JWT_SECRET` | `super-secret-jwt-key-for-events-ticketing-2026` | Sign/verify JWTs — **change in production** |
| `NODE_ENV` | `development` | `production` disables verbose errors |

### Step 3 — start the backend

```bash
npm run dev          # ts-node-dev with hot reload
```

Expected output:
```
[db] Database initialised at ./data/ticketsphere.db
[db] Migrations complete
[db] Seed complete — 25 events, 7 venues
Server running on http://localhost:8080
GraphQL ready at http://localhost:8080/graphql
```

### Step 4 — start the UI (separate terminal)

```bash
cd ui
npm install
npm run dev
```

Expected output:
```
VITE v5.x.x  ready in 300ms
➜  Local:   http://localhost:5173
```

Open **http://localhost:5173**. The Vite dev server proxies all `/api`, `/graphql`, and `/health` calls to the backend on port 8080 automatically.

### Step 5 — build for production

```bash
# Backend
npm run build          # compiles TypeScript → dist/

# UI
cd ui && npm run build  # compiles React → ui/dist/
```

After both builds, `node dist/server.js` serves everything (API + UI) from port 8080.

---

## Demo credentials

Four accounts are seeded automatically:

| Username | Password | Role |
|---|---|---|
| `demo` | `demo-password` | user |
| `admin` | `admin-password` | admin |
| `eventco` | `eventco-pass` | organizer |
| `livemusic` | `livemusic-pass` | organizer |

---

## Authentication

All protected endpoints require `Authorization: Bearer <token>`.

**Get a token:**
```bash
curl -s -X POST http://localhost:8080/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo-password"}' | jq
```
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

**Save for later use:**
```bash
export TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo-password"}' | jq -r .token)
```

---

## REST API

Base URL: `http://localhost:8080/api/v1`

### Events — List (cursor pagination)

```bash
# Basic list
curl "http://localhost:8080/api/v1/events"

# With filters
curl "http://localhost:8080/api/v1/events?status=published&category=music&limit=5"

# Price range
curl "http://localhost:8080/api/v1/events?min_price=0&max_price=50"

# Sort by price ascending
curl "http://localhost:8080/api/v1/events?sort=min_price&order=asc&limit=5"

# Next page — paste next_cursor from previous response
curl "http://localhost:8080/api/v1/events?limit=5&after=<next_cursor>"
```

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `status` | string | — | `published` `draft` `cancelled` `completed` |
| `category` | string | — | `music` `sports` `tech` `food` `art` `comedy` `theatre` `conference` `other` |
| `min_price` | number | — | Minimum ticket price |
| `max_price` | number | — | Maximum ticket price |
| `sort` | string | `starts_at` | `starts_at` `min_price` `title` `available_seats` `created_at` |
| `order` | string | `asc` | `asc` or `desc` |
| `limit` | integer | `20` | Max 100 |
| `after` | string | — | Opaque cursor from `pagination.next_cursor` |

**Response shape:**
```json
{
  "data": [ { "id": "...", "title": "...", "venue": { "location": { "type": "Point", "coordinates": [-73.99, 40.75] } } } ],
  "pagination": { "limit": 5, "has_more": true, "next_cursor": "eyJzb3J0..." }
}
```

---

### Events — Map (geospatial)

```bash
# Radius search — events within 10 km of Tokyo
curl "http://localhost:8080/api/v1/events/nearby?latitude=35.7056&longitude=139.7516&radius_km=10"

# Bounding-box search — events inside NYC bounds
curl "http://localhost:8080/api/v1/events/bbox?min_lat=40.4&min_lon=-74.3&max_lat=40.9&max_lon=-73.7"
```

`/nearby` response includes `distance_km` per event. Coordinates are GeoJSON order: `[longitude, latitude]`.

---

### Events — Calendar (time window)

```bash
# All events in December 2026
curl "http://localhost:8080/api/v1/events/schedule?starts_at=2026-12-01T00:00:00Z&ends_at=2026-12-31T23:59:59Z"
```

---

### Tickets

```bash
# Book a ticket (auth required)
curl -X POST http://localhost:8080/api/v1/tickets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_id":"<EVENT_ID>","quantity":2}'

# List my tickets (auth required)
curl http://localhost:8080/api/v1/tickets \
  -H "Authorization: Bearer $TOKEN"

# Cancel a ticket (auth required)
curl -X DELETE http://localhost:8080/api/v1/tickets/<TICKET_ID> \
  -H "Authorization: Bearer $TOKEN"
```

---

### Other endpoints

```bash
# All venues
curl "http://localhost:8080/api/v1/venues"

# Single venue
curl "http://localhost:8080/api/v1/venues/<VENUE_ID>"

# All categories
curl "http://localhost:8080/api/v1/categories"

# Health
curl "http://localhost:8080/health"
```

---

## GraphQL API

Open **http://localhost:8080/graphql** for the Apollo Sandbox (interactive IDE).

For authenticated queries add a header in the Sandbox:
```json
{ "Authorization": "Bearer <paste_token_here>" }
```

### List events

```graphql
query {
  events(first: 5, status: "published", category: "music", order: asc) {
    edges {
      node {
        id
        title
        category
        min_price
        max_price
        starts_at
        venue { name city location { coordinates } }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

### Next page

```graphql
query {
  events(first: 5, after: "PASTE_END_CURSOR") {
    edges { node { title starts_at } }
    pageInfo { hasNextPage endCursor }
  }
}
```

### Single event

```graphql
query {
  event(id: "PASTE_EVENT_ID") {
    id title description status
    min_price max_price available_seats
    venue { name address city country }
    starts_at ends_at
  }
}
```

### Nearby events (Map API)

```graphql
query {
  nearbyEvents(latitude: 35.7056, longitude: 139.7516, radius_km: 10) {
    distance_km
    event {
      id title category
      venue { name city }
      starts_at min_price
    }
  }
}
```

### Bounding-box events

```graphql
query {
  eventsInBbox(min_lat: 40.4, min_lon: -74.3, max_lat: 40.9, max_lon: -73.7) {
    id title venue { name city }
  }
}
```

### Calendar — events in a time window

```graphql
query {
  eventsByTimeWindow(
    starts_at: "2026-12-01T00:00:00Z"
    ends_at:   "2026-12-31T23:59:59Z"
  ) {
    edges { node { id title starts_at ends_at } }
    pageInfo { hasNextPage }
  }
}
```

### Book a ticket (auth required)

```graphql
mutation {
  bookTicket(eventId: "PASTE_EVENT_ID", quantity: 1) {
    id
    seat_number
    status
    price
    booked_at
  }
}
```

### Cancel a ticket (auth required)

```graphql
mutation {
  cancelTicket(id: "PASTE_TICKET_ID") {
    id
    status
    cancelled_at
  }
}
```

### @deprecated field demo

```graphql
query {
  events(first: 1) {
    edges {
      node {
        title
        price        # ← Apollo Sandbox shows deprecation warning here
        min_price
        max_price
      }
    }
  }
}
```

---

## Rate limiting

Every response from `/api/*` and `/graphql` includes:

| Header | Meaning |
|---|---|
| `RateLimit-Limit` | Max requests allowed in the window |
| `RateLimit-Remaining` | Requests left in the current window |
| `RateLimit-Reset` | Seconds until the window resets |

**Limits:**
- General API (`/api/v1/*`, `/graphql`): **200 requests / 15 minutes**
- Auth endpoint (`/api/v1/auth/token`): **20 requests / 15 minutes**

When exceeded the server returns `429 Too Many Requests`.

```bash
# See the headers
curl -si http://localhost:8080/api/v1/events | grep RateLimit
```

---

## Error format

All errors follow a consistent shape:

```json
{
  "error": {
    "code": "EVENT_SOLD_OUT",
    "message": "This event has no available seats.",
    "details": {}
  }
}
```

GraphQL errors include the same code in `extensions`:
```json
{
  "errors": [{
    "message": "Authentication required.",
    "extensions": { "code": "AUTH_REQUIRED", "http": { "status": 401 } }
  }]
}
```

**All 15 domain error codes:**

| Code | HTTP |
|---|---|
| `AUTH_REQUIRED` | 401 |
| `AUTH_INVALID_TOKEN` | 401 |
| `AUTH_INVALID_CREDENTIALS` | 401 |
| `FORBIDDEN` | 403 |
| `EVENT_NOT_FOUND` | 404 |
| `VENUE_NOT_FOUND` | 404 |
| `TICKET_NOT_FOUND` | 404 |
| `USER_NOT_FOUND` | 404 |
| `BOOKING_CONFLICT` | 409 |
| `EVENT_SOLD_OUT` | 409 |
| `EVENT_CANCELLED` | 409 |
| `TICKET_ALREADY_CANCELLED` | 409 |
| `VALIDATION_ERROR` | 422 |
| `RATE_LIMITED` | 429 |
| `INTERNAL_ERROR` | 500 |

---

## Running tests

```bash
# From project root
npm test

# Watch mode
npm test -- --watch

# With coverage
npm test -- --coverage
```

Expected: **19 tests, 0 failures** covering health, auth, events (list/geo/calendar), tickets, rate-limit headers, and GraphQL.

---

## Project structure

```
APIBP024/
├── src/
│   ├── server.ts              Entry point — init DB, start Express
│   ├── app.ts                 Express + Apollo wiring, Swagger UI, static UI
│   ├── db/
│   │   ├── database.ts        SQLite singleton (WAL mode, foreign keys)
│   │   ├── schema.ts          CREATE TABLE migrations (idempotent)
│   │   └── seed.ts            25 events, 7 venues, 4 users (idempotent)
│   ├── middleware/
│   │   ├── auth.ts            JWT Bearer — requireAuth + getAuthContext
│   │   ├── rateLimit.ts       express-rate-limit (draft-6 headers)
│   │   └── errors.ts          Global error → JSON handler
│   ├── routes/
│   │   ├── auth.ts            POST /api/v1/auth/token
│   │   ├── events.ts          List + /nearby + /bbox + /schedule
│   │   ├── venues.ts          CRUD
│   │   ├── tickets.ts         Book + list + cancel
│   │   └── categories.ts      GET /api/v1/categories
│   ├── graphql/
│   │   ├── dataloaders.ts     Venue + ticket DataLoaders (N+1 prevention)
│   │   └── resolvers/
│   │       ├── events.ts      events, event, nearbyEvents, eventsByTimeWindow
│   │       ├── venues.ts      venues, venue
│   │       ├── tickets.ts     tickets, bookTicket, cancelTicket
│   │       └── index.ts       Merge + DateTime scalar + formatError
│   └── utils/
│       ├── cursor.ts          Encode/decode opaque base64url cursor
│       ├── geo.ts             Haversine distance + radiusToBbox
│       └── errors.ts          AppError class + DomainErrorCode catalogue
├── ui/                        React + Vite + Tailwind frontend
│   └── src/
│       ├── App.tsx            Hash-based routing (/#dashboard /#events …)
│       ├── components/
│       │   ├── Dashboard.tsx  Stats, category grid, upcoming events
│       │   ├── EventList.tsx  Filtered list with cursor load-more
│       │   ├── MapView.tsx    Leaflet — radius + viewport search
│       │   ├── CalendarView.tsx  Month grid with event dots
│       │   ├── BookingModal.tsx  Quantity picker + map deep-link
│       │   ├── MyTickets.tsx  List with cancel
│       │   ├── ProfilePage.tsx   JWT role decode + booking history
│       │   ├── LoginModal.tsx
│       │   └── Header.tsx
│       └── api/client.ts      Typed fetch wrappers for all endpoints
├── docs/
│   ├── openapi.yaml           OpenAPI 3.1 spec (served at /docs)
│   ├── schema.graphql         Authoritative GraphQL SDL
│   └── ADR.md                 Architecture Decision Record
├── tests/
│   └── api.test.ts            19 integration tests (Jest + Supertest)
├── Dockerfile                 3-stage: builder → ui-builder → runner
├── docker-compose.yml         Port 8080, SQLite volume, healthcheck
├── team.json                  Course submission declaration
└── .github/
    └── workflows/ci.yml       Lint + test + Docker build on every push
```

---

## Architecture

**Approach A — REST-First + GraphQL Layer**

```
Client
  │
  ├── REST  →  /api/v1/*   →  Express routers  →  SQLite
  │
  └── GQL   →  /graphql    →  Apollo Server
                                └── resolvers call the same SQLite layer
                                └── DataLoaders batch venue/ticket queries
```

- **Pagination:** keyset cursors encode `(sortField, sortValue, id)` in base64url — no offset drift, stable under concurrent writes.
- **Geo:** bounding-box pre-filter narrows candidates, then Haversine re-ranks and filters precisely. Results include `distance_km`.
- **N+1 prevention:** DataLoaders batch all venue lookups into a single `WHERE id IN (…)` query per request.
- **Auth:** JWT signed with `HS256`. `requireAuth` throws `AUTH_REQUIRED`; `getAuthContext` returns null (for GraphQL optional auth).
- **Errors:** 15 domain codes map to HTTP statuses on REST and to `extensions.code` on GraphQL.

See `docs/ADR.md` for full rationale.
