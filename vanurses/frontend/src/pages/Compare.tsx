import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { Search, X, Trophy, ArrowLeft } from 'lucide-react'
import { api } from '../api/client'
import IndexRadar from '../components/scoring/IndexRadar'
import { useSubscription, isAdminUnlocked } from '../hooks/useSubscription'
import BlurOverlay from '../components/BlurOverlay'

interface Facility {
  id: string
  name: string
  city: string
  state: string
  system_name: string
  score: {
    ofs_score: number
    ofs_grade: string
    indices: Record<string, { score: number | null; weighted: number; weight_pct: number; name: string }>
  } | null
  job_count: number
}

function getGradeColor(grade: string | null | undefined) {
  const baseGrade = grade?.[0]?.toUpperCase() || ''
  switch (baseGrade) {
    case 'A': return 'bg-emerald-500 text-white'
    case 'B': return 'bg-sky-500 text-white'
    case 'C': return 'bg-amber-500 text-white'
    case 'D': return 'bg-orange-500 text-white'
    case 'F': return 'bg-red-500 text-white'
    default: return 'bg-slate-200 text-slate-600'
  }
}

function getScoreColor(score: number | null) {
  if (score === null) return 'text-slate-400'
  if (score >= 80) return 'text-emerald-600 font-bold'
  if (score >= 60) return 'text-sky-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}

export default function Compare() {
  const auth = useAuth()
  const { isPaid } = useSubscription()
  // Only show content if authenticated AND paid
  const canAccessFeature = (auth.isAuthenticated && isPaid) || isAdminUnlocked()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  // Sample data for blur preview
  const sampleFacilities = [
    { id: '1', name: 'Inova Fairfax Hospital', city: 'Falls Church', grade: 'A', score: 92, jobs: 47 },
    { id: '2', name: 'VCU Medical Center', city: 'Richmond', grade: 'A-', score: 88, jobs: 35 },
    { id: '3', name: 'Sentara Norfolk General', city: 'Norfolk', grade: 'B+', score: 85, jobs: 28 },
  ]
  const sampleIndices = [
    { name: 'Pay Competitiveness', scores: [88, 82, 79] },
    { name: 'Employee Reviews', scores: [91, 85, 88] },
    { name: 'Location Safety', scores: [94, 78, 82] },
    { name: 'Patient Experience', scores: [89, 92, 84] },
    { name: 'Facility Stats', scores: [93, 90, 86] },
    { name: 'Amenities & Lifestyle', scores: [86, 88, 81] },
    { name: 'Job Transparency', scores: [95, 84, 89] },
    { name: 'Commute Stress', scores: [78, 85, 80] },
    { name: 'Quality of Life', scores: [92, 86, 83] },
    { name: 'Climate Comfort', scores: [85, 85, 85] },
  ]

  // If user is not paid, show blur overlay over entire page
  if (!canAccessFeature) {
    return (
      <BlurOverlay
        title="Facility Comparison"
        description="Compare facilities side-by-side with detailed OFS scores and indices. Upgrade to access this premium feature."
        showDemo
        demoKey="compare"
        showPricing
        blurIntensity="light"
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="text-slate-400">
              <ArrowLeft className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-3xl text-slate-900">Compare Facilities</h1>
              <p className="text-slate-600">Side-by-side comparison of up to 5 facilities</p>
            </div>
          </div>

          {/* Add button */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 text-center">
              + Add Facility to Compare (3/5)
            </div>
          </div>

          {/* Selected pills */}
          <div className="flex flex-wrap gap-2">
            {sampleFacilities.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-sm">
                {f.name}
                <X className="w-4 h-4" />
              </span>
            ))}
          </div>

          {/* Comparison Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-500 bg-slate-50 w-40">Index</th>
                    {sampleFacilities.map((f) => (
                      <th key={f.id} className="px-4 py-3 text-center min-w-[150px]">
                        <span className="text-primary-600">{f.name}</span>
                        <div className="text-xs text-slate-400 mt-1">{f.city}, VA</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* OFS Overall */}
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">Overall OFS</td>
                    {sampleFacilities.map((f, i) => (
                      <td key={f.id} className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${getGradeColor(f.grade)}`}>
                          {f.grade}
                          <span className="text-sm opacity-80">{f.score}</span>
                          {i === 0 && <Trophy className="w-4 h-4 text-amber-300" />}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Each Index */}
                  {sampleIndices.map((idx, idxNum) => (
                    <tr key={idx.name} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-slate-700">{idx.name}</td>
                      {idx.scores.map((score, i) => {
                        const isBest = score === Math.max(...idx.scores)
                        return (
                          <td key={i} className="px-4 py-3 text-center">
                            <span className={score >= 80 ? 'text-emerald-600 font-bold' : score >= 60 ? 'text-sky-600' : 'text-amber-600'}>
                              {score}
                              {isBest && <Trophy className="inline w-4 h-4 ml-1 text-amber-500" />}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}

                  {/* Job Count */}
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">Open Jobs</td>
                    {sampleFacilities.map((f) => (
                      <td key={f.id} className="px-4 py-3 text-center font-medium text-primary-600">
                        {f.jobs}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </BlurOverlay>
    )
  }

  // Search facilities
  const { data: searchResults } = useQuery({
    queryKey: ['facility-search', searchTerm],
    queryFn: () => api.get('/api/facilities', { params: { search: searchTerm, limit: 10 } }).then(res => res.data.data),
    enabled: searchTerm.length > 2
  })

  // Get comparison data
  const { data: compareData } = useQuery({
    queryKey: ['compare', selectedIds],
    queryFn: () => api.get('/api/facilities/compare', { params: { ids: selectedIds.join(',') } }).then(res => res.data.data),
    enabled: selectedIds.length > 0
  })

  const facilities: Facility[] = compareData?.facilities || []
  const bestIn = compareData?.best_in || {}

  const addFacility = (id: string) => {
    if (selectedIds.length < 5 && !selectedIds.includes(id)) {
      setSelectedIds([...selectedIds, id])
      setSearchTerm('')
      setShowSearch(false)
    }
  }

  const removeFacility = (id: string) => {
    setSelectedIds(selectedIds.filter(i => i !== id))
  }

  // All index keys for table
  const indexKeys = ['pci', 'eri', 'lssi', 'pei', 'fsi', 'ali', 'jti', 'csi', 'qli', 'cci']

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/facilities" className="text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl text-slate-900">Compare Facilities</h1>
          <p className="text-slate-600">Side-by-side comparison of up to 5 facilities</p>
        </div>
      </div>

      {/* Add Facility Button */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        {!showSearch ? (
          <button
            onClick={() => setShowSearch(true)}
            disabled={selectedIds.length >= 5}
            className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-primary-400 hover:text-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Facility to Compare ({selectedIds.length}/5)
          </button>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search facilities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={() => { setShowSearch(false); setSearchTerm('') }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Search Results */}
            {searchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                {searchResults.map((f: Facility) => (
                  <button
                    key={f.id}
                    onClick={() => addFacility(f.id)}
                    disabled={selectedIds.includes(f.id)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 disabled:opacity-50 disabled:bg-slate-100 border-b border-slate-100 last:border-0"
                  >
                    <div className="font-medium text-slate-900">{f.name}</div>
                    <div className="text-sm text-slate-500">{f.city}, {f.state} - {f.system_name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Facilities Pills */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {facilities.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full">
              {f.name}
              <button onClick={() => removeFacility(f.id)} className="hover:text-primary-900">
                <X className="w-4 h-4" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Comparison Table */}
      {facilities.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500 bg-slate-50 w-40">Index</th>
                  {facilities.map((f) => (
                    <th key={f.id} className="px-4 py-3 text-center min-w-[150px]">
                      <Link to={`/facilities/${f.id}`} className="text-primary-600 hover:underline">
                        {f.name}
                      </Link>
                      <div className="text-xs text-slate-400 mt-1">{f.city}, {f.state}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* OFS Overall */}
                <tr className="border-b border-slate-100 bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">Overall OFS</td>
                  {facilities.map((f) => (
                    <td key={f.id} className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${getGradeColor(f.score?.ofs_grade)}`}>
                        {f.score?.ofs_grade || 'N/A'}
                        <span className="text-sm opacity-80">{f.score?.ofs_score || '-'}</span>
                        {bestIn.overall === f.id && <Trophy className="w-4 h-4 text-amber-300" />}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Each Index */}
                {indexKeys.map((key) => {
                  const indexName = facilities[0]?.score?.indices?.[key]?.name || key.toUpperCase()
                  return (
                    <tr key={key} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-slate-700">{indexName}</td>
                      {facilities.map((f) => {
                        const idx = f.score?.indices?.[key]
                        const isBest = bestIn[key] === f.id
                        return (
                          <td key={f.id} className="px-4 py-3 text-center">
                            <span className={`${getScoreColor(idx?.score ?? null)}`}>
                              {idx?.score ?? '-'}
                              {isBest && <Trophy className="inline w-4 h-4 ml-1 text-amber-500" />}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}

                {/* Job Count */}
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">Open Jobs</td>
                  {facilities.map((f) => (
                    <td key={f.id} className="px-4 py-3 text-center font-medium text-primary-600">
                      {f.job_count}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Radar Chart Comparison */}
      {facilities.length >= 2 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Visual Comparison</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {facilities.slice(0, 3).map((f) => (
              <div key={f.id} className="text-center">
                <h4 className="font-medium text-slate-700 mb-2">{f.name}</h4>
                {f.score?.indices && <IndexRadar indices={f.score.indices} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedIds.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-slate-400 mb-4">
            <Search className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-xl font-medium text-slate-900 mb-2">No facilities selected</h3>
          <p className="text-slate-500">Add facilities above to start comparing their scores</p>
        </div>
      )}
    </div>
  )
}
