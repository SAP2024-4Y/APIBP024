import { useState } from 'react'
import type { Event } from '../types'
import { bookTicket } from '../api/client'
import { CATEGORY_GRADIENTS } from '../types'

interface Props {
  event: Event
  token: string
  onSuccess: () => void
  onClose: () => void
  onNeedAuth: () => void
  onViewOnMap: () => void
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtPrice(min: number, max: number, qty: number) {
  if (min === 0 && max === 0) return 'Free'
  const total = min * qty
  return `$${min} × ${qty} = $${total}`
}

export default function BookingModal({ event, token, onSuccess, onClose, onNeedAuth, onViewOnMap }: Props) {
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const maxQty = Math.min(event.available_seats, 10)
  const gradient = CATEGORY_GRADIENTS[event.category] ?? CATEGORY_GRADIENTS.other

  async function confirm() {
    if (!token) { onNeedAuth(); return }
    setLoading(true)
    setError('')
    try {
      await bookTicket(event.id, quantity, token)
      setDone(true)
      setTimeout(onSuccess, 1500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Booking failed'
      if (msg.includes('401') || msg.includes('AUTH')) onNeedAuth()
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl shadow-black/40 overflow-hidden">
        {/* Gradient banner */}
        <div className={`h-24 bg-gradient-to-br ${gradient} relative flex items-end p-4`}>
          <span className="text-xs bg-black/30 text-white px-2 py-0.5 rounded-full">
            {event.category}
          </span>
          <button onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center bg-black/30 hover:bg-black/50 text-white rounded-full transition-colors text-sm">
            ✕
          </button>
        </div>

        <div className="p-6">
          {done ? (
            <div className="text-center py-6">
              <div className="text-5xl mb-3">🎉</div>
              <div className="text-lg font-semibold text-white mb-1">Booked!</div>
              <div className="text-sm text-slate-400">Check My Tickets for your booking</div>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-white leading-snug mb-1">
                {event.title}
              </h2>
              <div className="flex items-start justify-between gap-2 mb-4">
                <p className="text-sm text-slate-400">
                  📍 {event.venue.name} · {event.venue.city}<br />
                  📅 {fmtDate(event.starts_at)}
                </p>
                <button
                  onClick={onViewOnMap}
                  title="View venue on map"
                  className="flex-shrink-0 flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 px-2.5 py-1.5 rounded-lg transition-all"
                >
                  🗺️ Map
                </button>
              </div>

              <div className="bg-slate-700/50 rounded-xl p-4 mb-4 space-y-3">
                <label className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Quantity</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="w-7 h-7 rounded-lg bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white transition-colors"
                    >−</button>
                    <span className="w-8 text-center font-medium text-white">{quantity}</span>
                    <button
                      onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                      disabled={quantity >= maxQty}
                      className="w-7 h-7 rounded-lg bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white transition-colors"
                    >+</button>
                  </div>
                </label>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Total</span>
                  <span className="font-semibold text-brand-400">
                    {fmtPrice(event.min_price, event.max_price, quantity)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Available</span>
                  <span className="text-slate-300">{event.available_seats} seats</span>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 mb-4">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 transition-all text-sm font-medium">
                  Cancel
                </button>
                <button
                  onClick={confirm}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-all disabled:opacity-50 shadow-md hover:shadow-brand-600/40"
                >
                  {loading ? 'Booking…' : `Confirm · ${quantity} ticket${quantity !== 1 ? 's' : ''}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
