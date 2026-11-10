import { useEffect, useState } from 'react'
import type { Event, Ticket, View } from '../types'
import { getMyTickets, getEvent } from '../api/client'

interface Props {
  token: string
  username: string
  onNavigate: (v: View) => void
  onBook: (event: Event) => void
  onLogout: () => void
  onNeedAuth: () => void
}

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch { return null }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ProfilePage({ token, username, onNavigate, onBook, onLogout, onNeedAuth }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(false)
  const [pendingEventId, setPendingEventId] = useState<string | null>(null)

  const jwt = decodeJwt(token)
  const role = (jwt?.role as string) ?? 'user'
  const issuedAt = jwt?.iat ? new Date((jwt.iat as number) * 1000) : null

  useEffect(() => {
    if (!token) return
    setLoading(true)
    getMyTickets(token)
      .then(r => setTickets(r.data))
      .catch(err => {
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('401') || msg.includes('AUTH')) onNeedAuth()
      })
      .finally(() => setLoading(false))
  }, [token, onNeedAuth])

  const confirmed = tickets.filter(t => t.status === 'confirmed')
  const cancelled = tickets.filter(t => t.status === 'cancelled')
  const totalSpent = tickets.filter(t => t.status === 'confirmed').reduce((s, t) => s + t.price, 0)
  const recentTickets = tickets.slice(0, 5)

  async function handleTicketClick(ticket: Ticket) {
    if (pendingEventId) return
    setPendingEventId(ticket.id)
    try {
      const res = await getEvent(ticket.event_id)
      onBook(res.data)
    } catch {
      // silently fail — event may be deleted
    } finally {
      setPendingEventId(null)
    }
  }

  const ROLE_BADGE: Record<string, string> = {
    admin:    'bg-red-500/20 text-red-300 border-red-500/30',
    organizer:'bg-orange-500/20 text-orange-300 border-orange-500/30',
    user:     'bg-brand-500/20 text-brand-300 border-brand-500/30',
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile card */}
      <div className="bg-slate-800 border border-slate-700/50 rounded-2xl overflow-hidden">
        {/* Banner */}
        <div className="h-28 bg-gradient-to-br from-brand-900 via-violet-900 to-slate-900" />
        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="flex items-end justify-between -mt-10 mb-4">
            <div className="w-20 h-20 rounded-2xl bg-brand-600 border-4 border-slate-800 flex items-center justify-center text-3xl font-bold text-white shadow-xl">
              {username ? username[0].toUpperCase() : '?'}
            </div>
            <button
              onClick={onLogout}
              className="mb-1 px-4 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-all"
            >
              Sign out
            </button>
          </div>

          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-white">{username}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_BADGE[role] ?? ROLE_BADGE.user}`}>
              {role}
            </span>
          </div>
          {issuedAt && (
            <p className="text-sm text-slate-400">Session started {fmtDate(issuedAt.toISOString())}</p>
          )}
        </div>
      </div>

      {/* Booking stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Tickets', value: confirmed.length, icon: '🎟️', color: 'text-green-400' },
          { label: 'Cancelled', value: cancelled.length, icon: '✕', color: 'text-red-400' },
          { label: 'Total Spent', value: totalSpent === 0 ? 'Free' : `$${totalSpent}`, icon: '💳', color: 'text-brand-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800 border border-slate-700/50 rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-xl font-bold ${s.color}`}>
              {loading ? '—' : s.value}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate('tickets')}
          className="flex items-center gap-3 bg-slate-800 border border-slate-700/50 hover:border-brand-500/40 rounded-xl p-4 transition-all text-left group"
        >
          <span className="text-2xl">🎟️</span>
          <div>
            <div className="font-medium text-white group-hover:text-brand-400 transition-colors">My Tickets</div>
            <div className="text-xs text-slate-500">{confirmed.length} active</div>
          </div>
        </button>
        <button
          onClick={() => onNavigate('events')}
          className="flex items-center gap-3 bg-slate-800 border border-slate-700/50 hover:border-brand-500/40 rounded-xl p-4 transition-all text-left group"
        >
          <span className="text-2xl">🎭</span>
          <div>
            <div className="font-medium text-white group-hover:text-brand-400 transition-colors">Browse Events</div>
            <div className="text-xs text-slate-500">Find something new</div>
          </div>
        </button>
      </div>

      {/* Recent ticket history */}
      <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Recent Bookings</h2>
          {tickets.length > 5 && (
            <button onClick={() => onNavigate('tickets')}
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
              View all →
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-700 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : recentTickets.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <div className="text-3xl mb-2">🎟️</div>
            <div className="text-sm">No bookings yet</div>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTickets.map(t => (
              <button key={t.id}
                onClick={() => handleTicketClick(t)}
                disabled={pendingEventId !== null}
                className="w-full flex items-center gap-3 py-2.5 border-b border-slate-700/50 last:border-0 text-left hover:bg-slate-700/30 -mx-1 px-1 rounded-lg transition-colors cursor-pointer disabled:opacity-60">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  t.status === 'confirmed' ? 'bg-green-400' :
                  t.status === 'cancelled' ? 'bg-red-400' : 'bg-slate-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{t.event_title ?? 'Event'}</div>
                  <div className="text-xs text-slate-500">
                    {t.seat_number} · {t.event_starts_at ? fmtDate(t.event_starts_at) : '—'}
                  </div>
                </div>
                <div className="text-sm font-medium text-brand-400 flex-shrink-0">
                  {pendingEventId === t.id
                    ? <span className="text-slate-500 text-xs">loading…</span>
                    : t.price === 0 ? 'Free' : `$${t.price}`}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
