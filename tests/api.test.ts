import request from 'supertest';
import { Express } from 'express';
import { initializeDatabase } from '../src/db/database';
import { runMigrations } from '../src/db/schema';
import { seedDatabase } from '../src/db/seed';
import { createApp } from '../src/app';
import path from 'path';
import fs from 'fs';

let app: Express;
let authToken: string;

beforeAll(async () => {
  const tmpDir = path.join(__dirname, '..', 'tmp-test-data');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  process.env['DATA_DIR'] = tmpDir;
  process.env['JWT_SECRET'] = 'test-secret';

  const db = initializeDatabase();
  runMigrations(db);
  seedDatabase(db);
  app = await createApp();

  const res = await request(app)
    .post('/api/v1/auth/token')
    .send({ username: 'demo', password: 'demo-password' });
  authToken = res.body.token;
});

// ── Health ──────────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ── Auth ───────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/token', () => {
  it('returns a JWT token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/token')
      .send({ username: 'demo', password: 'demo-password' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.token_type).toBe('Bearer');
  });

  it('returns 401 for invalid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/token')
      .send({ username: 'demo', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });
});

// ── Events List ───────────────────────────────────────────────────────────
describe('GET /api/v1/events', () => {
  it('returns paginated events with has_more', async () => {
    const res = await request(app).get('/api/v1/events?limit=5');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(res.body.pagination).toHaveProperty('has_more');
    expect(res.body.pagination).toHaveProperty('next_cursor');
  });

  it('filters by status', async () => {
    const res = await request(app).get('/api/v1/events?status=published&limit=100');
    expect(res.status).toBe(200);
    res.body.data.forEach((e: { status: string }) => {
      expect(e.status).toBe('published');
    });
  });

  it('filters by category', async () => {
    const res = await request(app).get('/api/v1/events?category=music&limit=100');
    expect(res.status).toBe(200);
    res.body.data.forEach((e: { category: string }) => {
      expect(e.category).toBe('music');
    });
  });

  it('filters by min_price and max_price', async () => {
    const res = await request(app).get('/api/v1/events?min_price=50&max_price=200&limit=100');
    expect(res.status).toBe(200);
    res.body.data.forEach((e: { min_price: number; max_price: number }) => {
      expect(e.min_price).toBeGreaterThanOrEqual(50);
      expect(e.max_price).toBeLessThanOrEqual(200);
    });
  });

  it('supports cursor pagination', async () => {
    const page1 = await request(app).get('/api/v1/events?limit=3');
    expect(page1.body.pagination.has_more).toBe(true);
    expect(page1.body.pagination.next_cursor).toBeTruthy();

    const page2 = await request(app)
      .get(`/api/v1/events?limit=3&after=${page1.body.pagination.next_cursor}`);
    expect(page2.status).toBe(200);
    // Ensure no duplicate IDs
    const ids1 = page1.body.data.map((e: { id: string }) => e.id);
    const ids2 = page2.body.data.map((e: { id: string }) => e.id);
    const overlap = ids1.filter((id: string) => ids2.includes(id));
    expect(overlap.length).toBe(0);
  });

  it('sorts by field and order', async () => {
    const res = await request(app).get('/api/v1/events?sort=min_price&order=asc&limit=10');
    expect(res.status).toBe(200);
    const prices = res.body.data.map((e: { min_price: number }) => e.min_price);
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);
  });
});

// ── Events Geo ────────────────────────────────────────────────────────────
describe('GET /api/v1/events/nearby', () => {
  it('returns events within radius with distance_km', async () => {
    const res = await request(app)
      .get('/api/v1/events/nearby?latitude=40.75&longitude=-73.99&radius_km=10');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('distance_km');
      expect(res.body.data[0].distance_km).toBeLessThanOrEqual(10);
    }
  });
});

describe('GET /api/v1/events/bbox', () => {
  it('returns events in bounding box', async () => {
    const res = await request(app)
      .get('/api/v1/events/bbox?min_lat=-90&max_lat=90&min_lon=-180&max_lon=180');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

// ── Events Calendar ───────────────────────────────────────────────────────
describe('GET /api/v1/events/schedule', () => {
  it('returns events overlapping the time window', async () => {
    const res = await request(app)
      .get('/api/v1/events/schedule?starts_at=2026-11-01T00:00:00Z&ends_at=2027-01-01T00:00:00Z');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('window');
    expect(res.body.pagination).toHaveProperty('has_more');
  });
});

// ── Tickets – auth required ───────────────────────────────────────────────
describe('POST /api/v1/tickets', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/v1/tickets').send({ event_id: 'any' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('books a ticket for authenticated user', async () => {
    const eventsRes = await request(app).get('/api/v1/events?status=published&limit=1');
    const eventId = eventsRes.body.data[0].id;

    const res = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ event_id: eventId, quantity: 1 });
    expect(res.status).toBe(201);
    expect(res.body.data[0]).toHaveProperty('id');
    expect(res.body.data[0].status).toBe('confirmed');
  });
});

// ── Rate-limit headers ─────────────────────────────────────────────────────
describe('Rate-limit headers', () => {
  it('includes RateLimit headers on API responses', async () => {
    const res = await request(app).get('/api/v1/events');
    expect(res.headers).toHaveProperty('ratelimit-limit');
    expect(res.headers).toHaveProperty('ratelimit-remaining');
    expect(res.headers).toHaveProperty('ratelimit-reset');
  });
});

// ── GraphQL ───────────────────────────────────────────────────────────────
describe('POST /graphql', () => {
  it('executes a basic events query', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({ query: '{ events(first: 3) { edges { node { id title } } pageInfo { hasNextPage } total } }' });
    expect(res.status).toBe(200);
    expect(res.body.data.events.edges.length).toBeGreaterThan(0);
    expect(res.body.data.events).toHaveProperty('pageInfo');
    expect(res.body.data.events).toHaveProperty('total');
  });

  it('executes nearbyEvents query with GeoJSON location', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({
        query: `{ nearbyEvents(latitude: 40.75, longitude: -73.99, radius_km: 10) {
          event { id title venue { location { coordinates } } }
          distance_km
        } }`,
      });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.nearbyEvents)).toBe(true);
  });

  it('executes eventsByTimeWindow query', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({
        query: `{ eventsByTimeWindow(starts_at: "2026-11-01T00:00:00Z", ends_at: "2027-01-01T00:00:00Z") {
          edges { node { id title starts_at ends_at } }
          pageInfo { hasNextPage }
          total
        } }`,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.eventsByTimeWindow.edges.length).toBeGreaterThan(0);
  });

  it('returns structured error code for auth-required mutations', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({ query: 'mutation { cancelEvent(id: "fake-id") { id } }' });
    expect(res.status).toBe(200); // GraphQL always returns 200
    expect(res.body.errors[0].extensions.code).toBe('AUTH_REQUIRED');
  });
});
