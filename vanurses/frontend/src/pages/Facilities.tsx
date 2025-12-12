import { useState, useRef, useEffect } from 'react'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, MapPin, Building2, Briefcase, Star, ChevronLeft, ChevronRight, ChevronUp, X, SlidersHorizontal, Lock, TrendingUp, Crown, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import { toTitleCase } from '../utils/format'
import { useAuth } from 'react-oidc-context'
import { useSubscription, isAdminUnlocked } from '../hooks/useSubscription'

function getGradeColor(grade: string) {
  // Handle grades with +/- modifiers (A+, A, A-, etc.)
  const base = grade?.charAt(0)?.toUpperCase()
  switch (base) {
    case 'A': return 'bg-emerald-500'
    case 'B': return 'bg-sky-500'
    case 'C': return 'bg-amber-500'
    case 'D': return 'bg-orange-500'
    case 'F': return 'bg-red-500'
    default: return 'bg-slate-400'
  }
}

// Index descriptions for tooltips (11 indices)
const INDEX_INFO: Record<string, { name: string; desc: string }> = {
  pci: { name: 'Pay', desc: 'Pay Competitiveness - Salary vs market rates' },
  eri: { name: 'Reviews', desc: 'Employee Reviews - Staff satisfaction scores' },
  lssi: { name: 'Safety', desc: 'Location Safety - Area crime & safety metrics' },
  pei: { name: 'Patient', desc: 'Patient Experience - HCAHPS scores' },
  fsi: { name: 'Facility', desc: 'Facility Stats - Size, teaching status, etc.' },
  ali: { name: 'Amenities', desc: 'Amenities & Lifestyle - Nearby conveniences' },
  jti: { name: 'Transparency', desc: 'Job Transparency - Pay disclosure rate' },
  csi: { name: 'Commute', desc: 'Commute Stress - Traffic & accessibility' },
  qli: { name: 'QoL', desc: 'Quality of Life - Cost of living, schools' },
  oii: { name: 'Opportunity', desc: 'Opportunity Insights - Economic mobility' },
  cci: { name: 'Climate', desc: 'Climate Comfort - Weather patterns' },
}

