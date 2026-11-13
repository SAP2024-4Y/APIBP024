import { useState } from 'react'
import type { Event, Ticket } from '../types'
import { cancelTicket } from '../api/client'
import { CATEGORY_GRADIENTS } from '../types'

interface Props {
  ticket: Ticket
  event: Event | null
  token: string
  onClose: () => void
  onCancelled: (id: string) => void
  onAddMore: (event: Event) => void
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function TicketDetailModal({ ticket, event, token, onClose, onCancelled, onAddMore }: Props) {
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [error, setError] = useState('')

  const gradient = event ? (CATEGORY_GRADIENTS[event.category] ?? CATEGORY_GRADIENTS.other) : 'from-slate-800 to-slate-900'

  async function handleCancel() {
    setCancelling(true)
    setError('')
    try {
      await cancelTicket(ticket.id, token)
      setCancelled(true)
      setTimeout(() => { onCancelled(ticket.id) }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancellation failed')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl shadow-black/40 overflow-hidden">
        {/* Gradient banner */}
        <div className={`h-24 bg-gradient-to-br ${gradient} relative flex items-end p-4`}>
          {event && (
            <span className="text-xs bg-black/30 text-white px-2 py-0.5 rounded-full capitalize">
              {event.category}
            </span>
          )}
          <button onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center bg-black/30 hover:bg-black/50 text-white rounded-full transition-colors text-sm">
            ✕
          </button>
        </div>

        <div className="p-6">
          {cancelled ? (
            <div className="text-center py-6">
              <div className="text-5xl mb-3">✓</div>
              <div className="text-lg font-semibold text-white mb-1">Booking Cancelled</div>
              <div className="text-sm text-slate-400">Your refund will be processed in 3–5 business days</div>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-white leading-snug mb-1">
                {ticket.event_title ?? event?.title ?? 'Event'}
              </h2>
              <p className="text-sm text-slate-400 mb-5">
                📍 {ticket.venue_name ?? event?.venue.name ?? '—'}{ticket.venue_city ? `, ${ticket.venue_city}` : ''}<br />
                {ticket.event_starts_at && <span>📅 {fmtDate(ticket.event_starts_at)}</span>}
              </p>

              {/* Ticket details */}
              <div className="bg-slate-700/50 rounded-xl p-4 mb-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Ticket ID</span>
                  <span className="text-slate-300 font-mono text-xs">{ticket.id.slice(0, 8)}…</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Seat</span>
                  <span className="text-slate-300">{ticket.seat_number ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Amount paid</span>
                  <span className="font-semibold text-brand-400">{ticket.price === 0 ? 'Free' : `$${ticket.price}`}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Booked on</span>
                  <span className="text-slate-300 text-xs">{fmtDate(ticket.booked_at)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Status</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 font-medium">
                    {ticket.status}
                  </span>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 mb-4">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 py-2.5 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-all text-sm font-medium"
                >
                  {cancelling ? 'Cancelling…' : 'Cancel booking'}
                </button>
                {event && event.available_seats > 0 && (
                  <button
                    onClick={() => onAddMore(event)}
                    className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-all shadow-md"
                  >
                    + Add tickets
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
