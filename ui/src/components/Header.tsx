import type { View } from '../types'

interface Props {
  username: string
  view: View
  onChangeView: (v: View) => void
  onLogin: () => void
  onLogout: () => void
}

const NAV: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Home',      icon: '🏠' },
  { id: 'events',    label: 'Events',    icon: '🎭' },
  { id: 'map',       label: 'Map',       icon: '🗺️' },
  { id: 'calendar',  label: 'Calendar',  icon: '📅' },
  { id: 'tickets',   label: 'My Tickets', icon: '🎟️' },
]

export default function Header({ username, view, onChangeView, onLogin, onLogout }: Props) {
  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-700/50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
        {/* Logo — links to dashboard */}
        <button
          onClick={() => onChangeView('dashboard')}
          className="flex items-center gap-2 mr-2 flex-shrink-0 hover:opacity-80 transition-opacity"
        >
          <span className="text-2xl">🎫</span>
          <span className="font-bold text-lg tracking-tight hidden sm:inline">
            Ticket<span className="text-brand-500">Sphere</span>
          </span>
        </button>

        {/* Nav */}
        <nav className="flex gap-1 flex-1 overflow-x-auto scrollbar-none">
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => onChangeView(n.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap
                ${view === n.id
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              <span className="hidden sm:inline">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        {/* Auth */}
        {username ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Avatar — click to profile */}
            <button
              onClick={() => onChangeView('profile')}
              title="View profile"
              className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all hover:bg-slate-800
                ${view === 'profile' ? 'bg-slate-800 ring-2 ring-brand-500' : ''}`}
            >
              <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white">
                {username[0].toUpperCase()}
              </div>
              <span className="text-sm text-slate-300 hidden sm:inline">{username}</span>
            </button>
            <button
              onClick={onLogout}
              className="text-sm text-slate-500 hover:text-red-400 transition-colors px-1 py-1 hidden sm:block"
              title="Sign out"
            >
              ↩
            </button>
          </div>
        ) : (
          <button
            onClick={onLogin}
            className="flex-shrink-0 px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  )
}
