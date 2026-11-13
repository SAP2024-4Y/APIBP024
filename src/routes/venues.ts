import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database';
import { AppError } from '../utils/errors';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { haversineDistance, radiusToBbox } from '../utils/geo';
import { v4 as uuidv4 } from 'uuid';
 
const router = Router();
 
const CreateVenueSchema = z.object({
  name:     z.string().min(1).max(200),
  address:  z.string().min(1),
  city:     z.string().min(1),
  country:  z.string().length(2).toUpperCase(),
  latitude: z.number().min(-90).max(90),
  longitude:z.number().min(-180).max(180),
  capacity: z.number().int().positive(),
});
 
function venueToGeoJson(row: Record<string, unknown>) {
  return {
    id:       row.id,
    name:     row.name,
    address:  row.address,
    city:     row.city,
    country:  row.country,
    location: { type: 'Point', coordinates: [row.longitude, row.latitude] },
    capacity: row.capacity,
    created_at: row.created_at,
  };
}
 
// GET /api/v1/venues
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const limit  = Math.min(Number(req.query['limit'])  || 50, 200);
    const offset = Number(req.query['offset']) || 0;
    const rows = db.prepare('SELECT * FROM venues ORDER BY name ASC LIMIT ? OFFSET ?').all(limit, offset) as Record<string, unknown>[];
    const total = (db.prepare('SELECT COUNT(*) as cnt FROM venues').get() as { cnt: number }).cnt;
    res.json({ data: rows.map(venueToGeoJson), total });
  } catch (err) {
    next(err);
  }
});
 
// GET /api/v1/venues/nearby
router.get('/nearby', (req: Request, res: Response, next: NextFunction) => {
  try {
    const lat  = parseFloat(req.query['latitude']  as string);
    const lon  = parseFloat(req.query['longitude'] as string);
    const rad  = parseFloat(req.query['radius_km'] as string);
    if (isNaN(lat) || isNaN(lon) || isNaN(rad)) {
      throw new AppError('VALIDATION_ERROR', 'latitude, longitude, and radius_km are required numbers.');
    }
    const db = getDb();
    const bbox = radiusToBbox(lat, lon, rad);
    const rows = db.prepare(`
      SELECT * FROM venues
      WHERE latitude  BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
    `).all(bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon) as Record<string, unknown>[];
 
    const withDist = rows
      .map(v => ({
        ...venueToGeoJson(v),
        distance_km: parseFloat(haversineDistance(lat, lon, v.latitude as number, v.longitude as number).toFixed(3)),
      }))
      .filter(v => v.distance_km <= rad)
      .sort((a, b) => a.distance_km - b.distance_km);
 
    res.json({ data: withDist, total: withDist.length });
  } catch (err) {
    next(err);
  }
});
 
// GET /api/v1/venues/search?q=<name or city>
router.get('/search', (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = ((req.query['q'] as string) || '').trim();
    if (!q) throw new AppError('VALIDATION_ERROR', 'Query parameter "q" is required.');
    const db = getDb();
    const pattern = `%${q}%`;
    const rows = db.prepare(`
      SELECT * FROM venues
      WHERE name LIKE ? OR city LIKE ?
      ORDER BY name ASC LIMIT 50
    `).all(pattern, pattern) as Record<string, unknown>[];
    res.json({ data: rows.map(venueToGeoJson), total: rows.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/venues/:id/events?status=<status>
router.get('/:id/events', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const venue = db.prepare('SELECT id FROM venues WHERE id = ?').get(req.params.id);
    if (!venue) throw new AppError('VENUE_NOT_FOUND');
    const status = req.query['status'] as string | undefined;
    const rows = status
      ? db.prepare('SELECT * FROM events WHERE venue_id = ? AND status = ? ORDER BY starts_at ASC').all(req.params.id, status)
      : db.prepare('SELECT * FROM events WHERE venue_id = ? ORDER BY starts_at ASC').all(req.params.id);
    res.json({ data: rows, total: (rows as unknown[]).length });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/venues/:id
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM venues WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) throw new AppError('VENUE_NOT_FOUND');
    res.json({ data: venueToGeoJson(row) });
  } catch (err) {
    next(err);
  }
});
 
// POST /api/v1/venues
router.post('/', requireAuth, (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const body = CreateVenueSchema.parse(req.body);
    const db = getDb();
    const id  = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO venues (id, name, address, city, country, latitude, longitude, capacity, created_at)
      VALUES (@id, @name, @address, @city, @country, @latitude, @longitude, @capacity, @created_at)
    `).run({ ...body, id, created_at: now });
 
    const row = db.prepare('SELECT * FROM venues WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json({ data: venueToGeoJson(row) });
  } catch (err) {
    next(err);
  }
});
 
// PUT /api/v1/venues/:id
router.put('/:id', requireAuth, (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const body = CreateVenueSchema.partial().parse(req.body);
    const db = getDb();
    const existing = db.prepare('SELECT id FROM venues WHERE id = ?').get(req.params.id);
    if (!existing) throw new AppError('VENUE_NOT_FOUND');
    if (req.user!.role !== 'admin' && req.user!.role !== 'organizer') throw new AppError('FORBIDDEN');
 
    const fields = Object.keys(body).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE venues SET ${fields} WHERE id = @id`).run({ ...body, id: req.params.id });
 
    const row = db.prepare('SELECT * FROM venues WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json({ data: venueToGeoJson(row) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/venues/:id  (admin only; blocked when active or draft events exist)
router.delete('/:id', requireAuth, (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM venues WHERE id = ?').get(req.params.id);
    if (!existing) throw new AppError('VENUE_NOT_FOUND');
    if (req.user!.role !== 'admin') throw new AppError('FORBIDDEN');
    const { cnt } = db.prepare(
      "SELECT COUNT(*) as cnt FROM events WHERE venue_id = ? AND status IN ('published','draft')"
    ).get(req.params.id) as { cnt: number };
    if (cnt > 0) throw new AppError('VALIDATION_ERROR', 'Cannot delete a venue that has active or draft events.');
    db.prepare('DELETE FROM venues WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
 