import { useState, useEffect } from 'react'
import type { Event } from '../types'
import { getSchedule } from '../api/client'
import { CATEGORY_COLORS } from '../types'
import EventCard from './EventCard'

interface Props {
  onBook: (event: Event) => void
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

export default function CalendarView({ onBook }: Props) {
  const today = new Date()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => {
    const start = new Date(month)
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59)
    setLoading(true)
    getSchedule(start.toISOString(), end.toISOString())
      .then(r => setEvents(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [month])

  // Group events by date they START on
  const byDate: Record<string, Event[]> = {}
  for (const e of events) {
    const d = isoDate(new Date(e.starts_at))
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(e)
  }

  const startDay = startOfMonth(month)
  const totalDays = daysInMonth(month)
  const startWeekday = startDay.getDay() // 0=Sun

  const prevMonth = () => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  const nextMonth = () => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))

  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const selectedEvents = selectedDay ? (byDate[selectedDay] ?? []) : []

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Calendar grid */}
      <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700/50 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
            ‹
          </button>
          <h2 className="font-semibold text-white">{monthLabel}</h2>
          <button onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
            ›
          </button>
        </div>

        {loading && (
          <div className="text-center py-8 text-slate-500 text-sm">Loading events…</div>
        )}

        {/* Day names */}
        <div className="grid grid-cols-7 mb-1">
          {dayNames.map(d => (
            <div key={d} className="text-center text-xs text-slate-500 py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startWeekday }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: totalDays }).map((_, i) => {
            const day = i + 1
            const dateStr = isoDate(new Date(month.getFullYear(), month.getMonth(), day))
            const dayEvents = byDate[dateStr] ?? []
            const isToday = dateStr === isoDate(today)
            const isSelected = dateStr === selectedDay

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                className={`relative min-h-[48px] p-1 rounded-lg text-sm transition-all flex flex-col
                  ${isSelected
                    ? 'bg-brand-600 text-white ring-2 ring-brand-400'
                    : isToday
                      ? 'bg-brand-600/20 text-brand-400 hover:bg-brand-600/30'
                      : dayEvents.length > 0
                        ? 'bg-slate-700/60 hover:bg-slate-700 text-white'
                        : 'text-slate-500 hover:bg-slate-700/40'
                  }`}
              >
                <span className={`text-xs font-medium ${isToday && !isSelected ? 'text-brand-400' : ''}`}>
                  {day}
                </span>
                {/* Dot indicators */}
                <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                  {dayEvents.slice(0, 4).map(e => (
                    <div
                      key={e.id}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? 'white' : (CATEGORY_COLORS[e.category]?.match(/text-(\w+-\d+)/)?.[0] ? '#8b5cf6' : '#8b5cf6') }}
                    />
                  ))}
                  {dayEvents.length > 4 && (
                    <span className="text-[8px] text-slate-400">+{dayEvents.length - 4}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-brand-500" /> Has events
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-brand-600/50" /> Today
          </span>
          <span className="text-slate-600">{events.length} events this month</span>
        </div>
      </div>

      {/* Event panel */}
      <div className="flex flex-col gap-3">
        {selectedDay ? (
          <>
            <h3 className="font-medium text-slate-300">
              {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            {selectedEvents.length === 0 ? (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50 text-center text-slate-500 text-sm">
                No events on this day
              </div>
            ) : (
              selectedEvents.map(e => (
                <EventCard key={e.id} event={e} onBook={onBook} />
              ))
            )}
          </>
        ) : (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50 text-center text-slate-500">
            <div className="text-3xl mb-2">📅</div>
            <div className="text-sm">Click a day to see events</div>
          </div>
        )}
      </div>
    </div>
  )
}
