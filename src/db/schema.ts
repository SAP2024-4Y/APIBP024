import Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      username    TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email       TEXT UNIQUE NOT NULL,
      role        TEXT NOT NULL DEFAULT 'attendee' CHECK (role IN ('admin','organizer','attendee')),
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE TABLE IF NOT EXISTS venues (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      address     TEXT NOT NULL,
      city        TEXT NOT NULL,
      country     TEXT NOT NULL,
      latitude    REAL NOT NULL,
      longitude   REAL NOT NULL,
      capacity    INTEGER NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id               TEXT PRIMARY KEY,
      title            TEXT NOT NULL,
      description      TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'published'
                         CHECK (status IN ('draft','published','cancelled','completed')),
      category         TEXT NOT NULL
                         CHECK (category IN ('music','sports','tech','food','art',
                                             'comedy','theatre','conference','other')),
      min_price        REAL NOT NULL DEFAULT 0,
      max_price        REAL NOT NULL DEFAULT 0,
      venue_id         TEXT NOT NULL REFERENCES venues(id),
      starts_at        TEXT NOT NULL,
      ends_at          TEXT NOT NULL,
      total_seats      INTEGER NOT NULL,
      available_seats  INTEGER NOT NULL,
      organizer_id     TEXT NOT NULL REFERENCES users(id),
      created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_events_status     ON events(status);
    CREATE INDEX IF NOT EXISTS idx_events_category   ON events(category);
    CREATE INDEX IF NOT EXISTS idx_events_starts_at  ON events(starts_at);
    CREATE INDEX IF NOT EXISTS idx_events_ends_at    ON events(ends_at);
    CREATE INDEX IF NOT EXISTS idx_events_venue      ON events(venue_id);
    CREATE INDEX IF NOT EXISTS idx_events_organizer  ON events(organizer_id);
    CREATE INDEX IF NOT EXISTS idx_events_created    ON events(created_at);

    CREATE TABLE IF NOT EXISTS tickets (
      id           TEXT PRIMARY KEY,
      event_id     TEXT NOT NULL REFERENCES events(id),
      user_id      TEXT NOT NULL REFERENCES users(id),
      status       TEXT NOT NULL DEFAULT 'confirmed'
                     CHECK (status IN ('confirmed','cancelled','pending')),
      price        REAL NOT NULL,
      seat_number  TEXT,
      booked_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      cancelled_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_user  ON tickets(user_id);
  `);
}
