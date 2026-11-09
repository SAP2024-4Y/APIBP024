import { getDb } from '../../db/database';
import { AppError } from '../../utils/errors';
import { encodeCursor, decodeCursor, buildCursorWhere } from '../../utils/cursor';
import { JwtPayload } from '../../middleware/auth';
import { DataLoaders } from '../dataloaders';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

interface Context {
  user: JwtPayload | null;
  dataloaders: DataLoaders;
}

function requireLogin(ctx: Context): JwtPayload {
  if (!ctx.user) throw new AppError('AUTH_REQUIRED');
  return ctx.user;
}

function ticketRow(row: Record<string, unknown>) {
  return {
    id:           row.id,
    event_id:     row.event_id,
    user_id:      row.user_id,
    status:       row.status,
    price:        row.price,
    seat_number:  row.seat_number,
    booked_at:    row.booked_at,
    cancelled_at: row.cancelled_at,
  };
}

const TICKET_JOIN_SQL = `
  SELECT t.*,
         e.title            AS event_title,
         e.description      AS event_description,
         e.status           AS event_status,
         e.category         AS event_category,
         e.min_price        AS event_min_price,
         e.max_price        AS event_max_price,
         e.venue_id         AS event_venue_id,
         e.starts_at        AS event_starts_at,
         e.ends_at          AS event_ends_at,
         e.total_seats      AS event_total_seats,
         e.available_seats  AS event_available_seats,
         e.organizer_id     AS event_organizer_id,
         e.created_at       AS event_created_at,
         e.updated_at       AS event_updated_at
  FROM tickets t
  LEFT JOIN events e ON e.id = t.event_id
`;

