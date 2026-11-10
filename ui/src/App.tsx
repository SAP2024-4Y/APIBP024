import { useState, useEffect } from 'react'
import type { Event, View } from './types'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import EventList from './components/EventList'
import MapView from './components/MapView'
import CalendarView from './components/CalendarView'
import MyTickets from './components/MyTickets'
import ProfilePage from './components/ProfilePage'
import LoginModal from './components/LoginModal'
import BookingModal from './components/BookingModal'

const VIEWS: View[] = ['dashboard', 'events', 'map', 'calendar', 'tickets', 'profile']

function hashToView(): View {
  const h = window.location.hash.replace('#', '') as View
  return VIEWS.includes(h) ? h : 'dashboard'
}

export default function App() {
  const [view, setViewState] = useState<View>(hashToView)
  const [eventCategory, setEventCategory] = useState<string>('')

  function setView(v: View) {
    window.location.hash = v
    setViewState(v)
  }

  function navigateTo(v: View, opts?: { category?: string }) {
    if (opts?.category !== undefined) setEventCategory(opts.category)
    setView(v)
  }

  // Sync browser back/forward to view state
  useEffect(() => {
    function onHashChange() {
      const v = hashToView()
      setViewState(v)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Auth state — persist in sessionStorage
  const [token, setToken] = useState<string>(() => sessionStorage.getItem('token') ?? '')
  const [username, setUsername] = useState<string>(() => sessionStorage.getItem('username') ?? '')

  // Modal state
  const [showLogin, setShowLogin] = useState(false)
  const [bookingEvent, setBookingEvent] = useState<Event | null>(null)
  const [mapFocus, setMapFocus] = useState<{ lat: number; lon: number } | null>(null)

  useEffect(() => {
    if (token) sessionStorage.setItem('token', token)
    else sessionStorage.removeItem('token')
    if (username) sessionStorage.setItem('username', username)
    else sessionStorage.removeItem('username')
  }, [token, username])

  function handleLoginSuccess(t: string, u: string) {
    setToken(t)
    setUsername(u)
    setShowLogin(false)
  }

  function handleLogout() {
    setToken('')
    setUsername('')
    setView('dashboard')
  }

  function handleBook(event: Event) {
    if (!token) { setShowLogin(true); return }
    setBookingEvent(event)
  }

  function handleNeedAuth() {
    setBookingEvent(null)
    setShowLogin(true)
  }

  function handleViewOnMap(event: Event) {
    const [lon, lat] = event.venue.location.coordinates
    setMapFocus({ lat, lon })
    setBookingEvent(null)
    setView('map')
  }

  function handleBookingSuccess() {
    setBookingEvent(null)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Header
        view={view}
        onChangeView={setView}
        username={username}
        onLogin={() => setShowLogin(true)}
        onLogout={handleLogout}
      />

      <main className="max-w-screen-xl mx-auto px-4 py-6">
        {view === 'dashboard' && (
          <Dashboard username={username} onNavigate={navigateTo} onBook={handleBook} />
        )}

        {view === 'events' && (
          <EventList
            onBook={handleBook}
            initialCategory={eventCategory}
            onCategoryConsumed={() => setEventCategory('')}
          />
        )}

        {view === 'map' && (
          <MapView onBook={handleBook} focusCoords={mapFocus} onFocusConsumed={() => setMapFocus(null)} />
        )}

        {view === 'calendar' && (
          <CalendarView onBook={handleBook} />
        )}

        {view === 'tickets' && (
          token ? (
            <MyTickets token={token} onNeedAuth={handleNeedAuth} onBook={handleBook} />
          ) : (
            <div className="text-center py-24 text-slate-500">
              <div className="text-5xl mb-4">🔐</div>
              <div className="text-lg font-medium text-slate-400">Sign in to view your tickets</div>
              <button
                onClick={() => setShowLogin(true)}
                className="mt-4 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-medium text-sm transition-colors"
              >
                Sign in
              </button>
            </div>
          )
        )}

        {view === 'profile' && (
          token ? (
            <ProfilePage
              token={token}
              username={username}
              onNavigate={setView}
              onBook={handleBook}
              onLogout={handleLogout}
              onNeedAuth={handleNeedAuth}
            />
          ) : (
            <div className="text-center py-24 text-slate-500">
              <div className="text-5xl mb-4">🔐</div>
              <div className="text-lg font-medium text-slate-400">Sign in to view your profile</div>
              <button
                onClick={() => setShowLogin(true)}
                className="mt-4 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-medium text-sm transition-colors"
              >
                Sign in
              </button>
            </div>
          )
        )}
      </main>

      {/* Modals */}
      {showLogin && (
        <LoginModal
          onSuccess={handleLoginSuccess}
          onClose={() => setShowLogin(false)}
        />
      )}

      {bookingEvent && (
        <BookingModal
          event={bookingEvent}
          token={token}
          onSuccess={handleBookingSuccess}
          onClose={() => setBookingEvent(null)}
          onNeedAuth={handleNeedAuth}
          onViewOnMap={() => handleViewOnMap(bookingEvent)}
        />
      )}
    </div>
  )
}
