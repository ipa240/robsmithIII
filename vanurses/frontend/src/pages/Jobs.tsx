import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { Search, MapPin, Clock, DollarSign, Building2, ChevronLeft, ChevronRight, ChevronUp, SlidersHorizontal, X, Gift, Truck, Award, Calendar, Lock, Crown, RefreshCw, Sparkles, Heart, TrendingUp, Eye, Baby, Loader2, GraduationCap, User, Zap } from 'lucide-react'
import { api } from '../api/client'
import { toTitleCase } from '../utils/format'
import { useSubscription, isAdminUnlocked } from '../hooks/useSubscription'
import JobPreviewDrawer from '../components/JobPreviewDrawer'

// Format employment types for display: full_time -> "Full Time"
const formatEmploymentType = (type: string): string => {
  const formatMap: Record<string, string> = {
    'full_time': 'Full Time',
    'part_time': 'Part Time',
    'prn': 'PRN',
    'travel': 'Travel',
    'contract': 'Contract',
    'temporary': 'Temporary',
    'other': 'Other',
  }
  return formatMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// Format nursing types for display: cna -> "CNA", rn -> "RN"
const formatNursingType = (type: string): string => {
  const formatMap: Record<string, string> = {
    'cna': 'CNA',
    'cnm': 'CNM',
    'crna': 'CRNA',
    'lpn': 'LPN',
    'np': 'NP',
    'rn': 'RN',
  }
  return formatMap[type?.toLowerCase()] || type?.toUpperCase() || type
}

// Format specialties for display: case_management -> "Case Management"
const formatSpecialty = (specialty: string): string => {
  const formatMap: Record<string, string> = {
    'cardiac': 'Cardiac',
    'case_management': 'Case Management',
    'cath_lab': 'Cath Lab',
    'cvor': 'CVOR',
    'dialysis': 'Dialysis',
    'education': 'Education',
    'endo': 'Endoscopy',
    'er': 'Emergency',
    'float': 'Float Pool',
    'general': 'General',
    'home_health': 'Home Health',
    'hospice': 'Hospice',
    'icu': 'ICU',
    'infection_control': 'Infection Control',
    'labor_delivery': 'Labor & Delivery',
    'ltc': 'Long Term Care',
    'med_surg': 'Med/Surg',
    'neuro': 'Neuro',
    'nicu': 'NICU',
    'oncology': 'Oncology',
    'or': 'OR',
    'ortho': 'Orthopedics',
    'outpatient': 'Outpatient',
    'pacu': 'PACU',
    'peds': 'Pediatrics',
    'pre_op': 'Pre-Op',
    'psych': 'Psych',
    'quality': 'Quality',
    'rehab': 'Rehab',
    'skilled_nursing': 'Skilled Nursing',
    'tele': 'Telemetry',
    'travel': 'Travel',
    'wound': 'Wound Care',
  }
  return formatMap[specialty?.toLowerCase()] || specialty?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || specialty
}

// Grade color helper
const getGradeColor = (grade: string) => {
  const colors: Record<string, string> = {
    'A': 'bg-emerald-100 text-emerald-700',
    'B': 'bg-blue-100 text-blue-700',
    'C': 'bg-yellow-100 text-yellow-700',
    'D': 'bg-orange-100 text-orange-700',
    'F': 'bg-red-100 text-red-700',
  }
  return colors[grade] || 'bg-slate-100 text-slate-700'
}

export default function Jobs() {
  const auth = useAuth()
  const { isPaid, isFacilities, canAccessJobs } = useSubscription()
  // Paid users OR admin unlocked can see all grades
  const isPaidUser = (auth.isAuthenticated && isPaid) || isAdminUnlocked()

  // Tab state: 'all' for regular jobs, 'matched' for personalized matches
  const [activeTab, setActiveTab] = useState<'all' | 'matched'>('all')

  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    nursing_type: '',
    specialty: '',
    employment_type: '',
    shift_type: '',
    region: '',
    facility_system: '',
    facility_id: '',
    childcare: '',
    ofs_grade: '',
    posted_within_days: '',
    min_pay: '',
    max_pay: '',
    has_sign_on_bonus: false,
    has_relocation: false,
    pay_disclosed_only: false,
    // New enrichment-based filters
    new_grad_friendly: false,
    bsn_required: '',  // 'yes', 'no', or ''
    certification: '',  // 'ACLS', 'BLS', 'PALS', etc.
    exclude_nursing_homes: true,  // Default to excluding nursing homes
  })

  // Distance/location state
  const [distanceMode, setDistanceMode] = useState<'none' | 'profile' | 'custom'>('none')
  const [customZip, setCustomZip] = useState('')
  const [maxDistance, setMaxDistance] = useState<string>('')

  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // Handle browser back button for drawer - close drawer instead of navigating away
  useEffect(() => {
    const handlePopState = () => {
      if (drawerOpen) {
        setDrawerOpen(false)
        setSelectedJob(null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [drawerOpen])

  // Push history entry when drawer opens
  useEffect(() => {
    if (drawerOpen) {
      window.history.pushState({ drawerOpen: true }, '')
    }
  }, [drawerOpen])

  // Close drawer and clean up history
  const closeDrawer = () => {
    setDrawerOpen(false)
    setSelectedJob(null)
    // Go back to remove the history entry we added
    if (window.history.state?.drawerOpen) {
      window.history.back()
    }
  }
  const limit = 20
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const jobsContainerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // Fetch user preferences to get their location_zip
  const { data: userPrefs } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => api.get('/api/me/preferences').then(res => res.data.data),
    enabled: auth.isAuthenticated
  })

  // Check if user has set preferences for matching
  const hasPreferences = !!(userPrefs?.specialties?.length || userPrefs?.employment_types?.length)

  // Fetch matched jobs (personalized) - only when tab is active and user is paid
  const { data: matchedJobsData, isLoading: isLoadingMatched } = useQuery({
    queryKey: ['matched-jobs', userPrefs?.specialties, userPrefs?.employment_types],
    queryFn: () => api.get('/api/jobs/matched', {
      params: {
        specialties: userPrefs?.specialties?.join(',') || undefined,
        employment_types: userPrefs?.employment_types?.join(',') || undefined,
        limit: 50
      }
    }).then(res => res.data),
    enabled: auth.isAuthenticated && isPaidUser && activeTab === 'matched' && hasPreferences
  })

  const matchedJobs = matchedJobsData?.data || []

  const { data: filterOptions } = useQuery({
    queryKey: ['filters'],
    queryFn: () => api.get('/api/filters').then(res => res.data.data)
  })

  // Count active filters (excluding empty strings and false booleans)
  const activeFilters = Object.entries(filters).filter(([_, v]) => v && v !== '').length

  // Get location zip code based on distance mode
  const getLocationZip = (): string | null => {
    if (distanceMode === 'profile' && userPrefs?.location_zip) {
      return userPrefs.location_zip
    } else if (distanceMode === 'custom' && customZip && customZip.length === 5) {
      return customZip
    }
    return null
  }

  const locationZip = getLocationZip()

  const clearAllFilters = () => {
    setFilters({
      nursing_type: '',
      specialty: '',
      employment_type: '',
      shift_type: '',
      region: '',
      facility_system: '',
      facility_id: '',
      childcare: '',
      ofs_grade: '',
      posted_within_days: '',
      min_pay: '',
      max_pay: '',
      has_sign_on_bonus: false,
      has_relocation: false,
      pay_disclosed_only: false,
      new_grad_friendly: false,
      bsn_required: '',
      certification: '',
      exclude_nursing_homes: true,  // Keep default to exclude nursing homes
    })
    setSearch('')
    setDistanceMode('none')
    setCustomZip('')
    setMaxDistance('')
    setCurrentPage(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['jobs-infinite', search, filters, distanceMode, customZip, maxDistance, locationZip],
    queryFn: ({ pageParam = 0 }) => api.get('/api/jobs', {
      params: {
        search: search || undefined,
        nursing_type: filters.nursing_type || undefined,
        specialty: filters.specialty || undefined,
        employment_type: filters.employment_type || undefined,
        shift_type: filters.shift_type || undefined,
        region: filters.region || undefined,
        facility_system: filters.facility_system || undefined,
        facility_id: filters.facility_id || undefined,
        childcare: filters.childcare || undefined,
        ofs_grade: filters.ofs_grade || undefined,
        posted_within_days: filters.posted_within_days ? parseInt(filters.posted_within_days) : undefined,
        min_pay: filters.min_pay ? parseInt(filters.min_pay) : undefined,
        max_pay: filters.max_pay ? parseInt(filters.max_pay) : undefined,
        has_sign_on_bonus: filters.has_sign_on_bonus || undefined,
        has_relocation: filters.has_relocation || undefined,
        pay_disclosed_only: filters.pay_disclosed_only || undefined,
        // New enrichment-based filters
        new_grad_friendly: filters.new_grad_friendly || undefined,
        bsn_required: filters.bsn_required || undefined,
        certification: filters.certification || undefined,
        // Exclude nursing homes
        exclude_nursing_homes: filters.exclude_nursing_homes || undefined,
        // Location-based sorting
        user_zip: locationZip || undefined,
        sort_by_distance: distanceMode !== 'none' && locationZip ? true : undefined,
        max_distance_miles: maxDistance ? parseInt(maxDistance) : undefined,
        limit,
        offset: pageParam * limit
      }
    }).then(res => res.data),
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.length * limit
      return loadedCount < lastPage.total ? allPages.length : undefined
    },
    initialPageParam: 0,
  })

  // Flatten all pages into a single jobs array
  const jobs = useMemo(() => {
    return data?.pages.flatMap(page => page.data) || []
  }, [data])

  const total = data?.pages[0]?.total || 0
  const totalPages = Math.ceil(total / limit)

  // Infinite scroll: observe the load more trigger
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
      const viewportMiddle = window.scrollY + window.innerHeight / 2
      let newCurrentPage = 1

      pageRefs.current.forEach((element, pageNum) => {
        if (element) {
          const rect = element.getBoundingClientRect()
          const elementTop = rect.top + window.scrollY
          if (elementTop < viewportMiddle) {
            newCurrentPage = pageNum
          }
        }
      })

      if (newCurrentPage !== currentPage) {
        setCurrentPage(newCurrentPage)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [currentPage])

  // Navigate to specific page
  const goToPage = (pageNum: number) => {
    const element = pageRefs.current.get(pageNum)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // NOTE: On Jobs page, ALL OFS grades are blurred for free users (no top 3 exception)
  // The top 3 exception only applies to the Facilities page

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Nursing Jobs</h1>
          <p className="text-slate-600">
            {activeTab === 'all'
              ? `${total.toLocaleString()} jobs available across Virginia`
              : `${matchedJobs.length} jobs matched to your profile`
            }
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
            <span>Updating jobs</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'all'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Search className="w-4 h-4" />
          All Jobs
        </button>
        <button
          onClick={() => {
            if (!auth.isAuthenticated) {
              auth.signinRedirect()
              return
            }
            setActiveTab('matched')
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'matched'
              ? 'bg-gradient-to-r from-primary-600 to-accent-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Zap className="w-4 h-4" />
          For You
          {!isPaidUser && <Lock className="w-3 h-3 text-amber-500" />}
        </button>
      </div>

      {/* Facilities-only User Banner */}
      {isFacilities && !canAccessJobs && (
        <div className="bg-gradient-to-r from-rose-600 to-rose-500 rounded-xl p-5 text-white">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Heart className="w-5 h-5" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-bold">You're on the Facilities Plan</h3>
              <p className="text-rose-100 text-sm">
                Your plan is for researching nursing homes & hospitals. Upgrade to view job details.
              </p>
            </div>
            <Link
              to="/billing"
              className="px-5 py-2 bg-white text-rose-600 rounded-lg font-semibold hover:bg-rose-50 transition-colors text-sm"
            >
              Upgrade to Starter - $9/mo
            </Link>
          </div>
        </div>
      )}

      {/* Upgrade Banner - for non-paid users */}
      {!isPaidUser && !isFacilities && (
        <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-xl p-5 text-white">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-bold">Built by a nurse, for nurses</h3>
              <p className="text-primary-100 text-sm">
                Unlock market rates, facility scores & more for only <span className="font-semibold text-white">$9/month</span>
              </p>
            </div>
            {(!auth.isAuthenticated && !isAdminUnlocked()) ? (
              <button
                onClick={() => auth.signinRedirect()}
                className="px-5 py-2 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-sm flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Create Free Account
              </button>
            ) : (
              <Link
                to="/billing"
                className="px-5 py-2 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-sm"
              >
                Upgrade Now
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Search and Filters - only show on "all" tab */}
      {activeTab === 'all' && (
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col gap-4">
          {/* Search row */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search jobs by title or description..."
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
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="pt-4 border-t border-slate-100">
              {/* Row 1: Dropdowns */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={filters.nursing_type}
                    onChange={(e) => { setFilters(f => ({ ...f, nursing_type: e.target.value })); setCurrentPage(1) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Types</option>
                    {filterOptions?.nursing_types?.map((t: string) => (
                      <option key={t} value={t}>{formatNursingType(t)}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Specialty</label>
                  <select
                    value={filters.specialty}
                    onChange={(e) => { setFilters(f => ({ ...f, specialty: e.target.value })); setCurrentPage(1) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Specialties</option>
                    {filterOptions?.specialties?.map((s: string) => (
                      <option key={s} value={s}>{formatSpecialty(s)}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Employment</label>
                  <select
                    value={filters.employment_type}
                    onChange={(e) => { setFilters(f => ({ ...f, employment_type: e.target.value })); setCurrentPage(1) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Employment</option>
                    {filterOptions?.employment_types?.map((e: string) => (
                      <option key={e} value={e}>{formatEmploymentType(e)}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Shift</label>
                  <select
                    value={filters.shift_type}
                    onChange={(e) => { setFilters(f => ({ ...f, shift_type: e.target.value })); setCurrentPage(1) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Shifts</option>
                    {filterOptions?.shift_types?.map((s: string) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
                  <select
                    value={filters.region}
                    onChange={(e) => { setFilters(f => ({ ...f, region: e.target.value })); setCurrentPage(1) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Regions</option>
                    {filterOptions?.regions?.map((r: string) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Health System, Facility, Facility Grade, Posted */}
              <div className="flex flex-wrap gap-4 mb-4 pt-4 border-t border-slate-100">
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Health System</label>
                  <select
                    value={filters.facility_system}
                    onChange={(e) => { setFilters(f => ({ ...f, facility_system: e.target.value })); setCurrentPage(1) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Systems</option>
                    {filterOptions?.facility_systems?.map((s: string) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[180px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Facility</label>
                  <select
                    value={filters.facility_id}
                    onChange={(e) => { setFilters(f => ({ ...f, facility_id: e.target.value })); setCurrentPage(1) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Facilities</option>
                    {filterOptions?.facilities?.map((f: { id: string, name: string, city: string }) => (
                      <option key={f.id} value={f.id}>{f.name} ({f.city})</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Facility Grade</label>
                  {isPaidUser ? (
                    <select
                      value={filters.ofs_grade}
                      onChange={(e) => { setFilters(f => ({ ...f, ofs_grade: e.target.value })); setCurrentPage(1) }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    >
                      <option value="">All Grades</option>
                      {filterOptions?.ofs_grades?.map((g: string) => (
                        <option key={g} value={g}>Grade {g}</option>
                      ))}
                    </select>
                  ) : (
                    <Link
                      to="/billing"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-400 flex items-center gap-2 hover:bg-slate-100 transition-colors"
                    >
                      <Lock className="w-3 h-3" />
                      <span>Upgrade to filter by grade</span>
                    </Link>
                  )}
                </div>

                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Posted</label>
                  <select
                    value={filters.posted_within_days}
                    onChange={(e) => { setFilters(f => ({ ...f, posted_within_days: e.target.value })); setCurrentPage(1) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">Any Time</option>
                    {filterOptions?.posted_within_options?.map((o: { value: number, label: string }) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Distance/Location and Childcare */}
              <div className="flex flex-wrap gap-4 mb-4 pt-4 border-t border-slate-100">
                {/* Distance Filter */}
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary-500" />
                    Sort by Distance
                  </label>
                  <select
                    value={distanceMode}
                    onChange={(e) => { setDistanceMode(e.target.value as 'none' | 'profile' | 'custom'); setCurrentPage(1) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="none">Most Recent First</option>
                    {auth.isAuthenticated && userPrefs?.location_zip && (
                      <option value="profile">From My Location ({userPrefs.location_zip})</option>
                    )}
                    <option value="custom">Enter Zip Code</option>
                  </select>
                </div>

                {/* Custom Zip Code Input - only show when custom mode selected */}
                {distanceMode === 'custom' && (
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Zip Code</label>
                    <input
                      type="text"
                      placeholder="22101"
                      value={customZip}
                      onChange={(e) => { setCustomZip(e.target.value.replace(/\D/g, '').slice(0, 5)); setCurrentPage(1) }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      maxLength={5}
                    />
                  </div>
                )}

                {/* Max Distance Filter - only show when distance sorting is active */}
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

                {/* Childcare */}
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    <Baby className="w-4 h-4 text-pink-500" />
                    Childcare
                    {!isPaidUser && <span title="Premium feature"><Crown className="w-3 h-3 text-amber-500" /></span>}
                  </label>
                  {isPaidUser ? (
                    <select
                      value={filters.childcare}
                      onChange={(e) => { setFilters(f => ({ ...f, childcare: e.target.value })); setCurrentPage(1) }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    >
                      <option value="">Any</option>
                      {filterOptions?.childcare_options?.map((o: { value: string, label: string }) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Link
                      to="/billing"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-400 flex items-center gap-2 cursor-pointer hover:border-primary-300"
                    >
                      <Lock className="w-3 h-3" />
                      <span>Upgrade to filter by childcare</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Row 4: Pay Range and Checkboxes */}
              <div className="flex flex-wrap items-end gap-4 pt-4 border-t border-slate-100">
                <div className="flex items-end gap-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Min Pay ($/hr)</label>
                    <input
                      type="number"
                      placeholder="25"
                      value={filters.min_pay}
                      onChange={(e) => { setFilters(f => ({ ...f, min_pay: e.target.value })); setCurrentPage(1) }}
                      className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <span className="text-slate-400 pb-2">-</span>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max Pay</label>
                    <input
                      type="number"
                      placeholder="75"
                      value={filters.max_pay}
                      onChange={(e) => { setFilters(f => ({ ...f, max_pay: e.target.value })); setCurrentPage(1) }}
                      className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.pay_disclosed_only}
                    onChange={(e) => { setFilters(f => ({ ...f, pay_disclosed_only: e.target.checked })); setCurrentPage(1) }}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700">Pay disclosed only</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.has_sign_on_bonus}
                    onChange={(e) => { setFilters(f => ({ ...f, has_sign_on_bonus: e.target.checked })); setCurrentPage(1) }}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <Gift className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm text-slate-700">Sign-on bonus</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.has_relocation}
                    onChange={(e) => { setFilters(f => ({ ...f, has_relocation: e.target.checked })); setCurrentPage(1) }}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <Truck className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-slate-700">Relocation assistance</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.new_grad_friendly}
                    onChange={(e) => { setFilters(f => ({ ...f, new_grad_friendly: e.target.checked })); setCurrentPage(1) }}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <GraduationCap className="w-4 h-4 text-purple-500" />
                  <span className="text-sm text-slate-700">New grad friendly</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.exclude_nursing_homes}
                    onChange={(e) => { setFilters(f => ({ ...f, exclude_nursing_homes: e.target.checked })); setCurrentPage(1) }}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-700">Exclude Nursing Homes</span>
                </label>
              </div>

              {/* Row 5: Education & Certification Filters */}
              <div className="flex flex-wrap items-end gap-4 pt-4 border-t border-slate-100">
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-indigo-500" />
                    Education
                  </label>
                  <select
                    value={filters.bsn_required}
                    onChange={(e) => { setFilters(f => ({ ...f, bsn_required: e.target.value })); setCurrentPage(1) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">Any Education</option>
                    <option value="yes">BSN Required</option>
                    <option value="no">ADN/ASN Accepted</option>
                  </select>
                </div>

                <div className="flex-1 min-w-[160px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    Certification Required
                  </label>
                  <select
                    value={filters.certification}
                    onChange={(e) => { setFilters(f => ({ ...f, certification: e.target.value })); setCurrentPage(1) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">Any Certification</option>
                    <option value="ACLS">ACLS</option>
                    <option value="BLS">BLS</option>
                    <option value="PALS">PALS</option>
                    <option value="NRP">NRP</option>
                    <option value="TNCC">TNCC</option>
                    <option value="CCRN">CCRN</option>
                  </select>
                </div>
              </div>

              {/* Active Filters */}
              {activeFilters > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-wrap gap-2">
                    {filters.nursing_type && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        {formatNursingType(filters.nursing_type)}
                        <button onClick={() => { setFilters(f => ({ ...f, nursing_type: '' })); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {filters.specialty && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        {formatSpecialty(filters.specialty)}
                        <button onClick={() => { setFilters(f => ({ ...f, specialty: '' })); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {filters.employment_type && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        {formatEmploymentType(filters.employment_type)}
                        <button onClick={() => { setFilters(f => ({ ...f, employment_type: '' })); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {filters.shift_type && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        {filters.shift_type}
                        <button onClick={() => { setFilters(f => ({ ...f, shift_type: '' })); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {filters.region && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        {filters.region}
                        <button onClick={() => { setFilters(f => ({ ...f, region: '' })); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {filters.facility_system && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                        <Building2 className="w-3 h-3" />
                        {filters.facility_system}
                        <button onClick={() => { setFilters(f => ({ ...f, facility_system: '' })); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-purple-500 hover:text-purple-700" />
                        </button>
                      </span>
                    )}
                    {filters.facility_id && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                        <Building2 className="w-3 h-3" />
                        {filterOptions?.facilities?.find((f: any) => f.id === filters.facility_id)?.name || 'Facility'}
                        <button onClick={() => { setFilters(f => ({ ...f, facility_id: '' })); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-indigo-500 hover:text-indigo-700" />
                        </button>
                      </span>
                    )}
                    {filters.childcare && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm">
                        <Baby className="w-3 h-3" />
                        {filters.childcare === 'onsite' ? 'On-site childcare' : 'Childcare nearby'}
                        <button onClick={() => { setFilters(f => ({ ...f, childcare: '' })); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-pink-500 hover:text-pink-700" />
                        </button>
                      </span>
                    )}
                    {filters.ofs_grade && (
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${getGradeColor(filters.ofs_grade)}`}>
                        <Award className="w-3 h-3" />
                        Grade {filters.ofs_grade}
                        <button onClick={() => { setFilters(f => ({ ...f, ofs_grade: '' })); setCurrentPage(1) }}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {filters.posted_within_days && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
                        <Calendar className="w-3 h-3" />
                        Last {filters.posted_within_days} {parseInt(filters.posted_within_days) === 1 ? 'day' : 'days'}
                        <button onClick={() => { setFilters(f => ({ ...f, posted_within_days: '' })); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-amber-500 hover:text-amber-700" />
                        </button>
                      </span>
                    )}
                    {(filters.min_pay || filters.max_pay) && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        ${filters.min_pay || '0'} - ${filters.max_pay || '∞'}/hr
                        <button onClick={() => { setFilters(f => ({ ...f, min_pay: '', max_pay: '' })); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {filters.has_sign_on_bonus && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">
                        <Gift className="w-3 h-3" />
                        Sign-on bonus
                        <button onClick={() => { setFilters(f => ({ ...f, has_sign_on_bonus: false })); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-emerald-500 hover:text-emerald-700" />
                        </button>
                      </span>
                    )}
                    {filters.has_relocation && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                        <Truck className="w-3 h-3" />
                        Relocation
                        <button onClick={() => { setFilters(f => ({ ...f, has_relocation: false })); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-blue-500 hover:text-blue-700" />
                        </button>
                      </span>
                    )}
                    {filters.new_grad_friendly && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                        <GraduationCap className="w-3 h-3" />
                        New Grad Friendly
                        <button onClick={() => { setFilters(f => ({ ...f, new_grad_friendly: false })); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-purple-500 hover:text-purple-700" />
                        </button>
                      </span>
                    )}
                    {filters.bsn_required && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                        <GraduationCap className="w-3 h-3" />
                        {filters.bsn_required === 'yes' ? 'BSN Required' : 'ADN/ASN Accepted'}
                        <button onClick={() => { setFilters(f => ({ ...f, bsn_required: '' })); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-indigo-500 hover:text-indigo-700" />
                        </button>
                      </span>
                    )}
                    {filters.certification && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
                        <Award className="w-3 h-3" />
                        {filters.certification} Required
                        <button onClick={() => { setFilters(f => ({ ...f, certification: '' })); setCurrentPage(1) }}>
                          <X className="w-3 h-3 text-amber-500 hover:text-amber-700" />
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
      )}

      {/* For You Tab Content */}
      {activeTab === 'matched' && (
        <>
          {/* Upgrade prompt for non-paid users */}
          {!isPaidUser ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-primary-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Personalized Job Matches</h2>
                <p className="text-slate-600 mb-6">
                  Upgrade to see jobs matched specifically to your nursing specialty, certifications, and preferences.
                </p>
                <Link
                  to="/billing"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-accent-700 transition-all shadow-lg hover:shadow-xl"
                >
                  <Crown className="w-5 h-5" />
                  Upgrade to Starter - $9/mo
                </Link>
              </div>
            </div>
          ) : !hasPreferences ? (
            /* No preferences set - prompt to set them */
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Complete Your Profile</h2>
                <p className="text-slate-600 mb-6">
                  Tell us about your nursing specialty and job preferences to see personalized job matches.
                </p>
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl"
                >
                  <User className="w-5 h-5" />
                  Set Your Preferences
                </Link>
              </div>
            </div>
          ) : isLoadingMatched ? (
            /* Loading state */
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent"></div>
            </div>
          ) : matchedJobs.length === 0 ? (
            /* No matches found */
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-slate-500">No jobs found matching your preferences. Try updating your profile settings.</p>
            </div>
          ) : (
            /* Matched jobs list */
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-primary-50 to-accent-50 rounded-xl p-4 border border-primary-100">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-primary-600" />
                  <div>
                    <span className="font-medium text-primary-900">Matched based on:</span>
                    <span className="text-primary-700 ml-2">
                      {userPrefs?.specialties?.map((s: string) => formatSpecialty(s)).join(', ')}
                      {userPrefs?.employment_types?.length > 0 && userPrefs?.specialties?.length > 0 && ' • '}
                      {userPrefs?.employment_types?.map((e: string) => formatEmploymentType(e)).join(', ')}
                    </span>
                  </div>
                </div>
              </div>
              {matchedJobs.map((job: any) => (
                <div
                  key={job.id}
                  className="bg-white rounded-xl border border-slate-200 p-6 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => { setSelectedJob(job); setDrawerOpen(true); }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-primary-600 flex-1 hover:text-primary-700 hover:underline transition-colors cursor-pointer">
                          {toTitleCase(job.title)}
                        </h3>
                        {job.facility_ofs_grade && (
                          <div className="flex flex-col items-center" title="Facility Score">
                            <span className="text-[8px] text-slate-400 uppercase tracking-wider leading-tight">Score</span>
                            <span className={`px-2 py-1 text-xs font-bold rounded ${getGradeColor(job.facility_ofs_grade[0])}`}>
                              {job.facility_ofs_grade}
                            </span>
                          </div>
                        )}
                      </div>
                      {job.facility_name && (
                        <Link
                          to={`/facilities/${job.facility_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 hover:underline mb-3"
                        >
                          <Building2 className="w-4 h-4" />
                          <span className="font-medium">{toTitleCase(job.facility_name)}</span>
                        </Link>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        {(job.facility_city || job.city) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {job.facility_city || job.city}, {job.state}
                          </span>
                        )}
                        {job.shift_type && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {job.shift_type}
                          </span>
                        )}
                        {(job.pay_min || job.pay_max) && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            {job.pay_min && job.pay_max
                              ? `$${job.pay_min.toLocaleString()} - $${job.pay_max.toLocaleString()}`
                              : job.pay_min
                                ? `From $${job.pay_min.toLocaleString()}`
                                : `Up to $${job.pay_max.toLocaleString()}`
                            }
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {job.nursing_type && (
                        <span className="px-3 py-1 bg-primary-50 text-primary-700 text-sm rounded-full">
                          {formatNursingType(job.nursing_type)}
                        </span>
                      )}
                      {job.specialty && (
                        <span className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full">
                          {formatSpecialty(job.specialty)}
                        </span>
                      )}
                      {job.employment_type && (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-sm rounded-full">
                          {formatEmploymentType(job.employment_type)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Results - All Jobs Tab */}
      {activeTab === 'all' && (
      isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent"></div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No jobs found matching your criteria.</p>
        </div>
      ) : (
        <div className="space-y-4" ref={jobsContainerRef}>
          {jobs.map((job: any, index: number) => {
            const pageNum = Math.floor(index / limit) + 1
            const isFirstOfPage = index % limit === 0
            return (
              <div
                key={job.id}
                ref={isFirstOfPage ? (el) => { if (el) pageRefs.current.set(pageNum, el) } : undefined}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => { setSelectedJob(job); setDrawerOpen(true); }}
              >
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-primary-600 flex-1 hover:text-primary-700 hover:underline transition-colors cursor-pointer">
                      {toTitleCase(job.title)}
                    </h3>
                    {/* Facility Score Badge - Paid feature: blurred for free users */}
                    {job.facility_ofs_grade && (
                      isPaidUser ? (
                        <div className="flex flex-col items-center" title="Facility Score (10 indices)">
                          <span className="text-[8px] text-slate-400 uppercase tracking-wider leading-tight">Facility Score</span>
                          <span className={`px-2 py-1 text-xs font-bold rounded ${getGradeColor(job.facility_ofs_grade[0])}`} title={`OFS: ${job.facility_ofs_score}/100`}>
                            {job.facility_ofs_grade}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center group/score relative">
                          <span className="text-[8px] text-slate-400 uppercase tracking-wider leading-tight">Facility Score</span>
                          <span className="relative px-2 py-1 text-xs font-bold rounded bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors">
                            <span className="blur-sm select-none text-slate-400">A+</span>
                            <Lock className="absolute inset-0 m-auto w-3 h-3 text-slate-400" />
                          </span>
                          {/* Tooltip */}
                          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 opacity-0 group-hover/score:opacity-100 transition-opacity pointer-events-none z-20">
                            <Link
                              to="/billing"
                              onClick={(e) => e.stopPropagation()}
                              className="pointer-events-auto whitespace-nowrap px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg shadow-lg flex items-center gap-1"
                            >
                              <Crown className="w-3 h-3 text-amber-400" />
                              Upgrade
                            </Link>
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45" />
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  {job.facility_name && (
                    <Link
                      to={`/facilities/${job.facility_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-primary-600 hover:text-primary-700 hover:underline mb-3"
                    >
                      <Building2 className="w-4 h-4" />
                      <span className="font-medium">{toTitleCase(job.facility_name)}</span>
                      {job.facility_system && (
                        <span className="text-slate-400">• {toTitleCase(job.facility_system)}</span>
                      )}
                    </Link>
                  )}

                  <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    {(job.facility_city || job.city) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.facility_city || job.city}, {job.state}
                        {job.distance_miles != null && (
                          <span className="text-primary-600 font-medium ml-1">
                            • {job.distance_miles < 1 ? '< 1' : Math.round(job.distance_miles)} mi
                          </span>
                        )}
                      </span>
                    )}
                    {job.shift_type && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {job.shift_type}
                        {job.shift_hours && ` (${job.shift_hours})`}
                      </span>
                    )}
                    {/* Job Pay (from posting) */}
                    {(job.pay_min || job.pay_max) && (
                      isPaidUser ? (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          {job.pay_min && job.pay_max
                            ? `$${job.pay_min.toLocaleString()} - $${job.pay_max.toLocaleString()}`
                            : job.pay_min
                              ? `From $${job.pay_min.toLocaleString()}`
                              : `Up to $${job.pay_max.toLocaleString()}`
                          }
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-400 group/pay relative">
                          <DollarSign className="w-4 h-4" />
                          <span className="blur-sm select-none">$65,000 - $95,000</span>
                          <Lock className="w-3 h-3 text-slate-300 ml-1" />
                          <span className="text-xs text-primary-500 font-medium ml-1 italic">Know your worth</span>
                          <div className="absolute -bottom-10 left-0 opacity-0 group-hover/pay:opacity-100 transition-opacity pointer-events-none z-20">
                            <Link
                              to="/billing"
                              onClick={(e) => e.stopPropagation()}
                              className="pointer-events-auto whitespace-nowrap px-2.5 py-1.5 bg-gradient-to-r from-primary-600 to-accent-600 text-white text-xs rounded-lg shadow-lg flex items-center gap-1"
                            >
                              <Crown className="w-3 h-3 text-amber-300" />
                              See salary data
                            </Link>
                          </div>
                        </span>
                      )
                    )}
                    {/* Market Rate (always show if available, in addition to job pay) */}
                    {job.market_rate && (
                      isPaidUser ? (
                        <span className="flex items-center gap-1 text-emerald-600" title={`Market rate for ${job.market_rate.area}`}>
                          <TrendingUp className="w-4 h-4" />
                          <span>Market: ${job.market_rate.min}-${job.market_rate.max}/hr</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-400 group/market relative">
                          <TrendingUp className="w-4 h-4" />
                          <span>Market Rate:</span>
                          <span className="blur-sm select-none">$32-$45/hr</span>
                          <Lock className="w-3 h-3 text-slate-300 ml-1" />
                        </span>
                      )
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {job.nursing_type && (
                    <span className="px-3 py-1 bg-primary-50 text-primary-700 text-sm rounded-full">
                      {formatNursingType(job.nursing_type)}
                    </span>
                  )}
                  {job.specialty && (
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full">
                      {formatSpecialty(job.specialty)}
                    </span>
                  )}
                  {job.employment_type && (
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-sm rounded-full">
                      {formatEmploymentType(job.employment_type)}
                    </span>
                  )}
                  {/* Enrichment Tags */}
                  {(job.bonus_from_enrichment || job.sign_on_bonus) && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full flex items-center gap-1">
                      <Gift className="w-3 h-3" />
                      Bonus
                    </span>
                  )}
                  {job.experience_req && /new.?grad|entry.?level|0.year|graduate nurse|residency/i.test(job.experience_req) && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full flex items-center gap-1">
                      <GraduationCap className="w-3 h-3" />
                      New Grad
                    </span>
                  )}
                  {job.education_req && /BSN.*(required|preferred|must)/i.test(job.education_req) && (
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-full">
                      BSN
                    </span>
                  )}
                  {job.education_req && /(ADN|ASN|Associate).*(accepted|ok|considered)/i.test(job.education_req) && (
                    <span className="px-3 py-1 bg-teal-100 text-teal-700 text-sm rounded-full">
                      ADN OK
                    </span>
                  )}
                  {job.certifications_req && /ACLS/i.test(job.certifications_req) && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                      ACLS
                    </span>
                  )}
                  {job.certifications_req && /BLS/i.test(job.certifications_req) && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                      BLS
                    </span>
                  )}
                  {job.certifications_req && /PALS/i.test(job.certifications_req) && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                      PALS
                    </span>
                  )}
                </div>
              </div>
            </div>
          )})
          }

          {/* Load more trigger for infinite scroll */}
          <div ref={loadMoreRef} className="py-4">
            {isFetchingNextPage && (
              <div className="flex items-center justify-center gap-2 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading more jobs...</span>
              </div>
            )}
            {!hasNextPage && jobs.length > 0 && (
              <p className="text-center text-slate-400 text-sm">
                You've seen all {total.toLocaleString()} jobs
              </p>
            )}
          </div>
        </div>
      )
      )}

      {/* Job Preview Drawer */}
      <JobPreviewDrawer
        job={selectedJob}
        isOpen={drawerOpen}
        onClose={closeDrawer}
      />

      {/* Floating Page Indicator with Navigation */}
      {totalPages > 1 && jobs.length > 0 && (
        <div className="fixed bottom-24 right-6 z-40 flex flex-col items-end gap-2">
          {/* Back to top button */}
          {currentPage > 1 && (
            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' })
                setCurrentPage(1)
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-white shadow-lg rounded-lg border border-slate-200 hover:bg-slate-50 text-sm text-slate-600"
            >
              <ChevronUp className="w-4 h-4" />
              Back to top
            </button>
          )}
          {/* Page indicator */}
          <div className="flex items-center gap-2 bg-white shadow-lg rounded-lg border border-slate-200 px-3 py-2">
            <button
              onClick={() => goToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-slate-700 min-w-[80px] text-center">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => {
                if (currentPage < (data?.pages.length || 0)) {
                  goToPage(currentPage + 1)
                } else if (hasNextPage) {
                  fetchNextPage()
                }
              }}
              disabled={currentPage >= totalPages}
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
