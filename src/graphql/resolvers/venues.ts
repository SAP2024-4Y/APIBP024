import { getDb } from '../../db/database';
import { AppError } from '../../utils/errors';
import { encodeCursor, decodeCursor, buildCursorWhere } from '../../utils/cursor';
import { DataLoaders } from '../dataloaders';
import { JwtPayload } from '../../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

interface Context {
  user: JwtPayload | null;
  dataloaders: DataLoaders;
}

function venueRow(row: Record<string, unknown>) {
  return {
    id:         row.id,
    name:       row.name,
    address:    row.address,
    city:       row.city,
    country:    row.country,
    location:   { type: 'Point', coordinates: [row.longitude, row.latitude] },
    capacity:   row.capacity,
    created_at: row.created_at,
  };
}

export const venueResolvers = {
  Query: {
    venues(_: unknown, args: { first?: number; after?: string }) {
      const db    = getDb();
      const limit = Math.min(args.first ?? 20, 200);
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (args.after) {
        const cursor = decodeCursor(args.after);
        if (cursor) {
          const { sql, params: cp } = buildCursorWhere(cursor, 'asc', '');
          // Remove table alias for simple venues query
          conditions.push(sql.replace(/\w+\./g, ''));
          params.push(...cp);
        }
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limit + 1);
      const rows = db.prepare(`SELECT * FROM venues ${where} ORDER BY name ASC, id ASC LIMIT ?`).all(...params) as Record<string, unknown>[];
      const hasMore = rows.length > limit;
      const items   = hasMore ? rows.slice(0, limit) : rows;
      const edges   = items.map(r => ({
        cursor: encodeCursor('name', r.name as string, r.id as string),
        node:   venueRow(r),
      }));
      const total = (db.prepare('SELECT COUNT(*) AS cnt FROM venues').get() as { cnt: number }).cnt;

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
    },

    venue(_: unknown, args: { id: string }) {
      const db  = getDb();
      const row = db.prepare('SELECT * FROM venues WHERE id = ?').get(args.id) as Record<string, unknown> | undefined;
      return row ? venueRow(row) : null;
    },
  },

  Mutation: {
    createVenue(_: unknown, args: { input: Record<string, unknown> }, ctx: Context) {
      if (!ctx.user) throw new AppError('AUTH_REQUIRED');
      const db  = getDb();
      const id  = uuidv4();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO venues (id, name, address, city, country, latitude, longitude, capacity, created_at)
        VALUES (@id, @name, @address, @city, @country, @latitude, @longitude, @capacity, @created_at)
      `).run({ ...args.input, id, created_at: now });

      const row = db.prepare('SELECT * FROM venues WHERE id = ?').get(id) as Record<string, unknown>;
      return venueRow(row);
    },
  },

  Venue: {
    events(parent: { id: string }, args: { first?: number; after?: string }) {
      const db    = getDb();
      const limit = Math.min(args.first ?? 20, 100);
      const rows  = db.prepare(`
        SELECT e.*,
               v.name AS venue_name, v.address AS venue_address, v.city AS venue_city,
               v.country AS venue_country, v.latitude AS venue_lat, v.longitude AS venue_lon,
               v.capacity AS venue_capacity
        FROM events e
        LEFT JOIN venues v ON v.id = e.venue_id
        WHERE e.venue_id = ?
        ORDER BY e.starts_at ASC
        LIMIT ?
      `).all(parent.id, limit + 1) as Record<string, unknown>[];

      const hasMore = rows.length > limit;
      const items   = hasMore ? rows.slice(0, limit) : rows;
      const edges   = items.map(r => ({
        cursor: encodeCursor('starts_at', r.starts_at as string, r.id as string),
        node: {
          id: r.id, title: r.title, description: r.description, status: r.status,
          category: r.category, min_price: r.min_price, max_price: r.max_price,
          price: null, venue_id: r.venue_id, _venueRow: r,
          starts_at: r.starts_at, ends_at: r.ends_at,
          total_seats: r.total_seats, available_seats: r.available_seats,
          organizer_id: r.organizer_id, created_at: r.created_at, updated_at: r.updated_at,
        },
      }));
      const total = (db.prepare('SELECT COUNT(*) AS cnt FROM events WHERE venue_id = ?').get(parent.id) as { cnt: number }).cnt;

      return {
        edges,
        pageInfo: { hasNextPage: hasMore, hasPreviousPage: false,
          startCursor: edges[0]?.cursor ?? null, endCursor: edges[edges.length - 1]?.cursor ?? null },
        total,
      };
    },
  },
};
