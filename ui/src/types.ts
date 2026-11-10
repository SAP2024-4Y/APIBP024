export interface Venue {
  id: string
  name: string
  address: string
  city: string
  country: string
  location: { type: string; coordinates: [number, number] } // [lon, lat]
  capacity: number
}

export interface Event {
  id: string
  title: string
  description: string
  status: 'draft' | 'published' | 'cancelled' | 'completed'
  category: string
  min_price: number
  max_price: number
  venue: Venue
  starts_at: string
  ends_at: string
  total_seats: number
  available_seats: number
  organizer_id: string
  created_at: string
  updated_at: string
}

export interface Ticket {
  id: string
  event_id: string
  event_title?: string
  event_starts_at?: string
  venue_name?: string
  venue_city?: string
  user_id: string
  status: 'confirmed' | 'cancelled' | 'used'
  price: number
  seat_number: string | null
  booked_at: string
  cancelled_at: string | null
}

export interface User {
  id: string
  username: string
  role: string
}

export interface Pagination {
  limit: number
  has_more: boolean
  next_cursor: string | null
}

export type View = 'dashboard' | 'events' | 'map' | 'calendar' | 'tickets' | 'profile'

export const CATEGORIES = [
  'music', 'sports', 'tech', 'food', 'art', 'comedy', 'theatre', 'conference', 'other',
] as const

export const CATEGORY_COLORS: Record<string, string> = {
  music:      'bg-pink-500/20 text-pink-300 border-pink-500/30',
  sports:     'bg-green-500/20 text-green-300 border-green-500/30',
  tech:       'bg-blue-500/20 text-blue-300 border-blue-500/30',
  food:       'bg-orange-500/20 text-orange-300 border-orange-500/30',
  art:        'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  comedy:     'bg-purple-500/20 text-purple-300 border-purple-500/30',
  theatre:    'bg-red-500/20 text-red-300 border-red-500/30',
  conference: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  other:      'bg-slate-500/20 text-slate-300 border-slate-500/30',
}

export const CATEGORY_GRADIENTS: Record<string, string> = {
  music:      'from-pink-900 to-purple-900',
  sports:     'from-green-900 to-emerald-900',
  tech:       'from-blue-900 to-indigo-900',
  food:       'from-orange-900 to-red-900',
  art:        'from-yellow-900 to-orange-900',
  comedy:     'from-purple-900 to-violet-900',
  theatre:    'from-red-900 to-rose-900',
  conference: 'from-cyan-900 to-blue-900',
  other:      'from-slate-800 to-slate-900',
}