export const ticketResolvers = {
  Query: {
    tickets(_: unknown, args: { first?: number; after?: string }, ctx: Context) {
      const user  = requireLogin(ctx);
      const db    = getDb();
      const limit = Math.min(args.first ?? 20, 100);
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (user.role !== 'admin') {
        conditions.push('t.user_id = ?');
        params.push(user.sub);
      }

      if (args.after) {
        const cursor = decodeCursor(args.after);
        if (cursor) {
          const { sql, params: cp } = buildCursorWhere(cursor, 'desc', 't');
          conditions.push(sql);
          params.push(...cp);
        }
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limit + 1);

      const rows = db.prepare(`
        ${TICKET_JOIN_SQL}
        ${where}
        ORDER BY t.booked_at DESC, t.id DESC
        LIMIT ?
      `).all(...params) as Record<string, unknown>[];

      const hasMore = rows.length > limit;
      const items   = hasMore ? rows.slice(0, limit) : rows;
      const edges   = items.map(r => ({
        cursor: encodeCursor('booked_at', r.booked_at as string, r.id as string),
        node:   ticketRow(r),
      }));
      const countQuery = user.role === 'admin'
        ? db.prepare('SELECT COUNT(*) AS cnt FROM tickets').get() as { cnt: number }
        : db.prepare('SELECT COUNT(*) AS cnt FROM tickets WHERE user_id = ?').get(user.sub) as { cnt: number };

      return {
        edges,
        pageInfo: { hasNextPage: hasMore, hasPreviousPage: false,
          startCursor: edges[0]?.cursor ?? null, endCursor: edges[edges.length - 1]?.cursor ?? null },
        total: countQuery.cnt,
      };
    },

    ticket(_: unknown, args: { id: string }, ctx: Context) {
      const user = requireLogin(ctx);
      const db   = getDb();
      const row  = db.prepare(`${TICKET_JOIN_SQL} WHERE t.id = ?`).get(args.id) as Record<string, unknown> | undefined;
      if (!row) throw new AppError('TICKET_NOT_FOUND');
      if (row.user_id !== user.sub && user.role !== 'admin') throw new AppError('FORBIDDEN');
      return ticketRow(row);
    },

    me(_: unknown, __: unknown, ctx: Context) {
      const user = requireLogin(ctx);
      const db   = getDb();
      const row  = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(user.sub) as Record<string, unknown> | undefined;
      if (!row) throw new AppError('USER_NOT_FOUND');
      return row;
    },
  },

  Mutation: {
    login(_: unknown, args: { username: string; password: string }) {
      const db   = getDb();
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(args.username) as {
        id: string; username: string; password_hash: string; email: string; role: string;
      } | undefined;
      if (!user || !bcrypt.compareSync(args.password, user.password_hash)) {
        throw new AppError('AUTH_INVALID_CREDENTIALS');
      }
      const secret = process.env.JWT_SECRET || 'super-secret-jwt-key';
      const token  = jwt.sign({ sub: user.id, username: user.username, role: user.role }, secret, { expiresIn: '24h' });
      return {
        token,
        token_type: 'Bearer',
        expires_in: 86400,
        user: { id: user.id, username: user.username, email: user.email, role: user.role },
      };
    },

    bookTicket(_: unknown, args: { eventId: string; quantity?: number }, ctx: Context) {
      const user     = requireLogin(ctx);
      const quantity = args.quantity ?? 1;
      const db       = getDb();

      const booked = db.transaction(() => {
        const event = db.prepare('SELECT * FROM events WHERE id = ?').get(args.eventId) as {
          id: string; status: string; min_price: number; available_seats: number; total_seats: number;
        } | undefined;
        if (!event) throw new AppError('EVENT_NOT_FOUND');
        if (event.status === 'cancelled') throw new AppError('EVENT_CANCELLED');
        if (event.status === 'completed') throw new AppError('EVENT_CANCELLED');
        if (event.available_seats < quantity) throw new AppError('EVENT_SOLD_OUT');

        const tickets = [];
        for (let i = 0; i < quantity; i++) {
          const id         = uuidv4();
          const now        = new Date().toISOString();
          const seatOffset = event.total_seats - event.available_seats + i + 1;
          const seatNumber = `S-${String(seatOffset).padStart(4, '0')}`;

          db.prepare(`
            INSERT INTO tickets (id, event_id, user_id, status, price, seat_number, booked_at)
            VALUES (@id, @event_id, @user_id, 'confirmed', @price, @seat_number, @booked_at)
          `).run({ id, event_id: args.eventId, user_id: user.sub, price: event.min_price, seat_number: seatNumber, booked_at: now });

          tickets.push({ id, event_id: args.eventId, user_id: user.sub, status: 'confirmed', price: event.min_price, seat_number: seatNumber, booked_at: now, cancelled_at: null });
        }

        db.prepare('UPDATE events SET available_seats = available_seats - ?, updated_at = ? WHERE id = ?')
          .run(quantity, new Date().toISOString(), args.eventId);

        return tickets;
      })();

      return booked;
    },

    cancelTicket(_: unknown, args: { id: string }, ctx: Context) {
      const user = requireLogin(ctx);
      const db   = getDb();
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(args.id) as {
        id: string; user_id: string; event_id: string; status: string;
      } | undefined;
      if (!ticket) throw new AppError('TICKET_NOT_FOUND');
      if (ticket.user_id !== user.sub && user.role !== 'admin') throw new AppError('FORBIDDEN');
      if (ticket.status === 'cancelled') throw new AppError('TICKET_ALREADY_CANCELLED');

      const now = new Date().toISOString();
      db.transaction(() => {
        db.prepare(`UPDATE tickets SET status = 'cancelled', cancelled_at = ? WHERE id = ?`).run(now, ticket.id);
        db.prepare('UPDATE events SET available_seats = available_seats + 1, updated_at = ? WHERE id = ?').run(now, ticket.event_id);
      })();

      return { id: ticket.id, event_id: ticket.event_id, user_id: ticket.user_id, status: 'cancelled',
        price: null, seat_number: null, booked_at: null, cancelled_at: now };
    },
  },

  Ticket: {
    event(parent: { event_id: string }, _args: unknown, ctx: Context) {
      return ctx.dataloaders.venueLoader.load(parent.event_id).then(() => {
        const db = getDb();
        const row = db.prepare(`
          SELECT e.*,
                 v.name AS venue_name, v.address AS venue_address, v.city AS venue_city,
                 v.country AS venue_country, v.latitude AS venue_lat, v.longitude AS venue_lon,
                 v.capacity AS venue_capacity
          FROM events e
          LEFT JOIN venues v ON v.id = e.venue_id
          WHERE e.id = ?
        `).get(parent.event_id) as Record<string, unknown> | undefined;
        if (!row) throw new AppError('EVENT_NOT_FOUND');
        return {
          id: row.id, title: row.title, description: row.description, status: row.status,
          category: row.category, min_price: row.min_price, max_price: row.max_price, price: null,
          venue_id: row.venue_id, _venueRow: row,
          starts_at: row.starts_at, ends_at: row.ends_at,
          total_seats: row.total_seats, available_seats: row.available_seats,
          organizer_id: row.organizer_id, created_at: row.created_at, updated_at: row.updated_at,
        };
      });
    },
  },
};
