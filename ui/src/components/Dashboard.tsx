import { useEffect, useState } from 'react'
import type { Event, View } from '../types'
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_GRADIENTS } from '../types'
import { getEvents } from '../api/client'
import EventCard from './EventCard'

interface Props {
  username: string
  onNavigate: (v: View, opts?: { category?: string }) => void
  onBook: (event: Event) => void
}

interface Stats {
  total: number
  upcoming: number
  free: number
  cities: number
}

const CATEGORY_HEX: Record<string, string> = {
  music: '#ec4899', sports: '#22c55e', tech: '#3b82f6',
  food: '#f97316', art: '#eab308', comedy: '#a855f7',
  theatre: '#ef4444', conference: '#06b6d4', other: '#64748b',
}

export default function Dashboard({ username, onNavigate, onBook }: Props) {
  const [allEvents, setAllEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEvents({ limit: 100, sort: 'starts_at', order: 'asc' })
      .then(r => setAllEvents(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()

  const stats: Stats = {
    total: allEvents.length,
    upcoming: allEvents.filter(e => e.status === 'published' && new Date(e.starts_at) > now).length,
    free: allEvents.filter(e => e.min_price === 0 && e.max_price === 0).length,
    cities: new Set(allEvents.map(e => e.venue.city)).size,
  }

  const upcomingEvents = allEvents
    .filter(e => e.status === 'published' && new Date(e.starts_at) > now)
    .slice(0, 6)

  const byCat = CATEGORIES.reduce<Record<string, number>>((acc, c) => {
    acc[c] = allEvents.filter(e => e.category === c).length
    return acc
  }, {})
  const maxCatCount = Math.max(...Object.values(byCat), 1)

  const timeOfDay = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const greeting = username ? `${timeOfDay}, ${username}` : 'Discover Events'

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-brand-900 via-violet-900 to-slate-900 p-8 border border-brand-700/30">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #7c3aed 0%, transparent 60%)' }} />
        <div className="relative">
          <p className="text-brand-300 text-sm font-medium mb-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          <h1 className="text-3xl font-bold text-white mb-2">{greeting} 👋</h1>
          <p className="text-slate-400 text-sm mb-6">
            {stats.upcoming} upcoming events across {stats.cities} cities waiting for you.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => onNavigate('events')}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-brand-600/30">
              Browse Events
            </button>
            <button onClick={() => onNavigate('map')}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium text-sm transition-all border border-white/20">
              🗺️ Explore Map
            </button>
            <button onClick={() => onNavigate('calendar')}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium text-sm transition-all border border-white/20">
              📅 Calendar
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: stats.total, icon: '🎭', color: 'text-brand-400' },
          { label: 'Upcoming', value: stats.upcoming, icon: '🔥', color: 'text-orange-400' },
          { label: 'Free Events', value: stats.free, icon: '🎁', color: 'text-green-400' },
          { label: 'Cities', value: stats.cities, icon: '🌍', color: 'text-cyan-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 flex items-center gap-4">
            <span className="text-3xl">{s.icon}</span>
            <div>
              <div className={`text-2xl font-bold ${s.color}`}>
                {loading ? '—' : s.value}
              </div>
              <div className="text-xs text-slate-400">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Categories */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Browse by Category</h2>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          {CATEGORIES.map(cat => {
            const count = byCat[cat] ?? 0
            const pct = Math.round((count / maxCatCount) * 100)
            const chip = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other
            return (
              <button
                key={cat}
                onClick={() => onNavigate('events', { category: cat })}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all hover:scale-105 active:scale-95 ${chip}`}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: CATEGORY_HEX[cat] + '33' }}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_HEX[cat] }} />
                </div>
                <span className="text-xs font-medium capitalize leading-none">{cat}</span>
                <div className="w-full h-1 rounded-full bg-current opacity-20">
                  <div className="h-full rounded-full bg-current opacity-80" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Upcoming events */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Upcoming Events</h2>
          <button onClick={() => onNavigate('events')}
            className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
            View all →
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-slate-800 rounded-xl h-64 animate-pulse border border-slate-700/50" />
            ))}
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-3">📭</div>
            <div>No upcoming events found</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingEvents.map(e => (
              <EventCard key={e.id} event={e} onBook={onBook} />
            ))}
          </div>
        )}
      </div>

      {/* Category gradient preview strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CATEGORIES.slice(0, 5).map(cat => {
          const events = allEvents.filter(e => e.category === cat && e.status === 'published').slice(0, 1)
          if (events.length === 0) return null
          const e = events[0]
          return (
            <button
              key={cat}
              onClick={() => onNavigate('events', { category: cat })}
              className={`relative rounded-xl h-20 bg-gradient-to-br ${CATEGORY_GRADIENTS[cat]} overflow-hidden flex items-end p-3 transition-all hover:scale-105 border border-white/5`}
            >
              <div>
                <div className="text-xs text-white/60 capitalize">{cat}</div>
                <div className="text-xs font-medium text-white truncate">{e.title}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
