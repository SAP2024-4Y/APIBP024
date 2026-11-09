import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database';
import { AppError } from '../utils/errors';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const BookSchema = z.object({
  event_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(10),
});

// ── POST /api/v1/tickets  (book) ──────────────────────────────────────────────
router.post('/', requireAuth, (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const body = BookSchema.parse(req.body);
    const db   = getDb();

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(body.event_id) as
      { id: string; status: string; available_seats: number; min_price: number } | undefined;

    if (!event) throw new AppError('EVENT_NOT_FOUND');
    if (event.status === 'cancelled') throw new AppError('EVENT_CANCELLED');
    if (event.available_seats < body.quantity) throw new AppError('EVENT_SOLD_OUT');

    const now = new Date().toISOString();

    const insertTicket = db.prepare(`
      INSERT INTO tickets (id, event_id, user_id, status, price, seat_number, booked_at)
      VALUES (@id, @event_id, @user_id, 'confirmed', @price, @seat_number, @booked_at)
    `);

    const updateSeats = db.prepare(
      'UPDATE events SET available_seats = available_seats - 1, updated_at = ? WHERE id = ?'
    );

    const tickets = db.transaction(() => {
      const created = [];
      for (let i = 0; i < body.quantity; i++) {
        const id = uuidv4();
        const seatNumber = `S${Math.floor(Math.random() * 9000) + 1000}`;
        insertTicket.run({ id, event_id: body.event_id, user_id: req.user!.sub, price: event.min_price, seat_number: seatNumber, booked_at: now });
        updateSeats.run(now, body.event_id);
        created.push(db.prepare('SELECT * FROM tickets WHERE id = ?').get(id));
      }
      return created;
    })();

    res.status(201).json({ data: tickets });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/tickets  (list my tickets) ────────────────────────────────────
router.get('/', requireAuth, (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const tickets = db.prepare(`
      SELECT t.*, e.title AS event_title, e.starts_at, e.ends_at
      FROM tickets t
      JOIN events e ON e.id = t.event_id
      WHERE t.user_id = ?
      ORDER BY t.booked_at DESC
    `).all(req.user!.sub);

    res.json({ data: tickets });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/v1/tickets/:id  (cancel) ─────────────────────────────────────
router.delete('/:id', requireAuth, (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id) as
      { id: string; user_id: string; event_id: string; status: string } | undefined;

    if (!ticket) throw new AppError('TICKET_NOT_FOUND');
    if (ticket.user_id !== req.user!.sub && req.user!.role !== 'admin') throw new AppError('FORBIDDEN');
    if (ticket.status === 'cancelled') throw new AppError('TICKET_ALREADY_CANCELLED');

    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare('UPDATE tickets SET status = ?, cancelled_at = ? WHERE id = ?').run('cancelled', now, ticket.id);
      db.prepare('UPDATE events SET available_seats = available_seats + 1, updated_at = ? WHERE id = ?').run(now, ticket.event_id);
    })();

    const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticket.id);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
