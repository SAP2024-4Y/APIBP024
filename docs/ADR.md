# Architecture Decision Record — TicketSphere Events & Ticketing API

## 1. Business Problem & Consumers

Live events generate time-sensitive, geographically anchored demand that must be surfaced to diverse clients simultaneously. A consumer attending a concert needs to discover nearby shows, filter by date, and book a seat — all within seconds. Organisers need to create events, manage capacity, and track bookings in real time.

**TicketSphere** addresses these needs by exposing a dual-interface API for the Events & Ticketing domain. Primary consumers are:

- **Mobile apps** (iOS/Android) that browse events by location and book tickets.
- **Web front-ends** (React/Vue SPA) that render calendar views and event listings.
- **Third-party aggregators** (travel, hospitality platforms) consuming the REST feed.
- **Internal dashboards** using GraphQL to compose rich views with a single round-trip.

---

## 2. Business Capabilities

1. **Event Discovery** — find events by location (radius/bbox), time window, category, and price range.
2. **Seat Management** — enforce real-time availability, prevent over-booking through transactional seat reservation.
3. **Ticket Lifecycle** — book, confirm, and cancel tickets with full audit trail and seat assignment.
4. **Venue Management** — maintain a catalogue of venues with precise GeoJSON coordinates.
5. **Access Control** — role-based access (admin / organiser / attendee) with JWT Bearer authentication.

---

## 3. Resource Model

```
User ──────────────┐
  (organizer_id)   │ creates
                   ▼
Venue ◄─────── Event ──────────────────────► Ticket
  (location)       (status, category,          (user_id, seat_number,
  GeoPoint         min/max_price,              status, price)
                   starts_at, ends_at,
                   total_seats,
                   available_seats)
```

**User** — authenticated identity; role drives authorisation.
**Venue** — physical location with GeoJSON `Point` coordinates, city, country, capacity.
**Event** — core aggregate; references a Venue; carries temporal (starts/ends), price, seat-count state.
**Ticket** — reservation linking a User to an Event; seat assignment and cancellation tracked.

These four resources map 1:1 to `schema.graphql` types and OpenAPI schemas.

---

## 4. Approach Decision

**Chosen: Approach A — REST-First + GraphQL Layer.**

The REST layer is the single source of truth for persistence; all business logic (seat reservation, conflict prevention, role checks) lives in the REST route handlers and the underlying SQLite transaction layer. The GraphQL schema and resolvers are a thin query layer that calls the same service/database functions — they do **not** go through HTTP to the REST endpoints, which eliminates the latency and coupling of wrapping REST calls.

**Schema impedance mismatches handled:**

| Challenge | Resolution |
|---|---|
| REST returns flat JSON; GraphQL expects graph-shaped objects | Field resolvers on `Event.venue` and `Ticket.event` lazy-load via DataLoader to avoid N+1 |
| REST HTTP status codes (409, 403 …) vs GraphQL single-200 | `AppError` class carries both `httpStatus` and `code`; Express error handler uses `httpStatus`, Apollo `formatError` surfaces `extensions.code` |
| REST cursor in query string vs GraphQL Connection spec | Both use the same `encodeCursor` / `decodeCursor` utilities; opaque base64url token |
| Rate-limit headers are HTTP-native | REST sets `RateLimit-*` headers via express-rate-limit; GraphQL returns `extensions.code: RATE_LIMITED` in the error payload |

---

## 5. Domain Pattern Mapping

| Pattern | Domain Concept | Implementation |
|---|---|---|
| **List** | Browse events catalogue | `GET /api/v1/events` + `Query.events` — `status`, `category`, `min_price`, `max_price`, `sort`, `order`, cursor pagination (`limit`/`after`/`has_more`) |
| **Map** | Find events near me | `GET /api/v1/events/nearby` (Haversine radius) and `GET /api/v1/events/bbox` (bounding-box); GeoJSON `[lon, lat]` coordinates on every Venue; also `Query.nearbyEvents` / `Query.eventsInBbox` |
| **Calendar** | Time-window availability | `GET /api/v1/events/schedule?starts_at=…&ends_at=…` — returns any event whose window overlaps the query window; `Query.eventsByTimeWindow`; booking conflicts yield `409 EVENT_SOLD_OUT` / `EVENT_CANCELLED` |

---

## 6. Composite Payload Comparison

**Scenario:** Fetch an event with its venue location and the first 5 tickets.

**REST (3 round-trips):**
```
GET /api/v1/events/{id}              → ~820 bytes (event + venue embedded)
GET /api/v1/tickets?event_id={id}&limit=5 → ~1 100 bytes
Total: 3 requests, ~1 920 bytes transferred
```

**GraphQL (1 round-trip):**
```graphql
{
  event(id: "…") {
    id title starts_at ends_at
    venue { name location { coordinates } city country }
    tickets(first: 5) {
      edges { node { id status price seat_number } }
      pageInfo { hasNextPage }
    }
  }
}
```
Response: ~1 240 bytes, **1 request**.

