import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { api } from '../api/client'
import {
  MapPin, Filter, Building2, Briefcase, ChevronDown, X, Lock, Crown
} from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useSubscription, isAdminUnlocked } from '../hooks/useSubscription'

interface Facility {
  id: string
  name: string
  city: string
  address: string
  latitude: number
  longitude: number
  ofs_score: number
  ofs_grade: string
  job_count: number
  health_system: string
  beds: number
}

// Virginia regions with approximate centers
const VA_REGIONS = [
  { name: 'Northern Virginia', lat: 38.8816, lng: -77.0910, zoom: 10 },
  { name: 'Hampton Roads', lat: 36.8529, lng: -76.2879, zoom: 10 },
  { name: 'Richmond Metro', lat: 37.5407, lng: -77.4360, zoom: 11 },
  { name: 'Shenandoah Valley', lat: 38.4496, lng: -78.8689, zoom: 10 },
  { name: 'Southwest Virginia', lat: 36.9859, lng: -81.0955, zoom: 9 },
  { name: 'Central Virginia', lat: 37.4138, lng: -79.1422, zoom: 10 },
]

const GRADE_COLORS: Record<string, string> = {
  'A+': '#10b981', 'A': '#10b981', 'A-': '#34d399',
  'B+': '#22c55e', 'B': '#84cc16', 'B-': '#a3e635',
  'C+': '#eab308', 'C': '#f59e0b', 'C-': '#f97316',
  'D+': '#fb923c', 'D': '#ef4444', 'D-': '#dc2626',
  'F': '#b91c1c',
}

// Virginia center coordinates
const VA_CENTER: [number, number] = [37.5, -78.8]
const DEFAULT_ZOOM = 7

