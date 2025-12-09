import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { useEffect, useState } from 'react'
import { ArrowLeft, MapPin, Building2, Star, ExternalLink, Users, BarChart3, Lock, Crown, ChevronRight } from 'lucide-react'
import { api, setAuthToken } from '../api/client'
import { toTitleCase } from '../utils/format'
import ScoreGauge from '../components/scoring/ScoreGauge'
import IndexRadar from '../components/scoring/IndexRadar'
import IndexBreakdown from '../components/scoring/IndexBreakdown'
import JTICard from '../components/scoring/JTICard'
import FacilityAnalytics from '../components/FacilityAnalytics'

function getGradeColor(grade: string) {
  const baseGrade = grade?.[0]?.toUpperCase() || ''
  switch (baseGrade) {
    case 'A': return 'bg-emerald-500'
    case 'B': return 'bg-sky-500'
    case 'C': return 'bg-amber-500'
    case 'D': return 'bg-orange-500'
    case 'F': return 'bg-red-500'
    default: return 'bg-slate-400'
  }
}

function getGradeTextColor(grade: string) {
  const baseGrade = grade?.[0]?.toUpperCase() || ''
  switch (baseGrade) {
    case 'A': return 'text-emerald-600'
    case 'B': return 'text-sky-600'
    case 'C': return 'text-amber-600'
    case 'D': return 'text-orange-600'
    case 'F': return 'text-red-600'
    default: return 'text-slate-600'
  }
}

// Get top N indices sorted by score
function getTopIndices(indices: Record<string, number>, n: number = 2) {
  if (!indices) return []
  return Object.entries(indices)
    .filter(([_, score]) => score != null)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
}

// Index display names
const INDEX_NAMES: Record<string, string> = {
  pci: 'Pay & Compensation',
  ali: 'Amenities & Lifestyle',
  csi: 'Commute Score',
  cci: 'Climate & Comfort',
  lssi: 'Safety & Security',
  qli: 'Quality of Life',
  pei: 'Patient Experience',
  fsi: 'Facility Quality',
  eri: 'Employee Reviews',
}

