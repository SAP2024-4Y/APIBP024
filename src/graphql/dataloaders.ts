import DataLoader from 'dataloader';
import { getDb } from '../db/database';

interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  capacity: number;
  created_at: string;
}

interface EventRow {
  id: string;
  [key: string]: unknown;
}

interface TicketRow {
  id: string;
  [key: string]: unknown;
}

export function createDataLoaders() {
  const db = getDb();

  const venueLoader = new DataLoader<string, Venue | null>(async (ids) => {
    const placeholders = ids.map(() => '?').join(',');
    const rows = db.prepare(`SELECT * FROM venues WHERE id IN (${placeholders})`).all(...ids) as Venue[];
    const map = new Map(rows.map(v => [v.id, {
      ...v,
      location: { type: 'Point', coordinates: [v.longitude, v.latitude] },
    }]));
    return ids.map(id => map.get(id) ?? null);
  });

  const eventsByVenueLoader = new DataLoader<string, EventRow[]>(async (venueIds) => {
    const placeholders = venueIds.map(() => '?').join(',');
    const rows = db.prepare(`SELECT * FROM events WHERE venue_id IN (${placeholders})`).all(...venueIds) as EventRow[];
    const map = new Map<string, EventRow[]>();
    for (const row of rows) {
      const venueId = row['venue_id'] as string;
      if (!map.has(venueId)) map.set(venueId, []);
      map.get(venueId)!.push(row);
    }
    return venueIds.map(id => map.get(id) ?? []);
  });

  const ticketsByEventLoader = new DataLoader<string, TicketRow[]>(async (eventIds) => {
    const placeholders = eventIds.map(() => '?').join(',');
    const rows = db.prepare(`SELECT * FROM tickets WHERE event_id IN (${placeholders}) AND status = 'confirmed'`).all(...eventIds) as TicketRow[];
    const map = new Map<string, TicketRow[]>();
    for (const row of rows) {
      const eventId = row['event_id'] as string;
      if (!map.has(eventId)) map.set(eventId, []);
      map.get(eventId)!.push(row);
    }
    return eventIds.map(id => map.get(id) ?? []);
  });

  return { venueLoader, eventsByVenueLoader, ticketsByEventLoader };
}

export type DataLoaders = ReturnType<typeof createDataLoaders>;