GraphQL eliminates 2 extra round-trips and reduces over-fetching by ~35%; the trade-off is that REST responses are cacheable at the HTTP layer (CDN / browser), whereas the GraphQL `POST` endpoint is not.

---

## 7. Error Catalogue

| # | Code | Cause | HTTP Status | GraphQL `extensions.code` |
|---|---|---|---|---|
| 1 | `AUTH_REQUIRED` | No Bearer token on a protected endpoint | 401 | `AUTH_REQUIRED` |
| 2 | `AUTH_INVALID_TOKEN` | Token expired, malformed, or wrong secret | 401 | `AUTH_INVALID_TOKEN` |
| 3 | `AUTH_INVALID_CREDENTIALS` | Wrong username or password on `/auth/token` | 401 | `AUTH_INVALID_CREDENTIALS` |
| 4 | `FORBIDDEN` | Valid token but insufficient role/ownership | 403 | `FORBIDDEN` |
| 5 | `EVENT_NOT_FOUND` | Event ID does not exist | 404 | `EVENT_NOT_FOUND` |
| 6 | `VENUE_NOT_FOUND` | Venue ID does not exist | 404 | `VENUE_NOT_FOUND` |
| 7 | `TICKET_NOT_FOUND` | Ticket ID does not exist | 404 | `TICKET_NOT_FOUND` |
| 8 | `USER_NOT_FOUND` | User ID does not exist | 404 | `USER_NOT_FOUND` |
| 9 | `EVENT_SOLD_OUT` | `available_seats < quantity` at booking time | 409 | `EVENT_SOLD_OUT` |
| 10 | `EVENT_CANCELLED` | Attempting to book a cancelled/completed event | 409 | `EVENT_CANCELLED` |
| 11 | `TICKET_ALREADY_CANCELLED` | Attempting to cancel an already-cancelled ticket | 409 | `TICKET_ALREADY_CANCELLED` |
| 12 | `BOOKING_CONFLICT` | Generic overlap / conflict (future use) | 409 | `BOOKING_CONFLICT` |
| 13 | `VALIDATION_ERROR` | Zod schema parse failure | 422 | `VALIDATION_ERROR` |
| 14 | `RATE_LIMITED` | IP exceeded request window | 429 | `RATE_LIMITED` |
| 15 | `INTERNAL_ERROR` | Unexpected server-side exception | 500 | `INTERNAL_ERROR` |

---

## 8. Design Decisions

**1. SQLite with WAL mode for idempotent Docker restarts.**
PostgreSQL adds operational complexity (separate container, healthcheck ordering, migration timing). SQLite with `journal_mode = WAL` and a named Docker volume gives us ACID transactions, fast reads, and trivially reproducible `docker compose up`. The seed function checks `COUNT(*) > 0` before inserting, so `docker compose down && up` is safe.

**2. Haversine + bounding-box pre-filter for geospatial queries.**
SQLite has no native spatial index. We pre-filter with a lat/lon bounding-box WHERE clause (cheap index scan) and then apply exact Haversine distance in application code, discarding corner-of-bbox false positives. This gives correct radius results without a PostGIS dependency.

**3. DataLoader batch loading to prevent N+1 in GraphQL.**
When resolving a list of events, the `Event.venue` field resolver would fire N individual DB queries without batching. We use `dataloader` to collect all venue IDs in a single tick and batch them into one `SELECT … WHERE id IN (…)` query. The loader is instantiated per-request (in Apollo context) so there is no cross-request cache contamination.

**4. Opaque base64url cursor encoding for keyset pagination.**
Offset-based pagination drifts when rows are inserted between pages. Our cursor encodes `{sortField, sortValue, id}` as a base64url token. The query uses `(sort_field, id) > (cursor_val, cursor_id)` to jump directly to the next page without scanning skipped rows. The opaque format allows us to change internals without breaking callers.

---

## 9. Future Evolution

1. **REST v2 with field projection** — add `?fields=id,title,starts_at` to REST responses so mobile clients reduce payload size; introduce `/api/v2/events` while keeping v1 stable.
2. **WebSocket subscriptions for live seat availability** — augment the GraphQL schema with `Subscription { seatAvailabilityChanged(eventId: ID!): Event! }` to push real-time seat-count updates to booking UIs without polling.
3. **Spatial index migration to PostGIS** — as venue/event count scales, replace the bounding-box+Haversine approach with `ST_DWithin` on a PostGIS geography column, enabling sub-millisecond radius queries over millions of points.

---

## 10. Business Value

1. **Reduced time-to-booking** — combining geo search and calendar filtering in a single API call (GraphQL) or two (REST) eliminates client-side joins and reduces latency for mobile users, directly improving conversion.
2. **Developer ecosystem reach** — exposing both REST and GraphQL lets the business serve mobile SDKs (REST/OpenAPI codegen), internal tooling (GraphQL), and third-party integrators without maintaining separate services.
3. **Reliable capacity management** — atomic SQLite transactions on seat reservation prevent double-booking under concurrent load, protecting revenue and attendee trust.
