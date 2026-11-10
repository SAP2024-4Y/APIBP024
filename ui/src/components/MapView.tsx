import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import type { Event } from '../types'
import { getNearbyEvents, getBboxEvents } from '../api/client'
import { CATEGORY_GRADIENTS } from '../types'
import EventCard from './EventCard'

// Fix Leaflet default icon paths in bundled apps
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface Props {
  onBook: (event: Event) => void
  focusCoords?: { lat: number; lon: number } | null
  onFocusConsumed?: () => void
}

const CATEGORY_HEX: Record<string, string> = {
  music: '#ec4899', sports: '#22c55e', tech: '#3b82f6',
  food: '#f97316', art: '#eab308', comedy: '#a855f7',
  theatre: '#ef4444', conference: '#06b6d4', other: '#64748b',
}

function makeIcon(category: string) {
  const color = CATEGORY_HEX[category] ?? '#8b5cf6'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.63 14 22 14 22S28 23.63 28 14C28 6.27 21.73 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
  </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -38],
  })
}

export default function MapView({ onBook, focusCoords, onFocusConsumed }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())

  const [mode, setMode] = useState<'radius' | 'bbox'>('radius')
  const [lat, setLat] = useState('40.75')
  const [lon, setLon] = useState('-73.99')
  const [radius, setRadius] = useState('5000')
  const [events, setEvents] = useState<(Event & { distance_km?: number })[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Event | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    const map = L.map(mapRef.current, { center: [20, 0], zoom: 2 })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)
    mapInstance.current = map

    // Click to set centre
    map.on('click', (e) => {
      setLat(e.latlng.lat.toFixed(5))
      setLon(e.latlng.lng.toFixed(5))
    })

    return () => { map.remove(); mapInstance.current = null }
  }, [])

  // Fly to venue when arriving from the booking modal
  useEffect(() => {
    if (!focusCoords) return
    const map = mapInstance.current
    setMode('radius')
    setLat(focusCoords.lat.toFixed(5))
    setLon(focusCoords.lon.toFixed(5))
    setRadius('5000')
    if (map) {
      map.flyTo([focusCoords.lat, focusCoords.lon], 14, { duration: 1.2 })
    }
    onFocusConsumed?.()
    // Auto-search nearby events at the new location
    const km = 5
    setLoading(true)
    setError('')
    setSelected(null)
    getNearbyEvents(focusCoords.lat, focusCoords.lon, km)
      .then(res => { setEvents(res.data); placeMarkers(res.data) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCoords])

  function placeMarkers(evts: (Event & { distance_km?: number })[]) {
    const map = mapInstance.current
    if (!map) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current.clear()

    evts.forEach(evt => {
      const [eLon, eLat] = evt.venue.location.coordinates
      const marker = L.marker([eLat, eLon], { icon: makeIcon(evt.category) })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:180px">
            <strong style="font-size:13px">${evt.title}</strong><br/>
            <span style="font-size:11px;color:#94a3b8">
              ${evt.venue.name}, ${evt.venue.city}<br/>
              ${new Date(evt.starts_at).toLocaleDateString()}<br/>
              ${evt.min_price === 0 && evt.max_price === 0 ? 'Free' : `$${evt.min_price}–$${evt.max_price}`}
            </span>
          </div>
        `)
        .on('click', () => setSelected(evt))
      markersRef.current.set(evt.id, marker)
    })

    if (evts.length > 0) {
      const bounds = L.latLngBounds(evts.map(e => {
        const [lo, la] = e.venue.location.coordinates
        return [la, lo] as [number, number]
      }))
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }

  async function search() {
    setLoading(true)
    setError('')
    setSelected(null)
    try {
      if (mode === 'radius') {
        const km = parseFloat(radius) / 1000
        const res = await getNearbyEvents(parseFloat(lat), parseFloat(lon), km)
        setEvents(res.data)
        placeMarkers(res.data)
        // Add centre circle
        const map = mapInstance.current!
        map.eachLayer(l => { if ((l as L.Circle).getRadius) l.remove() })
        L.circle([parseFloat(lat), parseFloat(lon)], {
          radius: parseFloat(radius),
          color: '#8b5cf6', fillColor: '#8b5cf6', fillOpacity: 0.08, weight: 1.5,
        }).addTo(map)
      } else {
        const map = mapInstance.current!
        const b = map.getBounds()
        const res = await getBboxEvents(b.getSouth(), b.getWest(), b.getNorth(), b.getEast())
        setEvents(res.data)
        placeMarkers(res.data)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <div className="lg:w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
        {/* Controls */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
          <div className="flex gap-2 mb-3">
            {(['radius', 'bbox'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${mode === m ? 'bg-brand-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
              >
                {m === 'radius' ? '📍 Radius' : '🔲 Viewport'}
              </button>
            ))}
          </div>

          {mode === 'radius' ? (
            <div className="space-y-2">
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Latitude
                <input value={lat} onChange={e => setLat(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-brand-500" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Longitude
                <input value={lon} onChange={e => setLon(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-brand-500" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Radius (metres)
                <input type="range" min="500" max="20000" step="500" value={radius}
                  onChange={e => setRadius(e.target.value)}
                  className="accent-brand-500" />
                <span className="text-white">{(parseFloat(radius)/1000).toFixed(1)} km</span>
              </label>
              <p className="text-xs text-slate-500">Click map to set centre</p>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Pan and zoom the map, then click Search to find events in the current viewport.</p>
          )}

          <button
            onClick={search}
            disabled={loading}
            className="w-full mt-3 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>

          {error && <p className="mt-2 text-red-400 text-xs">{error}</p>}
          {events.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">{events.length} event{events.length !== 1 ? 's' : ''} found</p>
          )}
        </div>

        {/* Results list */}
        {events.map(e => (
          <div key={e.id}
            onClick={() => {
              setSelected(e)
              const marker = markersRef.current.get(e.id)
              if (marker) {
                marker.openPopup()
                mapInstance.current?.panTo(marker.getLatLng(), { animate: true })
              }
            }}
            className={`cursor-pointer rounded-xl overflow-hidden border transition-all
              ${selected?.id === e.id
                ? 'border-brand-500 shadow-lg shadow-brand-600/20'
                : 'border-slate-700/50 hover:border-slate-600'}`}
          >
            <EventCard event={e} onBook={onBook} distanceKm={e.distance_km} />
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="flex-1 rounded-xl overflow-hidden border border-slate-700/50 min-h-[320px]">
        <div ref={mapRef} className="w-full h-full" />
      </div>
    </div>
  )
}
