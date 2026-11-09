import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database';
import { AppError } from '../utils/errors';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { encodeCursor, decodeCursor, buildCursorWhere } from '../utils/cursor';
import { haversineDistance, radiusToBbox } from '../utils/geo';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ── Validation schemas ────────────────────────────────────────────────────────

const ALLOWED_SORT_FIELDS = ['title', 'min_price', 'max_price', 'starts_at', 'ends_at', 'created_at', 'available_seats'] as const;
type SortField = typeof ALLOWED_SORT_FIELDS[number];

const ListQuerySchema = z.object({
  status:    z.string().optional(),
  category:  z.string().optional(),
  min_price: z.coerce.number().nonnegative().optional(),
  max_price: z.coerce.number().nonnegative().optional(),
  sort:      z.enum(ALLOWED_SORT_FIELDS).optional().default('created_at'),
  order:     z.enum(['asc', 'desc']).optional().default('asc'),
  limit:     z.coerce.number().int().min(1).max(100).optional().default(20),
  after:     z.string().optional(),
});

const NearbyQuerySchema = z.object({
  latitude:  z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radius_km: z.coerce.number().positive().max(500),
  limit:     z.coerce.number().int().min(1).max(100).optional().default(20),
});

const BboxQuerySchema = z.object({
  min_lat: z.coerce.number().min(-90).max(90),
  min_lon: z.coerce.number().min(-180).max(180),
  max_lat: z.coerce.number().min(-90).max(90),
  max_lon: z.coerce.number().min(-180).max(180),
  limit:   z.coerce.number().int().min(1).max(200).optional().default(50),
});

const ScheduleQuerySchema = z.object({
  starts_at: z.string().datetime({ offset: true }),
  ends_at:   z.string().datetime({ offset: true }),
  status:    z.string().optional(),
  category:  z.string().optional(),
  limit:     z.coerce.number().int().min(1).max(200).optional().default(50),
  after:     z.string().optional(),
});

const CreateEventSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().min(1),
  status:      z.enum(['draft', 'published', 'cancelled', 'completed']).optional().default('published'),
  category:    z.enum(['music', 'sports', 'tech', 'food', 'art', 'comedy', 'theatre', 'conference', 'other']),
  min_price:   z.number().nonnegative(),
  max_price:   z.number().nonnegative(),
  venue_id:    z.string().uuid(),
  starts_at:   z.string().datetime({ offset: true }),
  ends_at:     z.string().datetime({ offset: true }),
  total_seats: z.number().int().positive(),
});

const UpdateEventSchema = CreateEventSchema.partial();

// ── Helper: join events with their venues ────────────────────────────────────

function rowToEvent(row: Record<string, unknown>) {
  return {
    id:              row.id,
    title:           row.title,
    description:     row.description,
    status:          row.status,
    category:        row.category,
    min_price:       row.min_price,
    max_price:       row.max_price,
    venue:           row.venue_id ? {
      id:        row.venue_id,
      name:      row.venue_name,
      address:   row.venue_address,
      city:      row.venue_city,
      country:   row.venue_country,
      location:  { type: 'Point', coordinates: [row.venue_lon, row.venue_lat] },
      capacity:  row.venue_capacity,
    } : null,
    starts_at:       row.starts_at,
    ends_at:         row.ends_at,
    total_seats:     row.total_seats,
    available_seats: row.available_seats,
    organizer_id:    row.organizer_id,
    created_at:      row.created_at,
    updated_at:      row.updated_at,
  };
}

const EVENT_JOIN_SQL = `
  SELECT e.*,
         v.name      AS venue_name,
         v.address   AS venue_address,
         v.city      AS venue_city,
         v.country   AS venue_country,
         v.latitude  AS venue_lat,
         v.longitude AS venue_lon,
         v.capacity  AS venue_capacity
  FROM events e
  LEFT JOIN venues v ON v.id = e.venue_id
`;

