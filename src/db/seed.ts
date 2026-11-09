import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export function seedDatabase(db: Database.Database): void {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (existing.cnt > 0) return; // idempotent — skip if already seeded

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  // ── Users ──────────────────────────────────────────────────────────────────
  const demoPasswordHash = bcrypt.hashSync('demo-password', 10);
  const adminPasswordHash = bcrypt.hashSync('admin-secret-2026', 10);

  const adminId   = uuidv4();
  const demoId    = uuidv4();
  const org1Id    = uuidv4();
  const org2Id    = uuidv4();

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password_hash, email, role, created_at)
    VALUES (@id, @username, @password_hash, @email, @role, @created_at)
  `);

  insertUser.run({ id: adminId,  username: 'admin',     password_hash: adminPasswordHash, email: 'admin@ticketsphere.io',    role: 'admin',     created_at: now });
  insertUser.run({ id: demoId,   username: 'demo',      password_hash: demoPasswordHash,  email: 'demo@ticketsphere.io',     role: 'attendee',  created_at: now });
  insertUser.run({ id: org1Id,   username: 'eventco',   password_hash: demoPasswordHash,  email: 'eventco@ticketsphere.io',  role: 'organizer', created_at: now });
  insertUser.run({ id: org2Id,   username: 'livemusic', password_hash: demoPasswordHash,  email: 'livemusic@ticketsphere.io',role: 'organizer', created_at: now });

  // ── Venues ─────────────────────────────────────────────────────────────────
  const venues = [
    { id: uuidv4(), name: 'Madison Square Garden',   address: '4 Pennsylvania Plaza',          city: 'New York',    country: 'US', latitude: 40.7505,  longitude: -73.9934,  capacity: 20789 },
    { id: uuidv4(), name: 'O2 Arena',                address: 'Peninsula Square',               city: 'London',      country: 'GB', latitude: 51.5031,  longitude:   0.0031,  capacity: 20000 },
    { id: uuidv4(), name: 'Sydney Opera House',      address: 'Bennelong Point',               city: 'Sydney',      country: 'AU', latitude: -33.8568, longitude: 151.2153,  capacity:  2679 },
    { id: uuidv4(), name: 'Tokyo Dome',              address: '1-3-61 Koraku',                 city: 'Tokyo',       country: 'JP', latitude: 35.7057,  longitude: 139.7519,  capacity: 55000 },
    { id: uuidv4(), name: 'Crypto.com Arena',        address: '1111 S Figueroa Street',         city: 'Los Angeles', country: 'US', latitude: 34.0430,  longitude: -118.2673, capacity: 21000 },
    { id: uuidv4(), name: 'Red Rocks Amphitheatre',  address: '18300 W Alameda Pkwy',          city: 'Denver',      country: 'US', latitude: 39.6654,  longitude: -105.2057, capacity:  9525 },
    { id: uuidv4(), name: 'Palais des Congrès',      address: '2 Place de la Porte Maillot',   city: 'Paris',       country: 'FR', latitude: 48.8791,  longitude:   2.2848,  capacity: 35000 },
  ];

  const insertVenue = db.prepare(`
    INSERT INTO venues (id, name, address, city, country, latitude, longitude, capacity, created_at)
    VALUES (@id, @name, @address, @city, @country, @latitude, @longitude, @capacity, @created_at)
  `);
  for (const v of venues) insertVenue.run({ ...v, created_at: now });

  // ── Events ─────────────────────────────────────────────────────────────────
  const [msg, o2, soh, tokyo, cca, redRocks, palais] = venues;

  const insertEvent = db.prepare(`
    INSERT INTO events (id, title, description, status, category, min_price, max_price,
                        venue_id, starts_at, ends_at, total_seats, available_seats,
                        organizer_id, created_at, updated_at)
    VALUES (@id, @title, @description, @status, @category, @min_price, @max_price,
            @venue_id, @starts_at, @ends_at, @total_seats, @available_seats,
            @organizer_id, @created_at, @updated_at)
  `);

  const events = [
    // ── Music ─────────────────────────────────────────────────────────────
    { id: uuidv4(), title: 'Taylor Swift - Eras Tour',        description: 'The spectacular Eras Tour comes to MSG.',           status: 'published',  category: 'music',      min_price: 99,   max_price: 499,  venue_id: msg.id,      starts_at: '2026-12-10T20:00:00Z', ends_at: '2026-12-10T23:30:00Z', total_seats: 20000, available_seats: 4800, organizer_id: org2Id },
    { id: uuidv4(), title: 'Ed Sheeran - Mathletics Tour',    description: 'Ed Sheeran live at the O2 Arena.',                  status: 'published',  category: 'music',      min_price: 55,   max_price: 220,  venue_id: o2.id,       starts_at: '2026-12-18T19:30:00Z', ends_at: '2026-12-18T22:30:00Z', total_seats: 18000, available_seats: 7200, organizer_id: org2Id },
    { id: uuidv4(), title: 'Coldplay - Music of the Spheres', description: 'Coldplay bring their iconic light show to Tokyo.',  status: 'published',  category: 'music',      min_price: 70,   max_price: 350,  venue_id: tokyo.id,    starts_at: '2026-12-22T18:00:00Z', ends_at: '2026-12-22T21:30:00Z', total_seats: 50000, available_seats: 19000,organizer_id: org2Id },
    { id: uuidv4(), title: 'Red Hot Chili Peppers',           description: 'RHCP rock Red Rocks under the stars.',              status: 'published',  category: 'music',      min_price: 85,   max_price: 180,  venue_id: redRocks.id, starts_at: '2026-11-20T20:00:00Z', ends_at: '2026-11-20T23:00:00Z', total_seats: 9000,  available_seats: 2500, organizer_id: org2Id },
    { id: uuidv4(), title: 'Billie Eilish - Hit Me Hard Tour',description: 'Billie Eilish performs at Crypto.com Arena.',       status: 'published',  category: 'music',      min_price: 75,   max_price: 300,  venue_id: cca.id,      starts_at: '2026-11-28T20:00:00Z', ends_at: '2026-11-28T23:00:00Z', total_seats: 20000, available_seats: 5500, organizer_id: org2Id },
    { id: uuidv4(), title: 'Opera Gala - Sydney Harbour',     description: 'World-class opera at the iconic Sydney Opera House.',status: 'published',  category: 'music',      min_price: 120,  max_price: 450,  venue_id: soh.id,      starts_at: '2026-12-05T19:00:00Z', ends_at: '2026-12-05T22:00:00Z', total_seats: 2500,  available_seats: 890,  organizer_id: org1Id },
    // ── Sports ────────────────────────────────────────────────────────────
    { id: uuidv4(), title: 'NBA Finals 2027 - Game 1',        description: 'Opening game of the NBA Finals series.',            status: 'published',  category: 'sports',     min_price: 150,  max_price: 1200, venue_id: cca.id,      starts_at: '2027-06-05T20:00:00Z', ends_at: '2027-06-05T23:30:00Z', total_seats: 21000, available_seats: 3000, organizer_id: org1Id },
    { id: uuidv4(), title: 'FIFA World Cup Qualifier - JPN vs KOR', description: 'High-stakes qualifier match at Tokyo Dome.', status: 'published',  category: 'sports',     min_price: 40,   max_price: 200,  venue_id: tokyo.id,    starts_at: '2026-11-15T14:00:00Z', ends_at: '2026-11-15T16:00:00Z', total_seats: 50000, available_seats: 12000,organizer_id: org1Id },
    { id: uuidv4(), title: 'Wimbledon Warm-up Invitational',  description: 'Pre-season tennis invitational at O2.',             status: 'published',  category: 'sports',     min_price: 30,   max_price: 150,  venue_id: o2.id,       starts_at: '2026-11-25T10:00:00Z', ends_at: '2026-11-25T18:00:00Z', total_seats: 18000, available_seats: 6700, organizer_id: org1Id },
    { id: uuidv4(), title: 'Madison Square Garden Boxing Night',description: 'Championship boxing doubleheader.',               status: 'published',  category: 'sports',     min_price: 60,   max_price: 500,  venue_id: msg.id,      starts_at: '2026-12-14T19:00:00Z', ends_at: '2026-12-14T23:00:00Z', total_seats: 20000, available_seats: 8800, organizer_id: org1Id },
    // ── Tech ──────────────────────────────────────────────────────────────
    { id: uuidv4(), title: 'ReactConf 2026',                  description: 'The official React conference with keynotes & workshops.',status: 'published',category: 'tech',   min_price: 299,  max_price: 799,  venue_id: msg.id,      starts_at: '2026-11-12T09:00:00Z', ends_at: '2026-11-14T18:00:00Z', total_seats: 5000,  available_seats: 1200, organizer_id: org1Id },
    { id: uuidv4(), title: 'AI Summit Paris 2026',            description: 'Leading AI researchers and engineers converge.',     status: 'published',  category: 'conference', min_price: 450,  max_price: 1500, venue_id: palais.id,   starts_at: '2026-11-08T08:30:00Z', ends_at: '2026-11-10T17:00:00Z', total_seats: 8000,  available_seats: 2300, organizer_id: org1Id },
    { id: uuidv4(), title: 'Web3 & Blockchain Forum',         description: 'Decentralised finance and blockchain deep-dives.',   status: 'published',  category: 'tech',       min_price: 199,  max_price: 599,  venue_id: cca.id,      starts_at: '2026-12-02T09:00:00Z', ends_at: '2026-12-03T18:00:00Z', total_seats: 3000,  available_seats: 1450, organizer_id: org1Id },
    { id: uuidv4(), title: 'DevOps Days Sydney',              description: 'Two days of talks on CI/CD, containers and SRE.',    status: 'published',  category: 'conference', min_price: 150,  max_price: 350,  venue_id: soh.id,      starts_at: '2026-11-22T09:00:00Z', ends_at: '2026-11-23T17:00:00Z', total_seats: 2000,  available_seats: 980,  organizer_id: org1Id },
    // ── Food ──────────────────────────────────────────────────────────────
    { id: uuidv4(), title: 'NYC Food & Wine Festival',        description: 'Five days of world-class gastronomy in New York.',   status: 'published',  category: 'food',       min_price: 25,   max_price: 120,  venue_id: msg.id,      starts_at: '2026-11-06T11:00:00Z', ends_at: '2026-11-10T21:00:00Z', total_seats: 15000, available_seats: 9800, organizer_id: org1Id },
    { id: uuidv4(), title: 'Tokyo Ramen Festival',            description: 'Over 30 ramen chefs compete for the golden bowl.',   status: 'published',  category: 'food',       min_price: 15,   max_price: 50,   venue_id: tokyo.id,    starts_at: '2026-11-30T10:00:00Z', ends_at: '2026-12-01T20:00:00Z', total_seats: 8000,  available_seats: 3400, organizer_id: org2Id },
    // ── Art ───────────────────────────────────────────────────────────────
    { id: uuidv4(), title: 'Modern Masters - Paris Exhibition',description: 'Curated collection of 20th-century masterworks.',   status: 'published',  category: 'art',        min_price: 20,   max_price: 60,   venue_id: palais.id,   starts_at: '2026-11-15T10:00:00Z', ends_at: '2027-01-15T20:00:00Z', total_seats: 1000,  available_seats: 700,  organizer_id: org1Id },
    { id: uuidv4(), title: 'Street Art Biennale Sydney',      description: 'Celebrating street art with live mural sessions.',   status: 'published',  category: 'art',        min_price: 0,    max_price: 35,   venue_id: soh.id,      starts_at: '2026-12-12T10:00:00Z', ends_at: '2026-12-14T18:00:00Z', total_seats: 2000,  available_seats: 1600, organizer_id: org2Id },
    // ── Comedy ────────────────────────────────────────────────────────────
    { id: uuidv4(), title: 'Dave Chappelle - Comedy Night',   description: 'An evening with one of comedy\'s greatest minds.',   status: 'published',  category: 'comedy',     min_price: 80,   max_price: 250,  venue_id: o2.id,       starts_at: '2026-12-08T20:00:00Z', ends_at: '2026-12-08T22:30:00Z', total_seats: 16000, available_seats: 4200, organizer_id: org2Id },
    { id: uuidv4(), title: 'Stand-Up Summit Los Angeles',     description: '12 top stand-up comics for one epic night.',         status: 'published',  category: 'comedy',     min_price: 50,   max_price: 150,  venue_id: cca.id,      starts_at: '2026-11-17T19:30:00Z', ends_at: '2026-11-17T22:30:00Z', total_seats: 19000, available_seats: 7700, organizer_id: org2Id },
    // ── Theatre ───────────────────────────────────────────────────────────
    { id: uuidv4(), title: 'Hamilton - West End Revival',     description: 'The award-winning musical returns to the West End.',  status: 'published',  category: 'theatre',    min_price: 40,   max_price: 200,  venue_id: o2.id,       starts_at: '2026-11-10T19:30:00Z', ends_at: '2026-11-10T22:00:00Z', total_seats: 15000, available_seats: 6500, organizer_id: org1Id },
    { id: uuidv4(), title: 'Phantom of the Opera - Sydney',   description: 'The classic phantom returns to the Opera House.',    status: 'published',  category: 'theatre',    min_price: 60,   max_price: 280,  venue_id: soh.id,      starts_at: '2026-12-19T18:30:00Z', ends_at: '2026-12-19T21:30:00Z', total_seats: 2500,  available_seats: 1100, organizer_id: org1Id },
    // ── Edge cases for filtering ───────────────────────────────────────────
    { id: uuidv4(), title: 'Free Community Concert - Denver', description: 'Free outdoor concert at Red Rocks for the community.',status: 'published',  category: 'music',      min_price: 0,    max_price: 0,    venue_id: redRocks.id, starts_at: '2026-11-07T17:00:00Z', ends_at: '2026-11-07T20:00:00Z', total_seats: 9525, available_seats: 9525,  organizer_id: org2Id },
    { id: uuidv4(), title: 'Cancelled Music Festival',        description: 'Unfortunately this event had to be cancelled.',      status: 'cancelled',  category: 'music',      min_price: 50,   max_price: 150,  venue_id: msg.id,      starts_at: '2026-11-11T12:00:00Z', ends_at: '2026-11-11T23:00:00Z', total_seats: 10000, available_seats: 10000,organizer_id: org2Id },
    { id: uuidv4(), title: 'Past Tech Talk - October 2026',   description: 'A past conference (seeded for calendar queries).',   status: 'completed',  category: 'tech',       min_price: 0,    max_price: 0,    venue_id: palais.id,   starts_at: '2026-10-01T09:00:00Z', ends_at: '2026-10-01T17:00:00Z', total_seats: 500,   available_seats: 0,    organizer_id: org1Id },
  ];

  const seedTx = db.transaction(() => {
    for (const e of events) {
      insertEvent.run({ ...e, created_at: now, updated_at: now });
    }

    // A few pre-booked tickets for the demo user
    const insertTicket = db.prepare(`
      INSERT INTO tickets (id, event_id, user_id, status, price, seat_number, booked_at)
      VALUES (@id, @event_id, @user_id, @status, @price, @seat_number, @booked_at)
    `);
    insertTicket.run({ id: uuidv4(), event_id: events[0].id, user_id: demoId, status: 'confirmed', price: 149, seat_number: 'A-12', booked_at: now });
    insertTicket.run({ id: uuidv4(), event_id: events[3].id, user_id: demoId, status: 'confirmed', price: 95,  seat_number: 'B-7',  booked_at: now });
    insertTicket.run({ id: uuidv4(), event_id: events[10].id,user_id: demoId, status: 'confirmed', price: 399, seat_number: 'VIP-3',booked_at: now });

    // Update available_seats for those events
    db.prepare('UPDATE events SET available_seats = available_seats - 1 WHERE id = ?').run(events[0].id);
    db.prepare('UPDATE events SET available_seats = available_seats - 1 WHERE id = ?').run(events[3].id);
    db.prepare('UPDATE events SET available_seats = available_seats - 1 WHERE id = ?').run(events[10].id);
  });

  seedTx();
  console.log('[seed] Database seeded with', events.length, 'events,', venues.length, 'venues, 4 users, 3 tickets.');
}