export default function FacilityDetail() {
  const { id } = useParams()
  const auth = useAuth()
  const [userTier, setUserTier] = useState<string>('free')

  // Set auth token
  useEffect(() => {
    if (auth.user?.access_token) {
      setAuthToken(auth.user.access_token)
    }
  }, [auth.user?.access_token])

  // Fetch user info to get tier
  const { data: userData } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => api.get('/api/me').then(res => res.data.data),
    enabled: auth.isAuthenticated,
  })

  useEffect(() => {
    if (userData?.tier) {
      setUserTier(userData.tier)
    }
  }, [userData])

  // Only show premium content if authenticated AND has paid tier
  const isPaidUser = auth.isAuthenticated && ['starter', 'pro', 'premium'].includes(userTier.toLowerCase())

  const { data: facility, isLoading } = useQuery({
    queryKey: ['facility', id],
    queryFn: () => api.get(`/api/facilities/${id}`).then(res => res.data.data)
  })

  const { data: jobs } = useQuery({
    queryKey: ['facility-jobs', id],
    queryFn: () => api.get(`/api/facilities/${id}/jobs`).then(res => res.data.data)
  })

  const { data: transparency, isLoading: transparencyLoading } = useQuery({
    queryKey: ['facility-transparency', id],
    queryFn: () => api.get(`/api/facilities/${id}/transparency`).then(res => res.data.data)
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!facility) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Facility Not Found</h2>
        <Link to="/facilities" className="text-primary-600 hover:underline">
          Back to Facilities
        </Link>
      </div>
    )
  }

  const topIndices = facility.score?.indices ? getTopIndices(facility.score.indices, 2) : []

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        to="/facilities"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Facilities
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start gap-6">
          {facility.score && (
            <div className={`w-20 h-20 rounded-xl flex flex-col items-center justify-center text-white ${getGradeColor(facility.score.ofs_grade)}`}>
              <span className="text-3xl font-bold">{facility.score.ofs_grade}</span>
              <span className="text-sm opacity-80">{facility.score.ofs_score ? Math.round(facility.score.ofs_score) : '-'}</span>
            </div>
          )}

          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{toTitleCase(facility.name)}</h1>
            {facility.system_name && (
              <p className="text-primary-600 font-medium mb-3">{toTitleCase(facility.system_name)}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {facility.city}, {facility.state} {facility.zip_code}
              </span>
              {facility.bed_count && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {facility.bed_count} beds
                </span>
              )}
              {facility.is_magnet && (
                <span className="flex items-center gap-1 text-amber-600">
                  <Star className="w-4 h-4" />
                  Magnet Designated
                </span>
              )}
              {facility.is_teaching && (
                <span className="flex items-center gap-1 text-purple-600">
                  <Users className="w-4 h-4" />
                  Teaching Hospital
                </span>
              )}
              {facility.score?.indices_available && (
                <span className="flex items-center gap-1 text-slate-500">
                  <BarChart3 className="w-4 h-4" />
                  {facility.score.indices_available} indices scored
                </span>
              )}
            </div>
          </div>

          {facility.career_url && (
            <a
              href={facility.career_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Careers Site
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* OFS Scorecard */}
      {facility.score && facility.score.indices && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Overall Facility Score (OFS)</h2>
            {!isPaidUser && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                <Crown className="w-3 h-3" />
                Upgrade for full details
              </span>
            )}
          </div>

          {isPaidUser ? (
            /* Full scorecard for paid users */
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left: Gauge + Radar */}
              <div className="flex flex-col items-center gap-6">
                <ScoreGauge
                  score={facility.score.ofs_score}
                  grade={facility.score.ofs_grade}
                  size="lg"
                />
                <IndexRadar indices={facility.score.indices} />
              </div>

              {/* Right: Index Breakdown */}
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-4 uppercase tracking-wide">
                  Score Breakdown by Index
                </h3>
                <IndexBreakdown indices={facility.score.indices} />
                {/* Job Transparency - included with other indices */}
                <div className="mt-6">
                  <JTICard data={transparency} loading={transparencyLoading} compact />
                </div>
              </div>
            </div>
          ) : (
            /* Limited preview for free users */
            <div>
              {/* Score gauge - visible to all */}
              <div className="flex flex-col items-center mb-6">
                <ScoreGauge
                  score={facility.score.ofs_score}
                  grade={facility.score.ofs_grade}
                  size="lg"
                />
              </div>

              {/* Top 2 indices - preview */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-500 mb-4 uppercase tracking-wide">
                  Top Performing Areas
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {topIndices.map(([key, score]) => (
                    <div key={key} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-900">{INDEX_NAMES[key] || key.toUpperCase()}</span>
                        <span className={`text-lg font-bold ${getGradeTextColor(score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F')}`}>
                          {Math.round(score)}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${getGradeColor(score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F')}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Job Transparency - included with other indices */}
                <div className="mt-4">
                  <JTICard data={transparency} loading={transparencyLoading} compact />
                </div>
              </div>

              {/* Upgrade CTA */}
              <div className="relative">
                {/* Blurred preview of full content */}
                <div className="blur-sm opacity-50 pointer-events-none">
                  <div className="grid lg:grid-cols-2 gap-8">
                    <div className="flex flex-col items-center">
                      <div className="w-64 h-64 bg-slate-100 rounded-full" />
                    </div>
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-12 bg-slate-100 rounded-lg" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/95 to-transparent flex items-center justify-center">
                  <div className="text-center p-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 mb-3">
                      <Lock className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Unlock Full Score Breakdown
                    </h3>
                    <p className="text-slate-600 mb-4 max-w-md">
                      See all 8 indices, radar chart visualization, and detailed explanations for each score component.
                    </p>
                    <Link
                      to="/billing"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <Crown className="w-4 h-4" />
                      Upgrade to Starter
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {facility.score.calculation_notes && isPaidUser && (
            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600">{facility.score.calculation_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Premium Analytics - gated for pro users */}
      {isPaidUser ? (
        <div className="mb-6">
          <FacilityAnalytics facilityId={id || ''} facilityName={toTitleCase(facility.name)} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Advanced Analytics</h2>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
              <Crown className="w-3 h-3" />
              Pro
            </span>
          </div>
          <div className="text-center py-8">
            <Lock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-4">
              Historical trends, comparison tools, and detailed analytics available with Pro subscription.
            </p>
            <Link
              to="/billing"
              className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
            >
              Upgrade to Pro
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Demographics - visible to all */}
      {facility.demographics && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Area Demographics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {facility.demographics.population && (
              <div>
                <div className="text-slate-500">Population</div>
                <div className="font-semibold">{facility.demographics.population.toLocaleString()}</div>
              </div>
            )}
            {facility.demographics.median_income && (
              <div>
                <div className="text-slate-500">Median Income</div>
                <div className="font-semibold">${facility.demographics.median_income.toLocaleString()}</div>
              </div>
            )}
            {facility.demographics.median_age && (
              <div>
                <div className="text-slate-500">Median Age</div>
                <div className="font-semibold">{facility.demographics.median_age}</div>
              </div>
            )}
            {facility.demographics.diversity_index && (
              <div>
                <div className="text-slate-500">Diversity Index</div>
                <div className="font-semibold">{facility.demographics.diversity_index?.toFixed(1)}</div>
              </div>
            )}
            {facility.demographics.college_rate && (
              <div>
                <div className="text-slate-500">College Graduates</div>
                <div className="font-semibold">{facility.demographics.college_rate}%</div>
              </div>
            )}
            {facility.demographics.uninsured_rate && (
              <div>
                <div className="text-slate-500">Uninsured Rate</div>
                <div className="font-semibold">{facility.demographics.uninsured_rate}%</div>
              </div>
            )}
            {facility.demographics.life_expectancy && (
              <div>
                <div className="text-slate-500">Life Expectancy</div>
                <div className="font-semibold">{facility.demographics.life_expectancy} years</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Open Jobs - visible to all */}
      {jobs && jobs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Open Positions ({jobs.length})
            </h2>
          </div>
          <div className="space-y-3">
            {jobs.slice(0, 5).map((job: any) => (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="block p-4 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-slate-900">{job.title}</h3>
                    <div className="flex gap-2 mt-1 text-sm text-slate-500">
                      {job.nursing_type && <span>{job.nursing_type}</span>}
                      {job.shift_type && <span>• {job.shift_type}</span>}
                    </div>
                  </div>
                  {(job.pay_min || job.pay_max) && (
                    <span className="text-emerald-600 font-medium">
                      ${job.pay_min?.toLocaleString() || job.pay_max?.toLocaleString()}
                    </span>
                  )}
                </div>
              </Link>
            ))}
            {jobs.length > 5 && (
              <Link
                to={`/jobs?facility=${id}`}
                className="block text-center text-primary-600 hover:underline py-2"
              >
                View all {jobs.length} jobs
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