// ── GET /api/v1/events ────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = ListQuerySchema.parse(req.query);
    const db = getDb();

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (q.status)    { conditions.push('e.status = ?');    params.push(q.status); }
    if (q.category)  { conditions.push('e.category = ?');  params.push(q.category); }
    if (q.min_price !== undefined) { conditions.push('e.min_price >= ?'); params.push(q.min_price); }
    if (q.max_price !== undefined) { conditions.push('e.max_price <= ?'); params.push(q.max_price); }

    // Cursor
    if (q.after) {
      const cursor = decodeCursor(q.after);
      if (cursor) {
        const { sql, params: cp } = buildCursorWhere(cursor, q.order);
        conditions.push(sql);
        params.push(...cp);
      }
    }

    const sortField: SortField = (q.sort as SortField) || 'created_at';
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderDir = q.order.toUpperCase();

    const sql = `
      ${EVENT_JOIN_SQL}
      ${whereClause}
      ORDER BY e.${sortField} ${orderDir}, e.id ${orderDir}
      LIMIT ?
    `;
    params.push(q.limit + 1);

    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    const hasMore = rows.length > q.limit;
    const items = hasMore ? rows.slice(0, q.limit) : rows;

    const lastItem = items[items.length - 1] as Record<string, unknown> | undefined;
    const nextCursor = lastItem && hasMore
      ? encodeCursor(sortField, lastItem[sortField] as string | number, lastItem.id as string)
      : null;

    res.json({
      data: items.map(rowToEvent),
      pagination: {
        limit:       q.limit,
        has_more:    hasMore,
        next_cursor: nextCursor,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/events/nearby  (geospatial proximity) ────────────────────────
// GeoJSON convention: position is [longitude, latitude]
router.get('/nearby', (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = NearbyQuerySchema.parse(req.query);
    const db = getDb();

    const bbox = radiusToBbox(q.latitude, q.longitude, q.radius_km);
    const rows = db.prepare(`
      ${EVENT_JOIN_SQL}
      WHERE v.latitude BETWEEN ? AND ?
        AND v.longitude BETWEEN ? AND ?
      ORDER BY e.starts_at ASC
    `).all(bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon) as Record<string, unknown>[];

    // Exact haversine filter
    const filtered = rows.filter(row => {
      const dist = haversineDistance(q.latitude, q.longitude, row.venue_lat as number, row.venue_lon as number);
      return dist <= q.radius_km;
    });

    const limited = filtered.slice(0, q.limit).map(row => ({
      ...rowToEvent(row),
      distance_km: parseFloat(
        haversineDistance(q.latitude, q.longitude, row.venue_lat as number, row.venue_lon as number).toFixed(3)
      ),
    }));

    res.json({ data: limited, total: limited.length });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/events/bbox  (bounding-box search) ───────────────────────────
router.get('/bbox', (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = BboxQuerySchema.parse(req.query);
    const db = getDb();

    const rows = db.prepare(`
      ${EVENT_JOIN_SQL}
      WHERE v.latitude  BETWEEN ? AND ?
        AND v.longitude BETWEEN ? AND ?
      ORDER BY e.starts_at ASC
      LIMIT ?
    `).all(q.min_lat, q.max_lat, q.min_lon, q.max_lon, q.limit) as Record<string, unknown>[];

    res.json({ data: rows.map(rowToEvent), total: rows.length });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/events/schedule  (calendar / time-window) ────────────────────
router.get('/schedule', (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = ScheduleQuerySchema.parse(req.query);
    if (new Date(q.ends_at) <= new Date(q.starts_at)) {
      throw new AppError('VALIDATION_ERROR', 'ends_at must be after starts_at');
    }
    const db = getDb();

    const conditions: string[] = [
      'e.starts_at < ?', // event starts before window end
      'e.ends_at   > ?', // event ends   after  window start
    ];
    const params: (string | number)[] = [q.ends_at, q.starts_at];

    if (q.status)   { conditions.push('e.status = ?');   params.push(q.status); }
    if (q.category) { conditions.push('e.category = ?'); params.push(q.category); }

    // Cursor pagination
    if (q.after) {
      const cursor = decodeCursor(q.after);
      if (cursor) {
        const { sql, params: cp } = buildCursorWhere(cursor, 'asc');
        conditions.push(sql);
        params.push(...cp);
      }
    }

    params.push(q.limit + 1);

    const rows = db.prepare(`
      ${EVENT_JOIN_SQL}
      WHERE ${conditions.join(' AND ')}
      ORDER BY e.starts_at ASC, e.id ASC
      LIMIT ?
    `).all(...params) as Record<string, unknown>[];

    const hasMore = rows.length > q.limit;
    const items   = hasMore ? rows.slice(0, q.limit) : rows;

    const lastItem = items[items.length - 1] as Record<string, unknown> | undefined;
    const nextCursor = lastItem && hasMore
      ? encodeCursor('starts_at', lastItem.starts_at as string, lastItem.id as string)
      : null;

    res.json({
      data: items.map(rowToEvent),
      window: { starts_at: q.starts_at, ends_at: q.ends_at },
      pagination: { limit: q.limit, has_more: hasMore, next_cursor: nextCursor },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/events/:id ────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const row = db.prepare(`${EVENT_JOIN_SQL} WHERE e.id = ?`).get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) throw new AppError('EVENT_NOT_FOUND');
    res.json({ data: rowToEvent(row) });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/events ───────────────────────────────────────────────────────
router.post('/', requireAuth, (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const body = CreateEventSchema.parse(req.body);
    if (new Date(body.ends_at) <= new Date(body.starts_at)) {
      throw new AppError('VALIDATION_ERROR', 'ends_at must be after starts_at');
    }
    const db = getDb();

    const venue = db.prepare('SELECT id FROM venues WHERE id = ?').get(body.venue_id);
    if (!venue) throw new AppError('VENUE_NOT_FOUND');

    const id  = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO events (id, title, description, status, category, min_price, max_price,
                          venue_id, starts_at, ends_at, total_seats, available_seats,
                          organizer_id, created_at, updated_at)
      VALUES (@id, @title, @description, @status, @category, @min_price, @max_price,
              @venue_id, @starts_at, @ends_at, @total_seats, @total_seats,
              @organizer_id, @created_at, @updated_at)
    `).run({ ...body, id, organizer_id: req.user!.sub, created_at: now, updated_at: now });

    const row = db.prepare(`${EVENT_JOIN_SQL} WHERE e.id = ?`).get(id) as Record<string, unknown>;
    res.status(201).json({ data: rowToEvent(row) });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/v1/events/:id ────────────────────────────────────────────────────
router.put('/:id', requireAuth, (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const body = UpdateEventSchema.parse(req.body);
    const db = getDb();

    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id) as { organizer_id: string } | undefined;
    if (!existing) throw new AppError('EVENT_NOT_FOUND');
    if (existing.organizer_id !== req.user!.sub && req.user!.role !== 'admin') {
      throw new AppError('FORBIDDEN');
    }

    const fields = Object.keys(body).map(k => `${k} = @${k}`).join(', ');
    const now = new Date().toISOString();
    db.prepare(`UPDATE events SET ${fields}, updated_at = @updated_at WHERE id = @id`)
      .run({ ...body, updated_at: now, id: req.params.id });

    const row = db.prepare(`${EVENT_JOIN_SQL} WHERE e.id = ?`).get(req.params.id) as Record<string, unknown>;
    res.json({ data: rowToEvent(row) });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/v1/events/:id  (cancel event) ────────────────────────────────
router.delete('/:id', requireAuth, (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id) as { organizer_id: string } | undefined;
    if (!existing) throw new AppError('EVENT_NOT_FOUND');
    if (existing.organizer_id !== req.user!.sub && req.user!.role !== 'admin') {
      throw new AppError('FORBIDDEN');
    }

    db.prepare(`UPDATE events SET status = 'cancelled', updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), req.params.id);

    res.json({ data: { id: req.params.id, status: 'cancelled' } });
  } catch (err) {
    next(err);
  }
});

export default router;