export default function Facilities() {
  const auth = useAuth()
  const { isPaid } = useSubscription()
  // Only show scores if user is authenticated AND has a paid subscription
  const canSeeAllScores = (auth.isAuthenticated && isPaid) || isAdminUnlocked()
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')
  const [system, setSystem] = useState('')
  const [facilityId, setFacilityId] = useState('')
  const [minGrade, setMinGrade] = useState('')
  const [excludeNursingHomes, setExcludeNursingHomes] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 20

  // Distance/location state
  const [distanceMode, setDistanceMode] = useState<'none' | 'profile' | 'custom'>('none')
  const [customZip, setCustomZip] = useState('')
  const [maxDistance, setMaxDistance] = useState('')

  // Refs for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const facilitiesContainerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // Free user visibility limit
  const FREE_VISIBLE_COUNT = 3

  // Restricted facilities - show letter grade but lock detailed breakdown
  const RESTRICTED_FACILITIES = ['inova fairfax hospital', 'inova loudoun hospital']
  const isRestrictedFacility = (name: string) => RESTRICTED_FACILITIES.some(
    restricted => name?.toLowerCase().includes(restricted.toLowerCase())
  )

  const { data: regions } = useQuery({
    queryKey: ['regions'],
    queryFn: () => api.get('/api/facilities/regions').then(res => res.data.data)
  })

  const { data: systems } = useQuery({
    queryKey: ['systems'],
    queryFn: () => api.get('/api/facilities/systems').then(res => res.data.data)
  })

  const { data: facilityNames } = useQuery({
    queryKey: ['facility-names'],
    queryFn: () => api.get('/api/facilities/names').then(res => res.data.data)
  })

  // Get actual total scored facilities from DB (not scroll-based)
  const { data: facilityStats } = useQuery({
    queryKey: ['facility-stats'],
    queryFn: () => api.get('/api/facilities/stats').then(res => res.data.data)
  })

  // Fetch user preferences to get their location_zip
  const { data: userPrefs } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => api.get('/api/me/preferences').then(res => res.data),
    enabled: auth.isAuthenticated
  })

  // Get location zip code based on distance mode
  const getLocationZip = () => {
    if (distanceMode === 'profile' && userPrefs?.location_zip) {
      return userPrefs.location_zip
    } else if (distanceMode === 'custom' && customZip && customZip.length === 5) {
      return customZip
    }
    return null
  }
  const locationZip = getLocationZip()

  // Latest scores - top rated facilities for the banner
  const { data: latestScores } = useQuery({
    queryKey: ['latest-scores'],
    queryFn: () => api.get('/api/facilities', {
      params: { limit: 5, min_grade: 'A' }
    }).then(res => res.data.data)
  })

  const activeFilters = [region, system, facilityId, minGrade, distanceMode !== 'none' ? 'distance' : ''].filter(Boolean).length

  const clearAllFilters = () => {
    setRegion('')
    setSystem('')
    setFacilityId('')
    setMinGrade('')
    setExcludeNursingHomes(false)
    setDistanceMode('none')
    setCustomZip('')
    setMaxDistance('')
    setSearch('')
    setCurrentPage(1)
  }

  // Infinite query for facilities
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading
  } = useInfiniteQuery({
    queryKey: ['facilities-infinite', search, region, system, facilityId, minGrade, distanceMode, customZip, maxDistance, locationZip],
    queryFn: async ({ pageParam = 0 }) => {
      // If a specific facility is selected, just fetch that one
      if (facilityId) {
        const res = await api.get(`/api/facilities/${facilityId}`)
        return {
          data: [res.data.data],
          total: 1,
          offset: 0
        }
      }
      const res = await api.get('/api/facilities', {
        params: {
          search: search || undefined,
          region: region || undefined,
          system: system || undefined,
          min_grade: minGrade || undefined,
          zip: locationZip || undefined,
          sort_by_distance: distanceMode !== 'none' && locationZip ? true : undefined,
          max_distance_miles: maxDistance ? parseInt(maxDistance) : undefined,
          limit,
          offset: pageParam
        }
      })
      return { ...res.data, offset: pageParam }
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage) return undefined
      const nextOffset = (lastPage.offset || 0) + limit
      return nextOffset < lastPage.total ? nextOffset : undefined
    },
    initialPageParam: 0
  })

  // Flatten all facilities from all pages and apply client-side filter
  const rawFacilities = data?.pages?.flatMap(page => page.data) || []
  const allFacilities = excludeNursingHomes
    ? rawFacilities.filter((f: any) => f.facility_type !== 'nursing_home')
    : rawFacilities
  const total = excludeNursingHomes
    ? allFacilities.length
    : (data?.pages?.[0]?.total || 0)
  const totalPages = Math.ceil(total / limit)

  // Auto-load more when scrolling to bottom
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Track current page based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const container = facilitiesContainerRef.current
      if (!container) return

      let newPage = 1
      pageRefs.current.forEach((element, pageNum) => {
        const rect = element.getBoundingClientRect()
        if (rect.top <= 200) {
          newPage = pageNum
        }
      })

      if (newPage !== currentPage) {
        setCurrentPage(newPage)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [currentPage])

  // Scroll to specific page
  const scrollToPage = (pageNum: number) => {
    const element = pageRefs.current.get(pageNum)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Scroll to top
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Facility Rankings</h1>
          <p className="text-slate-600">
            {facilityStats?.scored_count || '...'} healthcare facilities rated with our 13-index OFS scoring system
          </p>
        </div>
        {/* Live Indicator */}
        <div className="flex items-center gap-3 bg-slate-900 text-white px-4 py-2.5 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-medium text-emerald-400">LIVE</span>
          </div>
          <div className="w-px h-4 bg-slate-600" />
          <div className="flex items-center gap-1.5 text-sm text-slate-300">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
            <span>Updating scores</span>
          </div>
        </div>
      </div>

      {/* Upgrade Banner for non-paid users */}
      {!canSeeAllScores && (
        <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-xl p-6 text-white">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Crown className="w-6 h-6" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="font-bold text-lg">Unlock All Facility Scores</h3>
              <p className="text-primary-100 text-sm">
                Starting at only <span className="font-semibold text-white">$9/month</span> · Built by a nurse, for nurses
              </p>
            </div>
            <Link
              to="/billing#plans"
              className="px-6 py-2.5 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-colors flex items-center gap-2"
            >
              <Crown className="w-4 h-4" />
              Upgrade Now
            </Link>
          </div>
        </div>
      )}

      {/* Latest Scores Banner */}
      {latestScores && latestScores.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-primary-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-slate-900">Top-Rated Facilities</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {latestScores.map((facility: any, idx: number) => {
              const canSeeThisScore = canSeeAllScores || idx < FREE_VISIBLE_COUNT
              return (
                <Link
                  key={facility.id}
                  to={canSeeThisScore ? `/facilities/${facility.id}` : '/billing'}
                  className="flex-shrink-0 bg-white rounded-lg border border-slate-200 p-3 min-w-[200px] hover:border-emerald-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3">
                    {canSeeThisScore ? (
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${getGradeColor(facility.score?.ofs_grade)}`}>
                        {facility.score?.ofs_grade || 'A'}
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                        <Lock className="w-4 h-4 text-amber-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">{toTitleCase(facility.name)}</p>
                      <p className="text-xs text-slate-500">{facility.city}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col gap-4">
          {/* Search row */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search facilities or health systems..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
                showFilters || activeFilters > 0
                  ? 'bg-primary-50 border-primary-200 text-primary-700'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilters > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full">
                  {activeFilters}
                </span>
              )}
            </button>
            {/* Exclude nursing homes toggle */}
            <label className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors select-none">
              <input
                type="checkbox"
                checked={excludeNursingHomes}
                onChange={(e) => { setExcludeNursingHomes(e.target.checked); setCurrentPage(1) }}
                className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-slate-700">Exclude nursing homes</span>
            </label>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="pt-4 border-t border-slate-100">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
                  <select
                    value={region}
                    onChange={(e) => { setRegion(e.target.value); setCurrentPage(1) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Regions</option>
                    {regions?.map((r: string) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[180px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Health System</label>
                  <select
                    value={system}
                    onChange={(e) => { setSystem(e.target.value); setCurrentPage(1) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Systems</option>
                    {systems?.map((s: string) => (
                      <option key={s} value={s}>{toTitleCase(s)}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[180px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Facility</label>
                  <select
                    value={facilityId}
                    onChange={(e) => { setFacilityId(e.target.value); setCurrentPage(1) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Facilities</option>
                    {facilityNames?.map((f: { id: string; name: string; city: string }) => (
                      <option key={f.id} value={f.id}>{toTitleCase(f.name)} - {f.city}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[180px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">OFS Grade</label>
                  {canSeeAllScores ? (
                    <select
                      value={minGrade}
                      onChange={(e) => { setMinGrade(e.target.value); setCurrentPage(1) }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    >
                      <option value="">All Grades</option>
                      <option value="A">A (90-100)</option>
                      <option value="B">B (80-89)</option>
                      <option value="C">C (70-79)</option>
                      <option value="D">D (60-69)</option>
                      <option value="F">F (&lt;60)</option>
                    </select>
                  ) : (
                    <Link
                      to="/billing#plans"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-400 flex items-center gap-2 hover:bg-slate-100 transition-colors"
                    >
                      <Lock className="w-3 h-3" />
                      <span>Upgrade to filter by grade</span>
                    </Link>
                  )}
                </div>

                {/* Location/Distance Filter */}
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Distance From</label>
                  <select
                    value={distanceMode}
                    onChange={(e) => { setDistanceMode(e.target.value as 'none' | 'profile' | 'custom'); setCurrentPage(1) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="none">No Distance Filter</option>
                    {auth.isAuthenticated && userPrefs?.location_zip && (
                      <option value="profile">My Location ({userPrefs.location_zip})</option>
                    )}
                    <option value="custom">Enter ZIP Code</option>
                  </select>
                </div>

                {/* Custom ZIP Input */}
                {distanceMode === 'custom' && (
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">ZIP Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 23220"
                      value={customZip}
                      onChange={(e) => { setCustomZip(e.target.value.replace(/\D/g, '').slice(0, 5)); setCurrentPage(1) }}
                      maxLength={5}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                )}

                {/* Max Distance - only when distance filtering is active */}
                {distanceMode !== 'none' && (
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max Distance</label>
                    <select
                      value={maxDistance}
                      onChange={(e) => { setMaxDistance(e.target.value); setCurrentPage(1) }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    >
                      <option value="">Any Distance</option>
                      <option value="10">Within 10 miles</option>
                      <option value="25">Within 25 miles</option>
                      <option value="50">Within 50 miles</option>
                      <option value="100">Within 100 miles</option>
                    </select>
                  </div>
                )}
              </div>

              {activeFilters > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-wrap gap-2">
                    {region && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        {region}
                        <button onClick={() => { setRegion(''); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {system && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        {toTitleCase(system)}
                        <button onClick={() => { setSystem(''); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {facilityId && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        {facilityNames?.find((f: { id: string }) => f.id === facilityId)?.name || 'Facility'}
                        <button onClick={() => { setFacilityId(''); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {minGrade && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        Grade {minGrade}
                        <button onClick={() => { setMinGrade(''); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                  </div>
                  <button
                    onClick={clearAllFilters}
                    className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scoring Legend */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          <span className="text-slate-500">OFS Grades:</span>
          {['A', 'B', 'C', 'D', 'F'].map((grade) => (
            <div key={grade} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white ${getGradeColor(grade)}`}>
                {grade}
              </div>
              <span className="text-slate-500">
                {grade === 'A' && '90+'}
                {grade === 'B' && '80-89'}
                {grade === 'C' && '70-79'}
                {grade === 'D' && '60-69'}
                {grade === 'F' && '<60'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent"></div>
        </div>
      ) : allFacilities.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No facilities found matching your criteria.</p>
        </div>
      ) : (
        <div className="space-y-4 relative" ref={facilitiesContainerRef}>
          {allFacilities.map((facility: any, index: number) => {
            // Calculate which page this facility belongs to
            const pageNum = Math.floor(index / limit) + 1
            const isFirstOfPage = index % limit === 0

            // Show score if: paid user, OR first 3 overall
            const canSeeScore = canSeeAllScores || index < FREE_VISIBLE_COUNT
            // Can access full facility detail if: paid user OR first 3
            const canAccessFacility = canSeeAllScores || index < FREE_VISIBLE_COUNT

            return (
              <div
                key={facility.id}
                className="relative"
                ref={isFirstOfPage ? (el) => { if (el) pageRefs.current.set(pageNum, el) } : undefined}
              >
                <Link
                  to={canAccessFacility ? `/facilities/${facility.id}` : '/billing'}
                  className={`block bg-white rounded-xl border border-slate-200 p-6 transition-all ${canAccessFacility ? 'hover:border-primary-300 hover:shadow-md' : 'hover:border-amber-300'}`}
                >
                  <div className="flex items-start gap-6">
                    {/* Facility Score */}
                    <div className="flex-shrink-0">
                      {canSeeScore ? (
                        facility.score ? (
                          // For restricted facilities (INOVA), show grade with lock for free users
                          isRestrictedFacility(facility.name) && !canSeeAllScores ? (
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Facility Score</span>
                              <div className={`relative w-14 h-14 rounded-xl flex flex-col items-center justify-center text-white ${getGradeColor(facility.score.ofs_grade)}`} title="Upgrade to see details">
                                <span className="text-xl font-bold">{facility.score.ofs_grade}</span>
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center">
                                  <Lock className="w-3 h-3 text-amber-600" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Facility Score</span>
                              <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center text-white ${getGradeColor(facility.score.ofs_grade)}`} title="OFS: 11 scoring indices">
                                <span className="text-xl font-bold">{facility.score.ofs_grade}</span>
                                <span className="text-[10px] opacity-80">{Math.round(facility.score.ofs_score)}</span>
                              </div>
                            </div>
                          )
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Facility Score</span>
                            <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center">
                              <span className="text-slate-400 text-xs">N/A</span>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Facility Score</span>
                          <div className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                            <Lock className="w-5 h-5 text-amber-500" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Info - Always visible */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-slate-900 mb-1 truncate">
                        {toTitleCase(facility.name)}
                      </h3>
                      {facility.system_name && (
                        <p className="text-primary-600 text-sm mb-2">{toTitleCase(facility.system_name)}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {facility.city}, {facility.state}
                        </span>
                        {facility.bed_count && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            {facility.bed_count} beds
                          </span>
                        )}
                        {facility.job_count > 0 && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-4 h-4" />
                            {facility.job_count} open jobs
                          </span>
                        )}
                        {facility.is_magnet && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <Star className="w-4 h-4" />
                            Magnet
                          </span>
                        )}
                      </div>

                      {/* Score breakdown - only for paid users */}
                      {facility.score?.indices && canSeeScore && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Object.entries(facility.score.indices)
                            .filter(([, idx]: [string, any]) => idx.score !== null)
                            .sort(([, a]: [string, any], [, b]: [string, any]) => b.weight_pct - a.weight_pct)
                            .slice(0, 5) // Show top 5 indices (compact)
                            .map(([key, idx]: [string, any]) => {
                              const info = INDEX_INFO[key]
                              return (
                                <span
                                  key={key}
                                  title={info?.desc || idx.name}
                                  className={`px-2 py-0.5 rounded text-xs font-medium cursor-help ${
                                    idx.score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                    idx.score >= 60 ? 'bg-amber-100 text-amber-700' :
                                    'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {info?.name || key.toUpperCase()}: {idx.score}
                                </span>
                              )
                            })
                          }
                        </div>
                      )}
                      {/* Upgrade prompt for free users */}
                      {!canSeeScore && (
                        <div className="mt-3 flex items-center gap-2 text-amber-600 text-sm">
                          <Lock className="w-4 h-4" />
                          <span>Upgrade to see facility scores and details</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            )
          })}

          {/* Load more trigger */}
          <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
            {isFetchingNextPage && (
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent"></div>
            )}
          </div>
        </div>
      )}

      {/* Floating Page Indicator */}
      {totalPages > 1 && allFacilities.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full shadow-lg">
            <button
              onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-1 hover:bg-slate-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium min-w-[80px] text-center">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => {
                if (currentPage < totalPages) {
                  // Fetch next page if needed
                  if (hasNextPage && currentPage * limit >= allFacilities.length) {
                    fetchNextPage()
                  }
                  scrollToPage(currentPage + 1)
                }
              }}
              disabled={currentPage >= totalPages}
              className="p-1 hover:bg-slate-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-600 mx-1" />
            <button
              onClick={scrollToTop}
              className="p-1 hover:bg-slate-700 rounded flex items-center gap-1 text-xs"
            >
              <ChevronUp className="w-4 h-4" />
              Top
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
