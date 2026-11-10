import type { Event, Ticket } from '../types'

const BASE = '/api/v1'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
  return json as T
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export async function login(username: string, password: string) {
  return req<{ token: string }>('/auth/token', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

// ── Events ───────────────────────────────────────────────────────────────────
export interface EventsParams {
  status?: string
  category?: string
  min_price?: number
  max_price?: number
  sort?: string
  order?: 'asc' | 'desc'
  limit?: number
  after?: string
}

export async function getEvent(id: string) {
  return req<{ data: Event }>(`/events/${id}`)
}

export async function getEvents(params: EventsParams = {}) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v))
  }
  return req<{ data: Event[]; pagination: { has_more: boolean; next_cursor: string | null } }>(
    `/events?${q}`
  )
}

export async function getNearbyEvents(lat: number, lon: number, radius_km: number) {
  return req<{ data: (Event & { distance_km: number })[] }>(
    `/events/nearby?latitude=${lat}&longitude=${lon}&radius_km=${radius_km}`
  )
}

export async function getBboxEvents(min_lat: number, min_lon: number, max_lat: number, max_lon: number) {
  return req<{ data: Event[] }>(
    `/events/bbox?min_lat=${min_lat}&min_lon=${min_lon}&max_lat=${max_lat}&max_lon=${max_lon}`
  )
}

export async function getSchedule(starts_at: string, ends_at: string) {
  return req<{ data: Event[]; pagination: { has_more: boolean; next_cursor: string | null } }>(
    `/events/schedule?starts_at=${encodeURIComponent(starts_at)}&ends_at=${encodeURIComponent(ends_at)}`
  )
}

// ── Tickets ──────────────────────────────────────────────────────────────────
export async function getMyTickets(token: string) {
  return req<{ data: Ticket[] }>('/tickets', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function bookTicket(eventId: string, quantity: number, token: string) {
  return req<{ data: Ticket[] }>('/tickets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ event_id: eventId, quantity }),
  })
}

export async function cancelTicket(id: string, token: string) {
  return req<{ data: { id: string; status: string } }>(`/tickets/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}
