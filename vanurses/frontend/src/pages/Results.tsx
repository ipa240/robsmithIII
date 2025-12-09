import { useAuth } from 'react-oidc-context'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  MapPin, DollarSign, Building2, Heart, Lock,
  Briefcase, Filter, ChevronDown, ChevronUp
} from 'lucide-react'
import { api, setAuthToken } from '../api/client'

// OFS Index definitions for display
const OFS_LABELS: Record<string, string> = {
  pci: 'Pay',
  ali: 'Amenities',
  csi: 'Commute',
  cci: 'Climate',
  lssi: 'Safety',
  qli: 'Quality of Life',
  pei: 'Patient Exp',
  fsi: 'Facility'
}

interface FacilityScore {
  ofs_score: number
  ofs_grade: string
  pci_score?: number
  ali_score?: number
  csi_score?: number
  cci_score?: number
  lssi_score?: number
  qli_score?: number
  pei_score?: number
  fsi_score?: number
}

interface Job {
  id: string
  title: string
  nursing_type: string
  specialty: string
  employment_type: string
  shift_type: string
  city: string
  state: string
  pay_min: number
  pay_max: number
  facility_id: string
  facility_name: string
  facility_score?: FacilityScore
  your_score?: number
  match_breakdown?: Record<string, number>
}

function calculatePersonalizedScore(
  facilityScore: FacilityScore | undefined,
  priorities: Record<string, number>
): { score: number; breakdown: Record<string, number> } {
  if (!facilityScore) return { score: 0, breakdown: {} }

  const indexMap: Record<string, keyof FacilityScore> = {
    pci: 'pci_score',
    ali: 'ali_score',
    csi: 'csi_score',
    cci: 'cci_score',
    lssi: 'lssi_score',
    qli: 'qli_score',
    pei: 'pei_score',
    fsi: 'fsi_score'
  }

  let totalWeight = 0
  let weightedSum = 0
  const breakdown: Record<string, number> = {}

  for (const [code, scoreKey] of Object.entries(indexMap)) {
    const priority = priorities[code] || 3
    const score = (facilityScore[scoreKey] as number) || 50

    // Priority is 1-5, we use it as weight
    totalWeight += priority
    weightedSum += score * priority
    breakdown[code] = Math.round(score * (priority / 3)) // Normalized contribution
  }

  const finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0
  return { score: Math.round(finalScore), breakdown }
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A+': case 'A': return 'bg-emerald-500'
    case 'A-': case 'B+': return 'bg-green-500'
    case 'B': case 'B-': return 'bg-lime-500'
    case 'C+': case 'C': return 'bg-yellow-500'
    case 'C-': case 'D+': return 'bg-orange-500'
    default: return 'bg-red-500'
  }
}

function getScoreGrade(score: number): string {
  if (score >= 90) return 'A+'
  if (score >= 85) return 'A'
  if (score >= 80) return 'A-'
  if (score >= 75) return 'B+'
  if (score >= 70) return 'B'
  if (score >= 65) return 'B-'
  if (score >= 60) return 'C+'
  if (score >= 55) return 'C'
  if (score >= 50) return 'C-'
  if (score >= 45) return 'D+'
  if (score >= 40) return 'D'
  return 'F'
}

