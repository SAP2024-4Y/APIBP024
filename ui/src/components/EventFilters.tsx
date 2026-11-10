import { useState } from 'react'
import { CATEGORIES } from '../types'

export interface Filters {
  status: string
  category: string
  min_price: string
  max_price: string
  sort: string
  order: 'asc' | 'desc'
}

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
}

export const DEFAULT_FILTERS: Filters = {
  status: '', category: '', min_price: '', max_price: '',
  sort: 'starts_at', order: 'asc',
}

export default function EventFilters({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const set = (key: keyof Filters, value: string) =>
    onChange({ ...filters, [key]: value })

  const activeCount = [filters.status, filters.category, filters.min_price, filters.max_price]
    .filter(Boolean).length

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 mb-6">
      {/* Top row — always visible */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Category */}
        <select
          value={filters.category}
          onChange={e => set('category', e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
        >
          <option value="">All categories</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={filters.status}
          onChange={e => set('status', e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
          <option value="draft">Draft</option>
        </select>

        {/* Sort */}
        <div className="flex gap-1">
          <select
            value={filters.sort}
            onChange={e => set('sort', e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded-l-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
          >
            <option value="starts_at">Date</option>
            <option value="min_price">Price</option>
            <option value="title">Title</option>
            <option value="available_seats">Seats</option>
            <option value="created_at">Added</option>
          </select>
          <button
            onClick={() => set('order', filters.order === 'asc' ? 'desc' : 'asc')}
            title={filters.order === 'asc' ? 'Ascending' : 'Descending'}
            className="bg-slate-700 border border-slate-600 rounded-r-lg px-3 py-1.5 text-sm hover:bg-slate-600 transition-colors"
          >
            {filters.order === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {/* Toggle price */}
        <button
          onClick={() => setOpen(o => !o)}
          className={`ml-auto text-sm px-3 py-1.5 rounded-lg border transition-all
            ${open || activeCount > 0
              ? 'border-brand-500 text-brand-400 bg-brand-500/10'
              : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}
        >
          Price filter {activeCount > 0 && <span className="ml-1 bg-brand-600 text-white text-xs px-1.5 py-0.5 rounded-full">{activeCount}</span>}
        </button>

        {activeCount > 0 && (
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Price row — toggle */}
      {open && (
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-700/50">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            Min $
            <input
              type="number"
              min="0"
              placeholder="0"
              value={filters.min_price}
              onChange={e => set('min_price', e.target.value)}
              className="w-24 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            Max $
            <input
              type="number"
              min="0"
              placeholder="1000"
              value={filters.max_price}
              onChange={e => set('max_price', e.target.value)}
              className="w-24 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-brand-500"
            />
          </label>
        </div>
      )}
    </div>
  )
}
