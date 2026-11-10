import type { Event } from '../types'
import { CATEGORY_COLORS, CATEGORY_GRADIENTS } from '../types'

interface Props {
  event: Event
  onBook: (event: Event) => void
  distanceKm?: number
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtPrice(min: number, max: number) {
  if (min === 0 && max === 0) return 'Free'
  if (min === max) return `$${min}`
  return `$${min} – $${max}`
}

const STATUS_STYLES: Record<string, string> = {
  published: 'bg-green-500/20 text-green-300',
  cancelled:  'bg-red-500/20 text-red-300',
  completed:  'bg-slate-500/20 text-slate-300',
  draft:      'bg-yellow-500/20 text-yellow-300',
}

export default function EventCard({ event, onBook, distanceKm }: Props) {
  const isSoldOut = event.available_seats === 0
  const isCancelled = event.status === 'cancelled' || event.status === 'completed'
  const gradient = CATEGORY_GRADIENTS[event.category] ?? CATEGORY_GRADIENTS.other
  const catStyle = CATEGORY_COLORS[event.category] ?? CATEGORY_COLORS.other

  return (
    <div className="group bg-slate-800 rounded-xl overflow-hidden border border-slate-700/50 hover:border-brand-500/40 transition-all hover:shadow-xl hover:shadow-brand-600/10 flex flex-col">
      {/* Gradient header */}
      <div className={`h-28 bg-gradient-to-br ${gradient} relative flex items-end p-3`}>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${catStyle}`}>
          {event.category}
        </span>
        {event.status !== 'published' && (
          <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[event.status]}`}>
            {event.status}
          </span>
        )}
        {distanceKm !== undefined && (
          <span className="ml-auto text-xs text-white/70 bg-black/30 px-2 py-0.5 rounded-full">
            📍 {distanceKm.toFixed(1)} km
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-white line-clamp-2 leading-snug mb-1 group-hover:text-brand-400 transition-colors">
          {event.title}
        </h3>

        <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
          <span>📍</span>
          <span className="truncate">{event.venue.name}, {event.venue.city}</span>
        </div>

        <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
          <span>📅</span>
          <span>{fmt(event.starts_at)} · {fmtTime(event.starts_at)}</span>
        </div>

        <div className="mt-auto pt-3 flex items-center justify-between">
          <div>
            <div className="text-brand-400 font-bold">{fmtPrice(event.min_price, event.max_price)}</div>
            <div className="text-xs text-slate-500">
              {isSoldOut ? (
                <span className="text-red-400">Sold out</span>
              ) : (
                <span>{event.available_seats.toLocaleString()} seats left</span>
              )}
            </div>
          </div>

          <button
            onClick={() => onBook(event)}
            disabled={isSoldOut || isCancelled}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${isSoldOut || isCancelled
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-brand-600 hover:bg-brand-500 text-white shadow-md hover:shadow-brand-600/40'
              }`}
          >
            {isCancelled ? 'Cancelled' : isSoldOut ? 'Sold out' : 'Book'}
          </button>
        </div>
      </div>
    </div>
  )
}
