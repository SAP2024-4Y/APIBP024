import { useState } from 'react'
import type { Event } from '../types'
import { bookTicket } from '../api/client'

export interface CartItem { event: Event; quantity: number }

interface Props {
  items: CartItem[]
  token: string
  username: string
  onClose: () => void
  onUpdateQty: (eventId: string, qty: number) => void
  onRemove: (eventId: string) => void
  onSuccess: () => void
  onNeedAuth: () => void
}

type Step = 'cart' | 'payment' | 'processing' | 'receipt'
type PayMethod = 'gpay' | 'phonepe' | 'paytm' | 'upi'

const PAY_OPTIONS: { id: PayMethod; label: string; sub: string; emoji: string }[] = [
  { id: 'gpay',    label: 'Google Pay',  sub: 'Pay via UPI', emoji: '🇬' },
  { id: 'phonepe', label: 'PhonePe',     sub: 'Pay via UPI', emoji: '📱' },
  { id: 'paytm',   label: 'Paytm',       sub: 'Pay via UPI', emoji: '💙' },
  { id: 'upi',     label: 'Other UPI',   sub: 'Enter UPI ID', emoji: '💳' },
]

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
}

export default function CartModal({ items, token, username, onClose, onUpdateQty, onRemove, onSuccess, onNeedAuth }: Props) {
  const [step, setStep] = useState<Step>('cart')
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null)
  const [upiId, setUpiId] = useState('')
  const [error, setError] = useState('')
  const [bookedItems, setBookedItems] = useState<CartItem[]>([])

  const total = items.reduce((s, i) => s + i.event.min_price * i.quantity, 0)
  const totalTickets = items.reduce((s, i) => s + i.quantity, 0)

  async function handlePay() {
    if (!token) { onNeedAuth(); return }
    if (!payMethod) { setError('Select a payment method'); return }
    if (payMethod === 'upi' && !upiId.trim()) { setError('Enter your UPI ID'); return }
    setError('')
    setStep('processing')
    await new Promise(r => setTimeout(r, 2400))
    const failed: string[] = []
    for (const item of items) {
      try {
        await bookTicket(item.event.id, item.quantity, token)
      } catch {
        failed.push(item.event.title)
      }
    }
    if (failed.length === items.length) {
      setError(`All bookings failed: ${failed.join(', ')}`)
      setStep('payment')
      return
    }
    setBookedItems(items)
    setStep('receipt')
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl shadow-black/40 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            {step === 'payment' && (
              <button onClick={() => setStep('cart')} className="text-slate-400 hover:text-white transition-colors text-sm">← Back</button>
            )}
            <h2 className="text-base font-semibold text-white">
              {step === 'cart' ? `Cart (${items.length} event${items.length !== 1 ? 's' : ''})` :
               step === 'payment' ? 'Payment' :
               step === 'processing' ? 'Processing…' : 'Booking Confirmed!'}
            </h2>
          </div>
          {step !== 'processing' && (
            <button onClick={step === 'receipt' ? onSuccess : onClose}
              className="text-slate-400 hover:text-white text-xl leading-none transition-colors">
              {step === 'receipt' ? '✓ Done' : '×'}
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1">
          {/* STEP: Cart */}
          {step === 'cart' && (
            <div className="p-6 space-y-3">
              {items.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <div className="text-5xl mb-3">🛒</div>
                  <div>Your cart is empty</div>
                  <button onClick={onClose} className="mt-3 text-brand-400 text-sm hover:text-brand-300 transition-colors">Browse events →</button>
                </div>
              ) : (
                <>
                  {items.map(item => (
                    <div key={item.event.id} className="bg-slate-700/50 rounded-xl p-4 flex gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-sm leading-snug truncate">{item.event.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          📍 {item.event.venue.name}, {item.event.venue.city}
                        </div>
                        <div className="text-xs text-slate-400">📅 {fmtDate(item.event.starts_at)}</div>
                        <div className="text-xs text-brand-400 font-medium mt-1">
                          {item.event.min_price === 0 ? 'Free' : `$${item.event.min_price} × ${item.quantity} = $${item.event.min_price * item.quantity}`}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <button onClick={() => onRemove(item.event.id)}
                          className="text-xs text-slate-500 hover:text-red-400 transition-colors">✕</button>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => onUpdateQty(item.event.id, Math.max(1, item.quantity - 1))}
                            className="w-6 h-6 rounded bg-slate-600 hover:bg-slate-500 text-white text-xs transition-colors">−</button>
                          <span className="text-white text-sm w-4 text-center">{item.quantity}</span>
                          <button onClick={() => onUpdateQty(item.event.id, Math.min(10, item.quantity + 1))}
                            className="w-6 h-6 rounded bg-slate-600 hover:bg-slate-500 text-white text-xs transition-colors">+</button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="border-t border-slate-700 pt-4 flex items-center justify-between">
                    <div className="text-slate-400 text-sm">{totalTickets} ticket{totalTickets !== 1 ? 's' : ''}</div>
                    <div className="text-white font-bold">{total === 0 ? 'Free' : `$${total}`}</div>
                  </div>

                  <button onClick={() => total === 0 ? handlePay() : setStep('payment')}
                    className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-all shadow-md">
                    {total === 0 ? 'Confirm (Free)' : `Checkout · $${total} →`}
                  </button>
                </>
              )}
            </div>
          )}

          {/* STEP: Payment */}
          {step === 'payment' && (
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-400 mb-2">
                Total: <span className="text-brand-400 font-semibold">${total}</span> for {totalTickets} ticket{totalTickets !== 1 ? 's' : ''}
              </p>

              {PAY_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => setPayMethod(opt.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left
                    bg-slate-700/50 hover:bg-slate-700 ${payMethod === opt.id ? 'border-brand-500 ring-1 ring-brand-500/30' : 'border-slate-600'}`}>
                  <span className="text-xl w-8 text-center">{opt.emoji}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{opt.label}</div>
                    <div className="text-xs text-slate-400">{opt.sub}</div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                    payMethod === opt.id ? 'border-brand-500 bg-brand-500' : 'border-slate-500'}`}>
                    {payMethod === opt.id && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </button>
              ))}

              {payMethod === 'upi' && (
                <input value={upiId} onChange={e => setUpiId(e.target.value)}
                  placeholder="yourname@upi"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500" />
              )}

              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">{error}</div>}

              <button onClick={handlePay} disabled={!payMethod}
                className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-semibold text-sm transition-all shadow-md">
                Pay ${total} now
              </button>
              <p className="text-center text-xs text-slate-500">🔒 Secured by UPI · 256-bit encryption</p>
            </div>
          )}

          {/* STEP: Processing */}
          {step === 'processing' && (
            <div className="text-center py-16 px-6">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-brand-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-500 animate-spin" />
                <div className="absolute inset-2 rounded-full bg-brand-500/10 flex items-center justify-center text-xl">💳</div>
              </div>
              <div className="text-white font-semibold mb-1">Processing payment…</div>
              <div className="text-sm text-slate-400 mb-4">Booking {totalTickets} ticket{totalTickets !== 1 ? 's' : ''} across {items.length} event{items.length !== 1 ? 's' : ''}</div>
              <div className="flex justify-center gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          )}

          {/* STEP: Receipt */}
          {step === 'receipt' && (
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="text-5xl mb-2">🎉</div>
                <div className="text-lg font-semibold text-white">All booked!</div>
                <div className="text-sm text-slate-400">A confirmation has been sent to your account</div>
              </div>

              {/* Email receipt */}
              <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden mb-4">
                <div className="bg-gradient-to-r from-brand-900 to-violet-900 px-5 py-4 flex items-center gap-3">
                  <span className="text-2xl">🎫</span>
                  <div>
                    <div className="text-white font-bold text-sm">TicketSphere</div>
                    <div className="text-xs text-slate-300">Booking Confirmation</div>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-1">
                  <p className="text-slate-300 text-sm">Hi {username},</p>
                  <p className="text-slate-400 text-xs mt-1 mb-3">Your payment was successful. Here are your bookings:</p>

                  {bookedItems.map(item => (
                    <div key={item.event.id} className="border-l-2 border-brand-500 pl-3 py-1 mb-2">
                      <div className="text-white text-sm font-medium">{item.event.title}</div>
                      <div className="text-xs text-slate-400">
                        {fmtDate(item.event.starts_at)} · {item.event.venue.name}, {item.event.venue.city}
                      </div>
                      <div className="text-xs text-brand-400">
                        {item.quantity} ticket{item.quantity !== 1 ? 's' : ''} · {item.event.min_price === 0 ? 'Free' : `$${item.event.min_price * item.quantity}`}
                      </div>
                    </div>
                  ))}

                  <div className="border-t border-slate-700 pt-3 mt-3 flex justify-between">
                    <span className="text-slate-400 text-xs">Total paid</span>
                    <span className="text-white font-bold text-sm">{total === 0 ? 'Free' : `$${total}`}</span>
                  </div>

                  <p className="text-xs text-slate-500 mt-3">Your tickets are available in My Tickets. Show the ticket ID at the venue entrance.</p>
                </div>
              </div>

              <button onClick={onSuccess}
                className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-all">
                Go to My Tickets →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
