import { useState, useEffect, useCallback } from 'react'
import type { Event } from '../types'
import { getEvents } from '../api/client'
import EventCard from './EventCard'
import EventFilters, { DEFAULT_FILTERS, type Filters } from './EventFilters'

interface Props {
  onBook: (event: Event) => void
  onAddToCart?: (event: Event) => void
  cartEventIds?: Set<string>
  initialCategory?: string
  onCategoryConsumed?: () => void
}

export default function EventList({ onBook, onAddToCart, cartEventIds, initialCategory, onCategoryConsumed }: Props) {
  const [events, setEvents] = useState<Event[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    category: initialCategory ?? '',
  }))

  // Apply incoming category from dashboard navigation
  useEffect(() => {
    if (initialCategory) {
      setFilters(f => ({ ...f, category: initialCategory }))
      onCategoryConsumed?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCategory])

  const load = useCallback(async (f: Filters, after?: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await getEvents({
        status:    f.status    || undefined,
        category:  f.category  || undefined,
        min_price: f.min_price ? Number(f.min_price) : undefined,
        max_price: f.max_price ? Number(f.max_price) : undefined,
        sort:      f.sort,
        order:     f.order,
        limit:     12,
        after,
      })
      setEvents(prev => after ? [...prev, ...res.data] : res.data)
      setCursor(res.pagination.next_cursor)
      setHasMore(res.pagination.has_more)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setEvents([])
    setCursor(null)
    load(filters)
  }, [filters, load])

  return (
    <div>
      <EventFilters filters={filters} onChange={f => setFilters(f)} />

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {!loading && events.length === 0 && !error && (
        <div className="text-center py-24 text-slate-500">
          <div className="text-5xl mb-4">🎭</div>
          <div className="text-lg">No events found</div>
          <div className="text-sm mt-1">Try adjusting your filters</div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {events.map(e => (
          <EventCard key={e.id} event={e} onBook={onBook} onAddToCart={onAddToCart} inCart={cartEventIds?.has(e.id)} />
        ))}
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-slate-800 rounded-xl h-64 animate-pulse border border-slate-700/50" />
        ))}
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => load(filters, cursor ?? undefined)}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  )
}
