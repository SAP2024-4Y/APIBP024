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

type Step = 'review' | 'payment' | 'processing' | 'done'
type PayMethod = 'gpay' | 'phonepe' | 'paytm' | 'upi'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const PAY_OPTIONS: { id: PayMethod; label: string; icon: string; color: string }[] = [
  { id: 'gpay',    label: 'Google Pay',  icon: '🟣', color: 'border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20' },
  { id: 'phonepe', label: 'PhonePe',     icon: '🟣', color: 'border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20' },
  { id: 'paytm',   label: 'Paytm',       icon: '🔵', color: 'border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20' },
  { id: 'upi',     label: 'Other UPI',   icon: '💳', color: 'border-slate-500/40 bg-slate-700/50 hover:bg-slate-700' },
]

export default function BookingModal({ event, token, onSuccess, onClose, onNeedAuth, onViewOnMap }: Props) {
  const [step, setStep] = useState<Step>('review')
  const [quantity, setQuantity] = useState(1)
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null)
  const [upiId, setUpiId] = useState('')
  const [error, setError] = useState('')

  const maxQty = Math.min(event.available_seats, 10)
  const total = event.min_price * quantity
  const gradient = CATEGORY_GRADIENTS[event.category] ?? CATEGORY_GRADIENTS.other

  async function handlePay() {
    if (!token) { onNeedAuth(); return }
    if (!payMethod) { setError('Select a payment method'); return }
    if (payMethod === 'upi' && !upiId.trim()) { setError('Enter your UPI ID'); return }
    setError('')
    setStep('processing')
    // Simulate payment processing, then confirm booking
    await new Promise(r => setTimeout(r, 2200))
    try {
      await bookTicket(event.id, quantity, token)
      setStep('done')
      setTimeout(onSuccess, 2000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Booking failed'
      if (msg.includes('401') || msg.includes('AUTH')) { onNeedAuth(); return }
      setError(msg)
      setStep('payment')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl shadow-black/40 overflow-hidden">
        {/* Gradient banner */}
        <div className={`h-24 bg-gradient-to-br ${gradient} relative flex items-end p-4`}>
          <span className="text-xs bg-black/30 text-white px-2 py-0.5 rounded-full capitalize">
            {event.category}
          </span>
          {step === 'review' && (
            <button onClick={onClose}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center bg-black/30 hover:bg-black/50 text-white rounded-full transition-colors text-sm">
              ✕
            </button>
          )}
          {step === 'payment' && (
            <button onClick={() => setStep('review')}
              className="absolute top-3 right-3 flex items-center gap-1 text-xs bg-black/30 hover:bg-black/50 text-white px-2.5 py-1 rounded-full transition-colors">
              ← Back
            </button>
          )}
          {/* Step indicator */}
          <div className="absolute top-3 left-4 flex gap-1.5">
            {(['review','payment','processing','done'] as Step[]).map((s, i) => (
              <div key={s} className={`h-1 rounded-full transition-all ${
                step === s ? 'w-6 bg-white' :
                ['review','payment','processing','done'].indexOf(step) > i ? 'w-3 bg-white/60' : 'w-3 bg-white/20'
              }`} />
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* STEP 1: Review */}
          {step === 'review' && (
            <>
              <h2 className="text-base font-semibold text-white leading-snug mb-1">{event.title}</h2>
              <div className="flex items-start justify-between gap-2 mb-4">
                <p className="text-sm text-slate-400">
                  📍 {event.venue.name} · {event.venue.city}<br />
                  📅 {fmtDate(event.starts_at)}
                </p>
                <button onClick={onViewOnMap}
                  className="flex-shrink-0 flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 px-2.5 py-1.5 rounded-lg transition-all">
                  🗺️ Map
                </button>
              </div>

              <div className="bg-slate-700/50 rounded-xl p-4 mb-4 space-y-3">
                <label className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Quantity</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}
                      className="w-7 h-7 rounded-lg bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white transition-colors">−</button>
                    <span className="w-8 text-center font-medium text-white">{quantity}</span>
                    <button onClick={() => setQuantity(q => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty}
                      className="w-7 h-7 rounded-lg bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white transition-colors">+</button>
                  </div>
                </label>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Total</span>
                  <span className="font-semibold text-brand-400">
                    {total === 0 ? 'Free' : `$${event.min_price} × ${quantity} = $${total}`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Available</span>
                  <span className="text-slate-300">{event.available_seats} seats</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 transition-all text-sm font-medium">
                  Cancel
                </button>
                <button
                  onClick={() => total === 0 ? handlePay() : setStep('payment')}
                  disabled={event.available_seats === 0}
                  className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium text-sm transition-all shadow-md">
                  {event.available_seats === 0 ? 'Sold out' : total === 0 ? 'Confirm (Free)' : `Pay $${total} →`}
                </button>
              </div>
            </>
          )}

          {/* STEP 2: Payment */}
          {step === 'payment' && (
            <>
              <h2 className="text-base font-semibold text-white mb-1">Choose payment method</h2>
              <p className="text-sm text-slate-400 mb-4">Amount due: <span className="text-brand-400 font-semibold">${total}</span></p>

              <div className="space-y-2 mb-4">
                {PAY_OPTIONS.map(opt => (
                  <button key={opt.id} onClick={() => setPayMethod(opt.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${opt.color}
                      ${payMethod === opt.id ? 'ring-2 ring-brand-500' : ''}`}>
                    <span className="text-xl">
                      {opt.id === 'gpay'    ? '🇬' :
                       opt.id === 'phonepe' ? '📱' :
                       opt.id === 'paytm'   ? '💙' : '💳'}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{opt.label}</div>
                      <div className="text-xs text-slate-400">Pay via UPI</div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                      payMethod === opt.id ? 'border-brand-500 bg-brand-500' : 'border-slate-500'
                    }`}>
                      {payMethod === opt.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                ))}
              </div>

              {payMethod === 'upi' && (
                <input
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  placeholder="yourname@upi"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 mb-4"
                />
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 mb-4">{error}</div>
              )}

              <button onClick={handlePay} disabled={!payMethod}
                className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-semibold text-sm transition-all shadow-md">
                Pay ${total} now
              </button>

              <p className="text-center text-xs text-slate-500 mt-3">🔒 Secured by UPI · 256-bit encryption</p>
            </>
          )}

          {/* STEP 3: Processing */}
          {step === 'processing' && (
            <div className="text-center py-8">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-brand-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-500 animate-spin" />
                <div className="absolute inset-2 rounded-full bg-brand-500/10 flex items-center justify-center text-xl">💳</div>
              </div>
              <div className="text-white font-semibold mb-1">Processing payment…</div>
              <div className="text-sm text-slate-400">Talking to your UPI app</div>
              <div className="flex justify-center gap-1 mt-4">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Done */}
          {step === 'done' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-3 animate-bounce">🎉</div>
              <div className="text-lg font-semibold text-white mb-1">Payment successful!</div>
              <div className="text-sm text-slate-400 mb-3">Your tickets are confirmed</div>
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-2 inline-block">
                <span className="text-green-400 text-sm font-medium">✓ {quantity} ticket{quantity > 1 ? 's' : ''} booked · ${total} paid</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
