# TicketSphere — Entity Relationship Diagram

```mermaid
erDiagram
    users {
        TEXT id PK
        TEXT username UK
        TEXT email UK
        TEXT password_hash
        TEXT role
        TEXT created_at
    }
    venues {
        TEXT id PK
        TEXT name
        TEXT address
        TEXT city
        TEXT country
        REAL latitude
        REAL longitude
        INTEGER capacity
        TEXT created_at
    }
    events {
        TEXT id PK
        TEXT title
        TEXT description
        TEXT status
        TEXT category
        REAL min_price
        REAL max_price
        TEXT venue_id FK
        TEXT starts_at
        TEXT ends_at
        INTEGER total_seats
        INTEGER available_seats
        TEXT organizer_id FK
        TEXT created_at
        TEXT updated_at
    }
    tickets {
        TEXT id PK
        TEXT event_id FK
        TEXT user_id FK
        TEXT status
        REAL price
        TEXT seat_number
        TEXT booked_at
        TEXT cancelled_at
    }

    users ||--o{ events : "organizes (organizer_id)"
    venues ||--o{ events : "hosts (venue_id)"
    users ||--o{ tickets : "books (user_id)"
    events ||--o{ tickets : "has (event_id)"
```

## Table Hierarchy

```
users   ←──────── events ────────→ venues
  ↑                   ↑
  └────── tickets ────┘
```

| Level | Tables | Note |
|---|---|---|
| Root | `users`, `venues` | No foreign keys — independent tables |
| Middle | `events` | Depends on `users` (organizer) and `venues` |
| Leaf | `tickets` | Most dependent — references both `users` and `events` |

## Relationships

| Relationship | Cardinality | Foreign Key | Description |
|---|---|---|---|
| `users` → `events` | 1 : N | `events.organizer_id` | One organizer creates many events |
| `venues` → `events` | 1 : N | `events.venue_id` | One venue hosts many events |
| `users` → `tickets` | 1 : N | `tickets.user_id` | One attendee books many tickets |
| `events` → `tickets` | 1 : N | `tickets.event_id` | One event has many tickets |

## Referential Integrity

Deleting a parent record breaks child records (FK constraint in SQLite):

| Delete | Breaks |
|---|---|
| `users` row | Their `events` (organizer_id) and their `tickets` (user_id) |
| `venues` row | All `events` at that venue (venue_id) |
| `events` row | All `tickets` for that event (event_id) |

The `DELETE /api/v1/venues/:id` endpoint explicitly checks for `published` or `draft` events
before allowing deletion to prevent orphaned event records.
