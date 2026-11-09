import { getDb } from '../../db/database';
import { AppError } from '../../utils/errors';
import { encodeCursor, decodeCursor, buildCursorWhere } from '../../utils/cursor';
import { haversineDistance, radiusToBbox } from '../../utils/geo';
import { DataLoaders } from '../dataloaders';
import { v4 as uuidv4 } from 'uuid';
import { JwtPayload } from '../../middleware/auth';

interface Context {
  user: JwtPayload | null;
  dataloaders: DataLoaders;
}

function requireLogin(ctx: Context): JwtPayload {
  if (!ctx.user) throw new AppError('AUTH_REQUIRED');
  return ctx.user;
}

const EVENT_JOIN = `
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

function rowToVenue(row: Record<string, unknown>) {
  return {
    id:         row.venue_id ?? row.id,
    name:       row.venue_name ?? row.name,
    address:    row.venue_address ?? row.address,
    city:       row.venue_city ?? row.city,
    country:    row.venue_country ?? row.country,
    location:   { type: 'Point', coordinates: [row.venue_lon ?? row.longitude, row.venue_lat ?? row.latitude] },
    capacity:   row.venue_capacity ?? row.capacity,
    created_at: row.venue_created_at ?? row.created_at,
  };
}

function rowToEvent(row: Record<string, unknown>) {
  return {
    id:              row.id,
    title:           row.title,
    description:     row.description,
    status:          row.status,
    category:        row.category,
    min_price:       row.min_price,
    max_price:       row.max_price,
    price:           null, // deprecated field
    venue_id:        row.venue_id,
    _venueRow:       row, // pass full row for venue child resolver
    starts_at:       row.starts_at,
    ends_at:         row.ends_at,
    total_seats:     row.total_seats,
    available_seats: row.available_seats,
    organizer_id:    row.organizer_id,
    created_at:      row.created_at,
    updated_at:      row.updated_at,
  };
}

type SortField = 'title' | 'min_price' | 'max_price' | 'starts_at' | 'ends_at' | 'created_at' | 'available_seats';

function buildEventListQuery(args: {
  first?: number | null;
  after?: string | null;
  status?: string | null;
  category?: string | null;
  min_price?: number | null;
  max_price?: number | null;
  sort?: string | null;
  order?: string | null;
}) {
  const limit      = Math.min(args.first ?? 20, 100);
  const order      = (args.order === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
  const sortField  = (args.sort as SortField) || 'created_at';
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (args.status)    { conditions.push('e.status = ?');   params.push(args.status); }
  if (args.category)  { conditions.push('e.category = ?'); params.push(args.category); }
  if (args.min_price != null) { conditions.push('e.min_price >= ?'); params.push(args.min_price); }
  if (args.max_price != null) { conditions.push('e.max_price <= ?'); params.push(args.max_price); }

  if (args.after) {
    const cursor = decodeCursor(args.after);
    if (cursor) {
      const { sql, params: cp } = buildCursorWhere(cursor, order);
      conditions.push(sql);
      params.push(...cp);
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const dir   = order.toUpperCase();
  params.push(limit + 1);

  return { sql: `${EVENT_JOIN} ${where} ORDER BY e.${sortField} ${dir}, e.id ${dir} LIMIT ?`, params, limit, sortField, order };
}

function buildConnection<T extends Record<string, unknown>>(
  rows: T[],
  limit: number,
  sortField: string,
  getTotal: () => number
) {
  const hasMore = rows.length > limit;
  const items   = hasMore ? rows.slice(0, limit) : rows;
  const edges   = items.map(r => ({
    cursor: encodeCursor(sortField, r[sortField] as string | number, r.id as string),
    node: r,
  }));
  const total = getTotal();
  return {
    edges,
    pageInfo: {
      hasNextPage:     hasMore,
      hasPreviousPage: false,
      startCursor:     edges[0]?.cursor ?? null,
      endCursor:       edges[edges.length - 1]?.cursor ?? null,
    },
    total,
  };
}

export const eventResolvers = {
  Query: {
    events(_: unknown, args: Record<string, unknown>, _ctx: Context) {
      const db = getDb();
      const { sql, params, limit, sortField } = buildEventListQuery(args as Parameters<typeof buildEventListQuery>[0]);
      const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
      return buildConnection(rows.map(rowToEvent), limit, sortField, () =>
        (db.prepare('SELECT COUNT(*) AS cnt FROM events').get() as { cnt: number }).cnt
      );
    },

    event(_: unknown, args: { id: string }) {
      const db = getDb();
      const row = db.prepare(`${EVENT_JOIN} WHERE e.id = ?`).get(args.id) as Record<string, unknown> | undefined;
      return row ? rowToEvent(row) : null;
    },

    nearbyEvents(_: unknown, args: { latitude: number; longitude: number; radius_km: number; first?: number }) {
      const db   = getDb();
      const bbox = radiusToBbox(args.latitude, args.longitude, args.radius_km);
      const rows = db.prepare(`
        ${EVENT_JOIN}
        WHERE v.latitude BETWEEN ? AND ?
          AND v.longitude BETWEEN ? AND ?
        ORDER BY e.starts_at ASC
      `).all(bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon) as Record<string, unknown>[];

      const limit = args.first ?? 20;
      return rows
        .map(r => ({
          event: rowToEvent(r),
          distance_km: parseFloat(haversineDistance(args.latitude, args.longitude, r.venue_lat as number, r.venue_lon as number).toFixed(3)),
        }))
        .filter(r => r.distance_km <= args.radius_km)
        .sort((a, b) => a.distance_km - b.distance_km)
        .slice(0, limit);
    },

    eventsInBbox(_: unknown, args: { min_lat: number; min_lon: number; max_lat: number; max_lon: number; first?: number }) {
      const db  = getDb();
      const lim = args.first ?? 50;
      const rows = db.prepare(`
        ${EVENT_JOIN}
        WHERE v.latitude  BETWEEN ? AND ?
          AND v.longitude BETWEEN ? AND ?
        ORDER BY e.starts_at ASC
        LIMIT ?
      `).all(args.min_lat, args.max_lat, args.min_lon, args.max_lon, lim) as Record<string, unknown>[];
      return rows.map(rowToEvent);
    },

    eventsByTimeWindow(_: unknown, args: {
      starts_at: string; ends_at: string;
      status?: string; category?: string; first?: number; after?: string;
    }) {
      const db = getDb();
      const limit = Math.min(args.first ?? 20, 200);
      const conditions = ['e.starts_at < ?', 'e.ends_at > ?'];
      const params: (string | number)[] = [args.ends_at, args.starts_at];

      if (args.status)   { conditions.push('e.status = ?');   params.push(args.status); }
      if (args.category) { conditions.push('e.category = ?'); params.push(args.category); }

      if (args.after) {
        const cursor = decodeCursor(args.after);
        if (cursor) {
          const { sql, params: cp } = buildCursorWhere(cursor, 'asc');
          conditions.push(sql);
          params.push(...cp);
        }
      }

      params.push(limit + 1);
      const rows = db.prepare(`
        ${EVENT_JOIN}
        WHERE ${conditions.join(' AND ')}
        ORDER BY e.starts_at ASC, e.id ASC
        LIMIT ?
      `).all(...params) as Record<string, unknown>[];

      return buildConnection(rows.map(rowToEvent), limit, 'starts_at', () =>
        (db.prepare(`SELECT COUNT(*) AS cnt FROM events WHERE starts_at < ? AND ends_at > ?`)
          .get(args.ends_at, args.starts_at) as { cnt: number }).cnt
      );
    },
  },

  Mutation: {
    createEvent(_: unknown, args: { input: Record<string, unknown> }, ctx: Context) {
      const user = requireLogin(ctx);
      const db   = getDb();
      const body = args.input;

      const venue = db.prepare('SELECT id FROM venues WHERE id = ?').get(body['venue_id'] as string);
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
      `).run({
        ...body,
        id,
        status: body['status'] ?? 'published',
        organizer_id: user.sub,
        created_at: now,
        updated_at: now,
      });

      const row = db.prepare(`${EVENT_JOIN} WHERE e.id = ?`).get(id) as Record<string, unknown>;
      return rowToEvent(row);
    },

    updateEvent(_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: Context) {
      const user = requireLogin(ctx);
      const db   = getDb();
      const existing = db.prepare('SELECT organizer_id FROM events WHERE id = ?').get(args.id) as { organizer_id: string } | undefined;
      if (!existing) throw new AppError('EVENT_NOT_FOUND');
      if (existing.organizer_id !== user.sub && user.role !== 'admin') throw new AppError('FORBIDDEN');

      const fields = Object.keys(args.input).map(k => `${k} = @${k}`).join(', ');
      const now = new Date().toISOString();
      db.prepare(`UPDATE events SET ${fields}, updated_at = @updated_at WHERE id = @id`)
        .run({ ...args.input, updated_at: now, id: args.id });

      const row = db.prepare(`${EVENT_JOIN} WHERE e.id = ?`).get(args.id) as Record<string, unknown>;
      return rowToEvent(row);
    },

    cancelEvent(_: unknown, args: { id: string }, ctx: Context) {
      const user = requireLogin(ctx);
      const db   = getDb();
      const existing = db.prepare('SELECT organizer_id FROM events WHERE id = ?').get(args.id) as { organizer_id: string } | undefined;
      if (!existing) throw new AppError('EVENT_NOT_FOUND');
      if (existing.organizer_id !== user.sub && user.role !== 'admin') throw new AppError('FORBIDDEN');

      const now = new Date().toISOString();
      db.prepare(`UPDATE events SET status = 'cancelled', updated_at = ? WHERE id = ?`).run(now, args.id);
      const row = db.prepare(`${EVENT_JOIN} WHERE e.id = ?`).get(args.id) as Record<string, unknown>;
      return rowToEvent(row);
    },
  },

  // Field resolvers
  Event: {
    venue(parent: { venue_id: string; _venueRow: Record<string, unknown> }, _args: unknown, ctx: Context) {
      if (parent._venueRow && parent._venueRow['venue_lat']) {
        return rowToVenue(parent._venueRow);
      }
      return ctx.dataloaders.venueLoader.load(parent.venue_id);
    },

    tickets(parent: { id: string }, args: { first?: number; after?: string }) {
      const db    = getDb();
      const limit = Math.min(args.first ?? 20, 100);
      const conditions = ['t.event_id = ?'];
      const params: (string | number)[] = [parent.id];

      if (args.after) {
        const cursor = decodeCursor(args.after);
        if (cursor) {
          const { sql, params: cp } = buildCursorWhere(cursor, 'desc', 't');
          conditions.push(sql);
          params.push(...cp);
        }
      }

      params.push(limit + 1);
      const rows = db.prepare(`
        SELECT * FROM tickets t
        WHERE ${conditions.join(' AND ')}
        ORDER BY t.booked_at DESC
        LIMIT ?
      `).all(...params) as Record<string, unknown>[];

      return buildConnection(rows, limit, 'booked_at', () =>
        (db.prepare('SELECT COUNT(*) AS cnt FROM tickets WHERE event_id = ?').get(parent.id) as { cnt: number }).cnt
      );
    },

    price(parent: { min_price: number }) {
      return parent.min_price; // deprecated field
    },
  },
};
