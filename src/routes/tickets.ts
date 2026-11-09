import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database';
import { AppError } from '../utils/errors';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { encodeCursor, decodeCursor, buildCursorWhere } from '../utils/cursor';
import { v4 as uuidv4 } from 'uuid';
 
const router = Router();
 
const BookTicketSchema = z.object({
  event_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(10).optional().default(1),
});
 
function ticketToView(row: Record<string, unknown>) {
  return {
    id:               row.id,
    event_id:         row.event_id,
    event_title:      row.event_title,
    event_starts_at:  row.event_starts_at,
    venue_name:       row.venue_name,
    venue_city:       row.venue_city,
    user_id:          row.user_id,
    status:           row.status,
    price:            row.price,
    seat_number:      row.seat_number,
    booked_at:        row.booked_at,
    cancelled_at:     row.cancelled_at,
  };
}
 
const TICKET_JOIN = `
  SELECT t.*,
    e.title      AS event_title,
    e.starts_at  AS event_starts_at,
    v.name       AS venue_name,
    v.city       AS venue_city
  FROM tickets t
  LEFT JOIN events  e ON e.id = t.event_id
  LEFT JOIN venues  v ON v.id = e.venue_id
`;
 
// GET /api/v1/tickets  (authenticated — own tickets only unless admin)
router.get('/', requireAuth, (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query['limit']) || 20, 100);
    const after = req.query['after'] as string | undefined;
    const db = getDb();
 
    const isAdmin = req.user!.role === 'admin';
    const conditions: string[] = [];
    const params: (string | number)[] = [];
 
    if (!isAdmin) {
      conditions.push('t.user_id = ?');
      params.push(req.user!.sub);
    }
 
    if (after) {
      const cursor = decodeCursor(after);
      if (cursor) {
        const { sql, params: cp } = buildCursorWhere(cursor, 'desc', 't');
        conditions.push(sql);
        params.push(...cp);
      }
    }
 
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit + 1);
 
    const rows = db.prepare(`
      ${TICKET_JOIN}
      ${where}
      ORDER BY t.booked_at DESC, t.id DESC
      LIMIT ?
    `).all(...params) as Record<string, unknown>[];
 
    const hasMore = rows.length > limit;
    const items   = hasMore ? rows.slice(0, limit) : rows;
    const last    = items[items.length - 1] as Record<string, unknown> | undefined;
    const nextCursor = last && hasMore
      ? encodeCursor('booked_at', last.booked_at as string, last.id as string)
      : null;
 
    res.json({
      data: items.map(ticketToView),
      pagination: { limit, has_more: hasMore, next_cursor: nextCursor },
    });
  } catch (err) {
    next(err);
  }
});
 
// GET /api/v1/tickets/:id
router.get('/:id', requireAuth, (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const row = db.prepare(`${TICKET_JOIN} WHERE t.id = ?`).get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) throw new AppError('TICKET_NOT_FOUND');
    if (row.user_id !== req.user!.sub && req.user!.role !== 'admin') throw new AppError('FORBIDDEN');
    res.json({ data: ticketToView(row) });
  } catch (err) {
    next(err);
  }
});
 
// POST /api/v1/tickets  (book a ticket)
router.post('/', requireAuth, (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const { event_id, quantity } = BookTicketSchema.parse(req.body);
    const db = getDb();
 
    const bookTx = db.transaction(() => {
      const event = db.prepare('SELECT * FROM events WHERE id = ?').get(event_id) as {
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
        `).run({ id, event_id, user_id: req.user!.sub, price: event.min_price, seat_number: seatNumber, booked_at: now });
 
        tickets.push({ id, event_id, seat_number: seatNumber, price: event.min_price, status: 'confirmed', booked_at: now });
      }
 
      db.prepare('UPDATE events SET available_seats = available_seats - ?, updated_at = ? WHERE id = ?')
        .run(quantity, new Date().toISOString(), event_id);
 
      return tickets;
    });
 
    const created = bookTx();
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});
 
// DELETE /api/v1/tickets/:id  (cancel a ticket)
router.delete('/:id', requireAuth, (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id) as {
      id: string; user_id: string; event_id: string; status: string;
    } | undefined;
 
    if (!ticket) throw new AppError('TICKET_NOT_FOUND');
    if (ticket.user_id !== req.user!.sub && req.user!.role !== 'admin') throw new AppError('FORBIDDEN');
    if (ticket.status === 'cancelled') throw new AppError('TICKET_ALREADY_CANCELLED');
 
    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare(`UPDATE tickets SET status = 'cancelled', cancelled_at = ? WHERE id = ?`)
        .run(now, ticket.id);
      db.prepare('UPDATE events SET available_seats = available_seats + 1, updated_at = ? WHERE id = ?')
        .run(now, ticket.event_id);
    })();
 
    res.json({ data: { id: ticket.id, status: 'cancelled', cancelled_at: now } });
  } catch (err) {
    next(err);
  }
});
 
export default router;
 