export default function Results() {
  const auth = useAuth()
  const [sortBy, setSortBy] = useState<'your_score' | 'ofs_score' | 'pay'>('your_score')
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [filterSpecialty, setFilterSpecialty] = useState<string>('')

  useEffect(() => {
    if (auth.user?.access_token) {
      setAuthToken(auth.user.access_token)
    }
  }, [auth.user?.access_token])

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/api/me').then(res => res.data.data),
    enabled: !!auth.user?.access_token
  })

  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => api.get('/api/me/preferences').then(res => res.data.data),
    enabled: !!auth.user?.access_token
  })

  const { data: matchedJobs, isLoading } = useQuery({
    queryKey: ['matched-jobs', preferences?.specialties, preferences?.employment_types],
    queryFn: () => api.get('/api/jobs/matched', {
      params: {
        specialties: preferences?.specialties?.join(','),
        employment_types: preferences?.employment_types?.join(','),
        limit: 50
      }
    }).then(res => res.data.data),
    enabled: !!preferences
  })

  const tier = user?.subscription_tier || 'free'
  const isPaid = tier !== 'free'

  // Calculate personalized scores for each job
  const jobsWithScores = (matchedJobs || []).map((job: Job) => {
    const { score, breakdown } = calculatePersonalizedScore(
      job.facility_score,
      preferences?.index_priorities || {}
    )
    return {
      ...job,
      your_score: score,
      match_breakdown: breakdown
    }
  })

  // Sort jobs
  const sortedJobs = [...jobsWithScores].sort((a, b) => {
    if (sortBy === 'your_score') return (b.your_score || 0) - (a.your_score || 0)
    if (sortBy === 'ofs_score') return (b.facility_score?.ofs_score || 0) - (a.facility_score?.ofs_score || 0)
    if (sortBy === 'pay') return (b.pay_max || 0) - (a.pay_max || 0)
    return 0
  })

  // Filter by specialty if set
  const filteredJobs = filterSpecialty
    ? sortedJobs.filter(j => j.specialty?.toLowerCase().includes(filterSpecialty.toLowerCase()))
    : sortedJobs

  // Limit for free users
  const displayJobs = isPaid ? filteredJobs : filteredJobs.slice(0, 3)

  const specialties = [...new Set(jobsWithScores.map((j: Job) => j.specialty).filter(Boolean))] as string[]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Your Matched Results</h1>
          <p className="text-slate-600 mt-1">
            Jobs scored based on your personal priorities
          </p>
        </div>
        <Link
          to="/profile"
          className="flex items-center gap-2 px-4 py-2 text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50"
        >
          <Heart className="w-4 h-4" />
          Edit Priorities
        </Link>
      </div>

      {/* Your Priorities Summary */}
      {preferences?.index_priorities && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-medium text-slate-500 mb-3">Your Priorities</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(preferences.index_priorities)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([code, priority]) => (
                <div
                  key={code}
                  className={`px-3 py-1 rounded-full text-sm ${
                    (priority as number) >= 4
                      ? 'bg-red-100 text-red-700'
                      : (priority as number) >= 3
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {OFS_LABELS[code]}: {'❤️'.repeat(priority as number)}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filters & Sort */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterSpecialty}
            onChange={(e) => setFilterSpecialty(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="">All Specialties</option>
            {specialties.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-slate-500">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="your_score">Your Score (Highest)</option>
            <option value="ofs_score">Facility Score (OFS)</option>
            <option value="pay">Pay (Highest)</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <p className="text-sm text-slate-500">
        Showing {displayJobs.length} of {filteredJobs.length} matched jobs
      </p>

      {/* Job Results */}
      <div className="space-y-4">
        {displayJobs.map((job: Job, index: number) => {
          const isExpanded = expandedJob === job.id
          const yourGrade = getScoreGrade(job.your_score || 0)

          return (
            <div
              key={job.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  {/* Rank */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                    #{index + 1}
                  </div>

                  {/* Scores */}
                  <div className="flex gap-3">
                    {/* Your Score */}
                    <div className="text-center">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg ${getGradeColor(yourGrade)}`}>
                        {yourGrade}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Your Score</div>
                      <div className="text-xs font-medium">{job.your_score}</div>
                    </div>

                    {/* Facility Score */}
                    {job.facility_score && (
                      <div className="text-center">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg ${getGradeColor(job.facility_score.ofs_grade)}`}>
                          {job.facility_score.ofs_grade}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Facility</div>
                        <div className="text-xs font-medium">{job.facility_score.ofs_score}</div>
                      </div>
                    )}
                  </div>

                  {/* Job Details */}
                  <div className="flex-1">
                    <Link
                      to={`/jobs/${job.id}`}
                      className="text-lg font-semibold text-slate-900 hover:text-primary-600"
                    >
                      {job.title}
                    </Link>
                    <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                      <Building2 className="w-4 h-4" />
                      <Link to={`/facilities/${job.facility_id}`} className="hover:text-primary-600">
                        {job.facility_name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-2">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.city}, {job.state}
                      </span>
                      {job.pay_max && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          ${job.pay_min?.toLocaleString()} - ${job.pay_max?.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      {job.nursing_type && (
                        <span className="px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded-full">
                          {job.nursing_type.toUpperCase()}
                        </span>
                      )}
                      {job.specialty && (
                        <span className="px-2 py-1 bg-accent-50 text-accent-700 text-xs rounded-full">
                          {job.specialty}
                        </span>
                      )}
                      {job.employment_type && (
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">
                          {job.employment_type}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand Button */}
                  <button
                    onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                    className="p-2 text-slate-400 hover:text-slate-600"
                  >
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>

                {/* Expanded Score Breakdown */}
                {isExpanded && job.match_breakdown && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">Score Breakdown (weighted by your priorities)</h4>
                    <div className="grid grid-cols-4 gap-3">
                      {Object.entries(job.match_breakdown).map(([code, score]) => {
                        const priority = preferences?.index_priorities?.[code] || 3
                        return (
                          <div key={code} className="text-center p-2 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-500">{OFS_LABELS[code]}</div>
                            <div className="text-lg font-bold text-slate-900">{score}</div>
                            <div className="text-xs text-slate-400">
                              {'❤️'.repeat(priority)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Free User Upgrade CTA */}
      {!isPaid && filteredJobs.length > 3 && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">
                {filteredJobs.length - 3} More Matches Available
              </h3>
              <p className="text-purple-100 mb-4">
                Upgrade to see all your personalized job matches with detailed scoring breakdowns,
                unlimited results, and the ability to customize your priorities.
              </p>
              <div className="flex gap-3">
                <Link
                  to="/billing"
                  className="px-6 py-2 bg-white text-purple-600 font-semibold rounded-lg hover:bg-purple-50"
                >
                  View Plans
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Results */}
      {displayJobs.length === 0 && (
        <div className="text-center py-12">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Matched Jobs Found</h3>
          <p className="text-slate-600 mb-4">
            We couldn't find jobs matching your preferences. Try updating your profile.
          </p>
          <Link
            to="/profile"
            className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Update Preferences
          </Link>
        </div>
      )}
    </div>
  )
}