// Create custom marker icons by grade
const createMarkerIcon = (grade: string, canSeeScore: boolean) => {
  const color = canSeeScore ? (GRADE_COLORS[grade] || '#6b7280') : '#94a3b8' // Slate for free users
  const displayText = canSeeScore ? grade : '?'
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
      <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">${displayText}</text>
    </svg>
  `
  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  })
}

// Component to handle map view changes
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
  }, [map, center, zoom])
  return null
}

export default function Map() {
  const navigate = useNavigate()
  const auth = useAuth()
  const { isPaid } = useSubscription()
  // Only show scores if user is authenticated AND has a paid subscription
  const canSeeAllScores = (auth.isAuthenticated && isPaid) || isAdminUnlocked()
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null)
  const [filters, setFilters] = useState({
    minGrade: 'F',
    region: 'all',
  })
  const [showFilters, setShowFilters] = useState(false)
  const [mapCenter, setMapCenter] = useState<[number, number]>(VA_CENTER)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)

  // Fetch real facilities from API
  const { data: facilitiesData, isLoading } = useQuery({
    queryKey: ['facilities-map'],
    queryFn: () => api.get('/api/facilities?limit=500').then(res => res.data),
  })

  // Extract facilities array from response
  const facilities: Facility[] = useMemo(() => {
    if (!facilitiesData) return []
    // Handle both { facilities: [...] } and { data: [...] } response formats
    const list = facilitiesData.facilities || facilitiesData.data || []
    return list.map((f: any) => ({
      id: f.id,
      name: f.name,
      city: f.city || '',
      address: f.address || '',
      latitude: f.latitude || 0,
      longitude: f.longitude || 0,
      // Handle both flat and nested score structures
      ofs_score: f.score?.ofs_score || f.ofs_score || 0,
      ofs_grade: f.score?.ofs_grade || f.ofs_grade || 'N/A',
      job_count: f.job_count || 0,
      health_system: f.system_name || f.health_system || '',
      beds: f.bed_count || f.beds || 0,
    }))
  }, [facilitiesData])

  // Filter facilities
  const filteredFacilities = useMemo(() => {
    return facilities.filter(f => {
      // Must have valid coordinates
      if (!f.latitude || !f.longitude) return false
      const gradeOrder = ['F', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+']
      if (gradeOrder.indexOf(f.ofs_grade) < gradeOrder.indexOf(filters.minGrade)) return false
      return true
    })
  }, [facilities, filters])

  const handleRegionClick = (region: typeof VA_REGIONS[0]) => {
    setMapCenter([region.lat, region.lng])
    setZoom(region.zoom)
    setFilters(f => ({ ...f, region: region.name }))
  }

  const handleReset = () => {
    setMapCenter(VA_CENTER)
    setZoom(DEFAULT_ZOOM)
    setFilters(f => ({ ...f, region: 'all' }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Facility Map</h1>
          <p className="text-slate-600">
            {isLoading ? 'Loading...' : `${filteredFacilities.length} facilities across Virginia`}
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          <Filter className="w-4 h-4" />
          Filters
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Minimum Grade</label>
              {canSeeAllScores ? (
                <select
                  value={filters.minGrade}
                  onChange={e => setFilters(f => ({ ...f, minGrade: e.target.value }))}
                  className="px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="F">All Grades</option>
                  <option value="C">C and above</option>
                  <option value="B">B and above</option>
                  <option value="A-">A- and above</option>
                </select>
              ) : (
                <Link
                  to="/billing#plans"
                  className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 flex items-center gap-2 hover:bg-slate-100 transition-colors"
                >
                  <Lock className="w-3 h-3" />
                  <span>Upgrade to filter by grade</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Region Quick Links */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-slate-500 py-2">Jump to region:</span>
        {VA_REGIONS.map(region => (
          <button
            key={region.name}
            onClick={() => handleRegionClick(region)}
            className={`px-3 py-1.5 text-sm rounded-full border ${
              filters.region === region.name
                ? 'bg-primary-600 text-white border-primary-600'
                : 'border-slate-300 hover:border-primary-300'
            }`}
          >
            {region.name}
          </button>
        ))}
        <button
          onClick={handleReset}
          className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          Reset
        </button>
      </div>

      {/* Map Container */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Leaflet Map */}
        <div className="lg:col-span-2 bg-slate-100 rounded-xl overflow-hidden relative" style={{ height: '600px' }}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent"></div>
            </div>
          ) : (
            <MapContainer
              center={mapCenter}
              zoom={zoom}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController center={mapCenter} zoom={zoom} />

              {filteredFacilities.map((facility, index) => {
                // Show score for first 3 facilities in list (consistent with Facilities page)
                const canSeeScore = canSeeAllScores || index < 3
                return (
                  <Marker
                    key={facility.id}
                    position={[facility.latitude, facility.longitude]}
                    icon={createMarkerIcon(facility.ofs_grade, canSeeScore)}
                    eventHandlers={{
                      click: () => setSelectedFacility(facility),
                    }}
                  >
                    <Popup>
                      <div className="min-w-[200px]">
                        <h3 className="font-bold text-slate-900 mb-1">{facility.name}</h3>
                        <p className="text-sm text-slate-600 mb-2">{facility.city}</p>
                        <div className="mb-2">
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider">Facility Score</span>
                          {canSeeScore ? (
                            <div className="flex items-center gap-2">
                              <div
                                className="px-2 py-1 rounded text-white text-xs font-bold"
                                style={{ backgroundColor: GRADE_COLORS[facility.ofs_grade] }}
                              >
                                {facility.ofs_grade}
                              </div>
                              <span className="text-sm text-slate-600">{facility.ofs_score}/100</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="px-2 py-1 rounded bg-slate-200 text-slate-400 text-xs font-bold relative">
                                <span className="blur-[3px] select-none">A+</span>
                                <Lock className="absolute inset-0 m-auto w-3 h-3 text-slate-400" />
                              </div>
                              <span className="text-sm text-slate-400">Upgrade to view</span>
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 mb-2">
                          {facility.job_count} open positions
                        </div>
                        {canSeeScore ? (
                          <button
                            onClick={() => navigate(`/facilities/${facility.id}`)}
                            className="w-full py-1.5 bg-primary-600 text-white rounded text-sm font-medium hover:bg-primary-700"
                          >
                            View Details
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate('/billing#plans')}
                            className="w-full py-1.5 bg-amber-500 text-white rounded text-sm font-medium hover:bg-amber-600 flex items-center justify-center gap-1"
                          >
                            <Crown className="w-3 h-3" />
                            Unlock Scores & Trends
                          </button>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>
          )}

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-3 z-[400]">
            <div className="text-xs font-medium text-slate-700 mb-2">Grade Legend</div>
            <div className="flex gap-2">
              {['A', 'B', 'C', 'D', 'F'].map(grade => (
                <div key={grade} className="flex items-center gap-1">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: GRADE_COLORS[grade] }}
                  />
                  <span className="text-xs text-slate-600">{grade}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Facilities count - positioned right to avoid zoom controls */}
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md px-3 py-2 z-[400]">
            <span className="text-sm font-medium text-slate-700">
              {filteredFacilities.length} facilities
            </span>
          </div>
        </div>

        {/* Facility List / Detail */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {selectedFacility ? (
            /* Facility Detail */
            (() => {
              // Find index of selected facility in filtered list
              const selectedIndex = filteredFacilities.findIndex(f => f.id === selectedFacility.id)
              const canSeeScore = canSeeAllScores || selectedIndex < 3
              return (
                <div className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900">{selectedFacility.name}</h3>
                      <p className="text-sm text-slate-500">{selectedFacility.city}</p>
                    </div>
                    <button
                      onClick={() => setSelectedFacility(null)}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    {canSeeScore ? (
                      <>
                        <div
                          className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold"
                          style={{ backgroundColor: GRADE_COLORS[selectedFacility.ofs_grade] }}
                        >
                          {selectedFacility.ofs_grade}
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-slate-900">{selectedFacility.ofs_score}</div>
                          <div className="text-sm text-slate-500">Facility Score</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-slate-100 relative">
                          <span className="text-2xl font-bold text-slate-300 blur-[4px] select-none">A+</span>
                          <Lock className="absolute w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <div className="text-sm text-slate-400 flex items-center gap-1">
                            <Crown className="w-4 h-4" />
                            Upgrade to view scores
                          </div>
                          <Link to="/billing#plans" className="text-xs text-primary-600 hover:underline">
                            See plans
                          </Link>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      {selectedFacility.health_system || 'Independent'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      {selectedFacility.address || selectedFacility.city}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Briefcase className="w-4 h-4 text-slate-400" />
                      {selectedFacility.job_count} open positions
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {canSeeScore ? (
                      <button
                        onClick={() => navigate(`/facilities/${selectedFacility.id}`)}
                        className="flex-1 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
                      >
                        View Details
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate('/billing#plans')}
                        className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 flex items-center justify-center gap-1"
                      >
                        <Crown className="w-4 h-4" />
                        Unlock Scores & Trends
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/jobs?facility=${selectedFacility.name}`)}
                      className="flex-1 py-2 border border-slate-300 rounded-lg font-medium hover:bg-slate-50"
                    >
                      View Jobs
                    </button>
                  </div>
                </div>
              )
            })()
          ) : (
            /* Facility List */
            <div>
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900">Facilities</h3>
                <p className="text-sm text-slate-500">Click a marker or facility to view details</p>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {filteredFacilities.length === 0 ? (
                  <div className="p-4 text-center text-slate-500">
                    {isLoading ? 'Loading facilities...' : 'No facilities match your filters'}
                  </div>
                ) : (
                  filteredFacilities.map((facility, index) => {
                    // Show score for first 3 facilities in list
                    const canSeeScore = canSeeAllScores || index < 3
                    return (
                      <button
                        key={facility.id}
                        onClick={() => {
                          setSelectedFacility(facility)
                          setMapCenter([facility.latitude, facility.longitude])
                          setZoom(12)
                        }}
                        className="w-full p-4 text-left border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center flex-shrink-0">
                            <span className="text-[7px] text-slate-400 uppercase tracking-wider mb-0.5">Score</span>
                            {canSeeScore ? (
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                                style={{ backgroundColor: GRADE_COLORS[facility.ofs_grade] }}
                                title="Facility Score"
                              >
                                {facility.ofs_grade}
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 text-slate-300 text-sm font-bold relative" title="Upgrade to view Facility Score">
                                <span className="blur-[3px] select-none">A+</span>
                                <Lock className="absolute w-3 h-3 text-slate-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-900 truncate">{facility.name}</div>
                            <div className="text-sm text-slate-500">{facility.city}</div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                              <span>{facility.job_count} jobs</span>
                              {facility.beds > 0 && <span>{facility.beds} beds</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
