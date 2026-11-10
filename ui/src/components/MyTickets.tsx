import { useState, useEffect, useCallback } from 'react'
import type { Event, Ticket } from '../types'
import { getMyTickets, cancelTicket, getEvent } from '../api/client'

interface Props {
  token: string
  onNeedAuth: () => void
  onBook: (event: Event) => void
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_CHIP: Record<string, string> = {
  confirmed: 'bg-green-500/20 text-green-300 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
  used:      'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

export default function MyTickets({ token, onNeedAuth, onBook }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [pendingEventId, setPendingEventId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getMyTickets(token)
      setTickets(res.data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load tickets'
      if (msg.includes('401') || msg.includes('AUTH')) onNeedAuth()
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }, [token, onNeedAuth])

  useEffect(() => { load() }, [load])

  async function handleCancel(ticketId: string) {
    setCancelling(ticketId)
    try {
      await cancelTicket(ticketId, token)
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel'
      setError(msg)
    } finally {
      setCancelling(null)
    }
  }

  async function handleViewEvent(ticket: Ticket) {
    if (pendingEventId) return
    setPendingEventId(ticket.id)
    try {
      const res = await getEvent(ticket.event_id)
      onBook(res.data)
    } catch {
      // silently fail
    } finally {
      setPendingEventId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-slate-800 rounded-xl h-28 animate-pulse border border-slate-700/50" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">My Tickets</h2>
        <button onClick={load}
          className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {!loading && tickets.length === 0 && !error && (
        <div className="text-center py-24 text-slate-500">
          <div className="text-5xl mb-4">🎟️</div>
          <div className="text-lg">No tickets yet</div>
          <div className="text-sm mt-1">Book an event to see your tickets here</div>
        </div>
      )}

      <div className="space-y-3">
        {tickets.map(ticket => (
          <div key={ticket.id}
            className="bg-slate-800 border border-slate-700/50 rounded-xl p-4 flex gap-4 items-start hover:border-slate-600 transition-all">

            {/* Ticket tear line decoration */}
            <div className="hidden sm:flex flex-col items-center pt-1">
              <div className="w-10 h-10 rounded-full bg-brand-600/20 flex items-center justify-center text-xl">
                🎟️
              </div>
              <div className="w-px flex-1 border-l border-dashed border-slate-600 mt-2" />
            </div>

            <div className="flex-1 min-w-0">
              <button
                onClick={() => handleViewEvent(ticket)}
                disabled={pendingEventId !== null}
                className="w-full text-left group disabled:opacity-60"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-white leading-tight group-hover:text-brand-400 transition-colors">
                      {ticket.event_title}
                      {pendingEventId === ticket.id
                        ? <span className="ml-2 text-xs text-slate-500 font-normal">loading…</span>
                        : <span className="ml-1.5 text-slate-500 text-xs group-hover:text-brand-400 transition-colors">↗</span>}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {ticket.venue_name ?? '—'}{ticket.venue_city ? ` · ${ticket.venue_city}` : ''}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_CHIP[ticket.status] ?? STATUS_CHIP.confirmed}`}>
                    {ticket.status}
                  </span>
                </div>
              </button>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                {ticket.event_starts_at && <span>📅 {fmtDate(ticket.event_starts_at)}</span>}
                {ticket.seat_number && <span>💺 {ticket.seat_number}</span>}
                <span className="text-brand-400 font-medium">
                  {ticket.price === 0 ? 'Free' : `$${ticket.price}`}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-500 font-mono bg-slate-700 px-2 py-0.5 rounded">
                  #{ticket.id.slice(0, 8)}
                </span>
                {ticket.status === 'confirmed' && (
                  <button
                    onClick={() => handleCancel(ticket.id)}
                    disabled={cancelling === ticket.id}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50 ml-auto"
                  >
                    {cancelling === ticket.id ? 'Cancelling…' : 'Cancel ticket'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
