import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, MapPin, Building2, Briefcase, Star, ChevronLeft, ChevronRight, Filter, X, SlidersHorizontal } from 'lucide-react'
import { api } from '../api/client'
import { toTitleCase } from '../utils/format'

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

// Index descriptions for tooltips
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
  cci: { name: 'Climate', desc: 'Climate Comfort - Weather patterns' },
}

export default function Facilities() {
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')
  const [system, setSystem] = useState('')
  const [minGrade, setMinGrade] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(0)
  const limit = 20

  const { data: regions } = useQuery({
    queryKey: ['regions'],
    queryFn: () => api.get('/api/facilities/regions').then(res => res.data.data)
  })

  const { data: systems } = useQuery({
    queryKey: ['systems'],
    queryFn: () => api.get('/api/facilities/systems').then(res => res.data.data)
  })

  const activeFilters = [region, system, minGrade].filter(Boolean).length

  const clearAllFilters = () => {
    setRegion('')
    setSystem('')
    setMinGrade('')
    setSearch('')
    setPage(0)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['facilities', search, region, system, minGrade, page],
    queryFn: () => api.get('/api/facilities', {
      params: {
        search: search || undefined,
        region: region || undefined,
        system: system || undefined,
        min_grade: minGrade || undefined,
        limit,
        offset: page * limit
      }
    }).then(res => res.data)
  })

  const facilities = data?.data || []
  const total = data?.total || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Facility Rankings</h1>
        <p className="text-slate-600">
          {total} healthcare facilities rated with our 10-index OFS scoring system
        </p>
      </div>

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
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
                  <select
                    value={region}
                    onChange={(e) => { setRegion(e.target.value); setPage(0) }}
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
                    onChange={(e) => { setSystem(e.target.value); setPage(0) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Systems</option>
                    {systems?.map((s: string) => (
                      <option key={s} value={s}>{toTitleCase(s)}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[180px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Minimum Grade</label>
                  <select
                    value={minGrade}
                    onChange={(e) => { setMinGrade(e.target.value); setPage(0) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">Any Grade</option>
                    <option value="A">A or better (90+)</option>
                    <option value="B">B or better (80+)</option>
                    <option value="C">C or better (70+)</option>
                    <option value="D">D or better (60+)</option>
                  </select>
                </div>
              </div>

              {activeFilters > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-wrap gap-2">
                    {region && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        {region}
                        <button onClick={() => { setRegion(''); setPage(0) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {system && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        {toTitleCase(system)}
                        <button onClick={() => { setSystem(''); setPage(0) }}>
                          <X className="w-3 h-3 text-slate-500 hover:text-slate-700" />
                        </button>
                      </span>
                    )}
                    {minGrade && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-sm">
                        Grade {minGrade}+
                        <button onClick={() => { setMinGrade(''); setPage(0) }}>
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
      ) : facilities.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No facilities found matching your criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {facilities.map((facility: any) => (
            <Link
              key={facility.id}
              to={`/facilities/${facility.id}`}
              className="block bg-white rounded-xl border border-slate-200 p-6 hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-6">
                {/* Score */}
                <div className="flex-shrink-0">
                  {facility.score ? (
                    <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center text-white ${getGradeColor(facility.score.ofs_grade)}`}>
                      <span className="text-2xl font-bold">{facility.score.ofs_grade}</span>
                      <span className="text-xs opacity-80">{Math.round(facility.score.ofs_score)}</span>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center">
                      <span className="text-slate-400 text-sm">N/A</span>
                    </div>
                  )}
                </div>

                {/* Info */}
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

                  {/* Score breakdown - show top indices with descriptive names */}
                  {facility.score?.indices && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(facility.score.indices)
                        .filter(([, idx]: [string, any]) => idx.score !== null)
                        .sort(([, a]: [string, any], [, b]: [string, any]) => b.weight_pct - a.weight_pct)
                        .slice(0, 6) // Show top 6 indices
                        .map(([key, idx]: [string, any]) => {
                          const info = INDEX_INFO[key]
                          return (
                            <span
                              key={key}
                              title={info?.desc || idx.name}
                              className={`px-2 py-1 rounded text-xs font-medium cursor-help ${
                                idx.score >= 80 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                idx.score >= 60 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                'bg-red-100 text-red-700 border border-red-200'
                              }`}
                            >
                              {info?.name || key.toUpperCase()}: {idx.score}
                            </span>
                          )
                        })
                      }
                      {Object.entries(facility.score.indices).filter(([, idx]: [string, any]) => idx.score !== null).length > 6 && (
                        <span className="px-2 py-1 rounded text-xs text-slate-500 bg-slate-100">
                          +{Object.entries(facility.score.indices).filter(([, idx]: [string, any]) => idx.score !== null).length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

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
