import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { Search, MapPin, Clock, DollarSign, Building2, ChevronLeft, ChevronRight, SlidersHorizontal, X, Gift, Truck, Award, Calendar, Lock, Crown, RefreshCw, Sparkles, Heart, TrendingUp, Eye } from 'lucide-react'
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
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    nursing_type: '',
    specialty: '',
    employment_type: '',
    shift_type: '',
    region: '',
    facility_system: '',
    ofs_grade: '',
    posted_within_days: '',
    min_pay: '',
    max_pay: '',
    has_sign_on_bonus: false,
    has_relocation: false,
    pay_disclosed_only: false,
  })
  const [page, setPage] = useState(0)
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const limit = 20

  const { data: filterOptions } = useQuery({
    queryKey: ['filters'],
    queryFn: () => api.get('/api/filters').then(res => res.data.data)
  })

  // Count active filters (excluding empty strings and false booleans)
  const activeFilters = Object.entries(filters).filter(([_, v]) => v && v !== '').length

  const clearAllFilters = () => {
    setFilters({
      nursing_type: '',
      specialty: '',
      employment_type: '',
      shift_type: '',
      region: '',
      facility_system: '',
      ofs_grade: '',
      posted_within_days: '',
      min_pay: '',
      max_pay: '',
      has_sign_on_bonus: false,
      has_relocation: false,
      pay_disclosed_only: false,
    })
    setSearch('')
    setPage(0)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', search, filters, page],
    queryFn: () => api.get('/api/jobs', {
      params: {
        search: search || undefined,
        nursing_type: filters.nursing_type || undefined,
        specialty: filters.specialty || undefined,
        employment_type: filters.employment_type || undefined,
        shift_type: filters.shift_type || undefined,
        region: filters.region || undefined,
        facility_system: filters.facility_system || undefined,
        ofs_grade: filters.ofs_grade || undefined,
        posted_within_days: filters.posted_within_days ? parseInt(filters.posted_within_days) : undefined,
        min_pay: filters.min_pay ? parseInt(filters.min_pay) : undefined,
        max_pay: filters.max_pay ? parseInt(filters.max_pay) : undefined,
        has_sign_on_bonus: filters.has_sign_on_bonus || undefined,
        has_relocation: filters.has_relocation || undefined,
        pay_disclosed_only: filters.pay_disclosed_only || undefined,
        limit,
        offset: page * limit
      }
    }).then(res => res.data)
  })

  // Get top 3 facilities for free score visibility
  const { data: topFacilities } = useQuery({
    queryKey: ['top-facilities-for-free'],
    queryFn: () => api.get('/api/facilities', { params: { limit: 3 } }).then(res => res.data.data)
  })

  // Set of top 3 facility IDs - free users can see scores for these
  const top3FacilityIds = new Set((topFacilities || []).map((f: any) => f.id))

  const jobs = data?.data || []
  const total = data?.total || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Nursing Jobs</h1>
          <p className="text-slate-600">
            {total.toLocaleString()} jobs available across Virginia
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

      {/* Search and Filters */}
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
                onChange={(e) => { setSearch(e.target.value); setPage(0) }}
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
                    onChange={(e) => { setFilters(f => ({ ...f, nursing_type: e.target.value })); setPage(0) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Types</option>
                    {filterOptions?.nursing_types?.map((t: string) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Specialty</label>
                  <select
                    value={filters.specialty}
                    onChange={(e) => { setFilters(f => ({ ...f, specialty: e.target.value })); setPage(0) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Specialties</option>
                    {filterOptions?.specialties?.map((s: string) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Employment</label>
                  <select
                    value={filters.employment_type}
                    onChange={(e) => { setFilters(f => ({ ...f, employment_type: e.target.value })); setPage(0) }}
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
                    onChange={(e) => { setFilters(f => ({ ...f, shift_type: e.target.value })); setPage(0) }}
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
                    onChange={(e) => { setFilters(f => ({ ...f, region: e.target.value })); setPage(0) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Regions</option>
                    {filterOptions?.regions?.map((r: string) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: New filters - Health System, OFS Grade, Posted */}
              <div className="flex flex-wrap gap-4 mb-4 pt-4 border-t border-slate-100">
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Health System</label>
                  <select
                    value={filters.facility_system}
                    onChange={(e) => { setFilters(f => ({ ...f, facility_system: e.target.value })); setPage(0) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Systems</option>
                    {filterOptions?.facility_systems?.map((s: string) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Facility Grade</label>
                  <select
                    value={filters.ofs_grade}
                    onChange={(e) => { setFilters(f => ({ ...f, ofs_grade: e.target.value })); setPage(0) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Grades</option>
                    {filterOptions?.ofs_grades?.map((g: string) => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Posted</label>
                  <select
                    value={filters.posted_within_days}
                    onChange={(e) => { setFilters(f => ({ ...f, posted_within_days: e.target.value })); setPage(0) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">Any Time</option>
                    {filterOptions?.posted_within_options?.map((o: { value: number, label: string }) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Pay Range and Checkboxes */}
              <div className="flex flex-wrap items-end gap-4 pt-4 border-t border-slate-100">
                <div className="flex items-end gap-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Min Pay ($/hr)</label>
                    <input
                      type="number"
                      placeholder="25"
                      value={filters.min_pay}
                      onChange={(e) => { setFilters(f => ({ ...f, min_pay: e.target.value })); setPage(0) }}
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
                      onChange={(e) => { setFilters(f => ({ ...f, max_pay: e.target.value })); setPage(0) }}
                      className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.pay_disclosed_only}
                    onChange={(e) => { setFilters(f => ({ ...f, pay_disclosed_only: e.target.checked })); setPage(0) }}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700">Pay disclosed only</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.has_sign_on_bonus}
                    onChange={(e) => { setFilters(f => ({ ...f, has_sign_on_bonus: e.target.checked })); setPage(0) }}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <Gift className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm text-slate-700">Sign-on bonus</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.has_relocation}
                    onChange={(e) => { setFilters(f => ({ ...f, has_relocation: e.target.checked })); setPage(0) }}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <Truck className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-slate-700">Relocation assistance</span>
                </label>
              </div>

              {/* Active Filters */}
              {activeFilters > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-wrap gap-2">
                    {filters.nursing_type && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        {filters.nursing_type}
                        <button onClick={() => { setFilters(f => ({ ...f, nursing_type: '' })); setPage(0) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {filters.specialty && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        {filters.specialty}
                        <button onClick={() => { setFilters(f => ({ ...f, specialty: '' })); setPage(0) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {filters.employment_type && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        {formatEmploymentType(filters.employment_type)}
                        <button onClick={() => { setFilters(f => ({ ...f, employment_type: '' })); setPage(0) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {filters.shift_type && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        {filters.shift_type}
                        <button onClick={() => { setFilters(f => ({ ...f, shift_type: '' })); setPage(0) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {filters.region && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        {filters.region}
                        <button onClick={() => { setFilters(f => ({ ...f, region: '' })); setPage(0) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {filters.facility_system && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                        <Building2 className="w-3 h-3" />
                        {filters.facility_system}
                        <button onClick={() => { setFilters(f => ({ ...f, facility_system: '' })); setPage(0) }}>
                          <X className="w-3 h-3 text-purple-500 hover:text-purple-700" />
                        </button>
                      </span>
                    )}
                    {filters.ofs_grade && (
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${getGradeColor(filters.ofs_grade)}`}>
                        <Award className="w-3 h-3" />
                        Grade {filters.ofs_grade}
                        <button onClick={() => { setFilters(f => ({ ...f, ofs_grade: '' })); setPage(0) }}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {filters.posted_within_days && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
                        <Calendar className="w-3 h-3" />
                        Last {filters.posted_within_days} {parseInt(filters.posted_within_days) === 1 ? 'day' : 'days'}
                        <button onClick={() => { setFilters(f => ({ ...f, posted_within_days: '' })); setPage(0) }}>
                          <X className="w-3 h-3 text-amber-500 hover:text-amber-700" />
                        </button>
                      </span>
                    )}
                    {(filters.min_pay || filters.max_pay) && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        ${filters.min_pay || '0'} - ${filters.max_pay || '∞'}/hr
                        <button onClick={() => { setFilters(f => ({ ...f, min_pay: '', max_pay: '' })); setPage(0) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {filters.has_sign_on_bonus && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">
                        <Gift className="w-3 h-3" />
                        Sign-on bonus
                        <button onClick={() => { setFilters(f => ({ ...f, has_sign_on_bonus: false })); setPage(0) }}>
                          <X className="w-3 h-3 text-emerald-500 hover:text-emerald-700" />
                        </button>
                      </span>
                    )}
                    {filters.has_relocation && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                        <Truck className="w-3 h-3" />
                        Relocation
                        <button onClick={() => { setFilters(f => ({ ...f, has_relocation: false })); setPage(0) }}>
                          <X className="w-3 h-3 text-blue-500 hover:text-blue-700" />
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

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent"></div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No jobs found matching your criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job: any) => (
            <div
              key={job.id}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
              onClick={() => { setSelectedJob(job); setDrawerOpen(true); }}
            >
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900 flex-1 hover:text-primary-600 transition-colors">
                      {toTitleCase(job.title)}
                    </h3>
                    {/* Facility Score Badge - Show for paid users OR if facility is in top 3 */}
                    {job.facility_ofs_grade && (() => {
                      const canSeeThisGrade = isPaidUser || top3FacilityIds.has(job.facility_id)
                      return canSeeThisGrade ? (
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
                    })()}
                  </div>

                  {job.facility_name && (
                    <div className="flex items-center gap-2 text-primary-600 mb-3">
                      <Building2 className="w-4 h-4" />
                      <span className="font-medium">{toTitleCase(job.facility_name)}</span>
                      {job.facility_system && (
                        <span className="text-slate-400">• {toTitleCase(job.facility_system)}</span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    {job.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.city}, {job.state}
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
                          <span className="blur-sm select-none">Market: $32-$45/hr</span>
                          <Lock className="w-3 h-3 text-slate-300 ml-1" />
                        </span>
                      )
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {job.nursing_type && (
                    <span className="px-3 py-1 bg-primary-50 text-primary-700 text-sm rounded-full">
                      {job.nursing_type}
                    </span>
                  )}
                  {job.specialty && (
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full">
                      {job.specialty}
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

      {/* Job Preview Drawer */}
      <JobPreviewDrawer
        job={selectedJob}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {page + 1} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={(page + 1) * limit >= total}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg disabled:opacity-50"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
