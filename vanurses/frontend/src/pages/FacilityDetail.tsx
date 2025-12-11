import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { useEffect, useState } from 'react'
import { ArrowLeft, MapPin, Building2, Star, ExternalLink, Users, BarChart3, Lock, Unlock, Crown, ChevronRight, MessageCircle, Loader2 } from 'lucide-react'
import { api, setAuthToken } from '../api/client'
import { toTitleCase } from '../utils/format'
import { isAdminUnlocked } from '../hooks/useSubscription'
import ScoreGauge from '../components/scoring/ScoreGauge'
import IndexRadar from '../components/scoring/IndexRadar'
import IndexBreakdown from '../components/scoring/IndexBreakdown'
import JTICard from '../components/scoring/JTICard'
import FacilityAnalytics from '../components/FacilityAnalytics'
import { NoFilterUnlockModal, NOFILTER_STORAGE_KEY, lockNoFilter } from '../components/NoFilterUnlockModal'

// Sully moods with labels and colors
const SULLY_MOODS = [
  { id: 'optimistic', label: 'Optimistic', color: 'bg-emerald-500' },
  { id: 'neutral', label: 'Neutral', color: 'bg-slate-500' },
  { id: 'stern', label: 'Stern', color: 'bg-orange-500' },
  { id: 'nofilter', label: 'No Filter', color: 'bg-red-500', premium: true },
]

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

// Index display names - all 13 OFS indices
const INDEX_NAMES: Record<string, string> = {
  pci: 'Pay & Compensation',
  eri: 'Employee Reviews',
  lssi: 'Safety & Security',
  pei: 'Patient Experience',
  fsi: 'Facility Quality',
  cmsi: 'CMS Quality',
  ali: 'Amenities & Lifestyle',
  jti: 'Job Transparency',
  lsi: 'Leapfrog Safety',
  csi: 'Commute Score',
  qli: 'Quality of Life',
  oii: 'Opportunity Insights',
  cci: 'Climate & Comfort',
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

  // Only show premium content if authenticated AND has paid tier OR admin unlocked
  const isPaidUser = (auth.isAuthenticated && ['starter', 'pro', 'premium'].includes(userTier.toLowerCase())) || isAdminUnlocked()

  const { data: facility, isLoading, error, isError } = useQuery({
    queryKey: ['facility', id],
    queryFn: () => api.get(`/api/facilities/${id}`).then(res => res.data.data)
  })

  // Get top 3 facilities to check if current facility qualifies for free score view
  const { data: topFacilities } = useQuery({
    queryKey: ['top-facilities-for-free'],
    queryFn: () => api.get('/api/facilities', { params: { limit: 3 } }).then(res => res.data.data)
  })

  // Check if this facility is in the top 3 (free users can see scores for first 3)
  const isInTop3 = topFacilities?.some((f: any) => f.id === id)
  const canSeeScore = isPaidUser || isInTop3

  const { data: jobs } = useQuery({
    queryKey: ['facility-jobs', id],
    queryFn: () => api.get(`/api/facilities/${id}/jobs`).then(res => res.data.data)
  })

  const { data: transparency, isLoading: transparencyLoading } = useQuery({
    queryKey: ['facility-transparency', id],
    queryFn: () => api.get(`/api/facilities/${id}/transparency`).then(res => res.data.data)
  })

  // Sully facility analysis
  const [sullyMood, setSullyMood] = useState<string>('optimistic')
  const [sullyOpinion, setSullyOpinion] = useState<string | null>(null)

  // Check if No Filter mode is unlocked via localStorage (same unlock code as Sully page)
  const [nofilterUnlocked, setNofilterUnlocked] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem(NOFILTER_STORAGE_KEY) === 'true'
  })
  const [showUnlockModal, setShowUnlockModal] = useState(false)

  const handleLockNofilter = () => {
    lockNoFilter()
    setNofilterUnlocked(false)
    if (sullyMood === 'nofilter') {
      setSullyMood('neutral')
    }
  }

  // Check if user can use NoFilter (requires unlock code OR admin unlocked)
  // Subscription tier no longer matters - just needs the unlock code
  const canUseNoFilter = nofilterUnlocked || isAdminUnlocked()

  const facilityOpinion = useMutation({
    mutationFn: async (mood: string) => {
      const headers: Record<string, string> = {}
      if (isAdminUnlocked()) {
        headers['X-Admin-Unlock'] = 'true'
      }
      const response = await api.post('/api/sully/facility-opinion', {
        facility_id: id,
        mood: mood
      }, { headers })
      return response.data
    },
    onSuccess: (data) => {
      setSullyOpinion(data.opinion)
    }
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Error Loading Facility</h2>
        <p className="text-slate-600 mb-4">
          {error instanceof Error ? error.message : 'An error occurred while loading this facility.'}
        </p>
        <Link to="/facilities" className="text-primary-600 hover:underline">
          Back to Facilities
        </Link>
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

      {/* Upgrade Banner for non-paid users */}
      {!isPaidUser && (
        <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-xl p-5 text-white mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-bold">Unlock Full Facility Details</h3>
              <p className="text-primary-100 text-sm">
                Starting at only <span className="font-semibold text-white">$9/month</span> · Built by a nurse, for nurses
              </p>
            </div>
            <Link
              to="/billing"
              className="px-5 py-2 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-sm"
            >
              Upgrade Now
            </Link>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start gap-6">
          {facility.score && (
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Facility Score</span>
              {canSeeScore ? (
                <div className={`w-20 h-20 rounded-xl flex flex-col items-center justify-center text-white ${getGradeColor(facility.score.ofs_grade)}`}>
                  <span className="text-3xl font-bold">{facility.score.ofs_grade}</span>
                  <span className="text-sm opacity-80">{facility.score.ofs_score ? Math.round(facility.score.ofs_score) : '-'}</span>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl flex flex-col items-center justify-center bg-slate-100 relative" title="Upgrade to view Facility Score">
                  <span className="text-2xl font-bold text-slate-300 blur-[4px] select-none">A+</span>
                  <span className="text-sm text-slate-200 blur-[3px] select-none">95</span>
                  <Lock className="absolute w-6 h-6 text-slate-400" />
                </div>
              )}
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

      {/* Sully Facility Analysis */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img
              src={`/media/sully/sully-${sullyMood === 'nofilter' ? 'nofilter' : sullyMood === 'stern' ? 'stern' : sullyMood === 'neutral' ? 'neutral' : 'optimistic'}.jpg`}
              alt="Sully"
              className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-indigo-200"
            />
            <div>
              <h2 className="font-semibold text-slate-900">Ask Sully</h2>
              <p className="text-sm text-slate-500">AI-powered facility analysis</p>
            </div>
          </div>
        </div>

        {/* Mood selector */}
        <div className="flex flex-wrap gap-2 mb-4">
          {SULLY_MOODS.map((mood) => {
            const isLocked = mood.premium && !canUseNoFilter
            const isActive = sullyMood === mood.id
            return (
              <button
                key={mood.id}
                onClick={() => {
                  if (isLocked) return
                  setSullyMood(mood.id)
                  setSullyOpinion(null)
                }}
                disabled={isLocked}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  isActive
                    ? `${mood.color} text-white`
                    : isLocked
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {isLocked && <Lock className="w-3 h-3" />}
                {mood.label}
                {mood.premium && !isLocked && (
                  <Crown className="w-3 h-3 text-amber-400" />
                )}
              </button>
            )
          })}
          {!canUseNoFilter ? (
            <button
              onClick={() => setShowUnlockModal(true)}
              className="text-xs text-primary-600 hover:underline flex items-center gap-1 ml-2"
            >
              <Lock className="w-3 h-3" />
              Unlock No Filter
            </button>
          ) : nofilterUnlocked && (
            <button
              onClick={handleLockNofilter}
              className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 ml-2"
              title="Lock No Filter mode"
            >
              <Unlock className="w-3 h-3" />
              Lock
            </button>
          )}
        </div>

        {/* Get opinion button or result */}
        {!sullyOpinion ? (
          <button
            onClick={() => {
              if (!auth.isAuthenticated && !isAdminUnlocked()) {
                // Could redirect to login
                return
              }
              facilityOpinion.mutate(sullyMood)
            }}
            disabled={facilityOpinion.isPending}
            className="w-full py-3 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-lg font-medium hover:from-primary-700 hover:to-accent-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {facilityOpinion.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : !auth.isAuthenticated && !isAdminUnlocked() ? (
              <>
                <Lock className="w-4 h-4" />
                Sign in to get Sully's opinion
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4" />
                What does Sully think?
              </>
            )}
          </button>
        ) : (
          <div className="p-4 bg-white rounded-lg border border-indigo-200">
            <div className="flex items-start gap-3">
              <img
                src={`/media/sully/sully-${sullyMood === 'nofilter' ? 'nofilter' : sullyMood === 'stern' ? 'stern' : sullyMood === 'neutral' ? 'neutral' : 'optimistic'}.jpg`}
                alt="Sully"
                className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-indigo-200"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-900">Sully</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    SULLY_MOODS.find(m => m.id === sullyMood)?.color || 'bg-slate-500'
                  } text-white`}>
                    {SULLY_MOODS.find(m => m.id === sullyMood)?.label}
                  </span>
                </div>
                <p className="text-slate-700">{sullyOpinion}</p>
                <button
                  onClick={() => setSullyOpinion(null)}
                  className="text-xs text-primary-600 hover:underline mt-2"
                >
                  Ask again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* OFS Scorecard */}
      {facility.score && facility.score.indices && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-14 h-14 rounded-xl ${getGradeColor(facility.score.ofs_grade)} text-white flex items-center justify-center text-2xl font-bold shadow-lg`}>
              {facility.score.ofs_grade || '?'}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Overall Facility Score</h2>
              <p className="text-sm text-slate-500">
                Based on {Object.keys(facility.score.indices).length} quality indices
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Main Score Gauge */}
            <div className="flex justify-center">
              <ScoreGauge
                score={facility.score.ofs_score}
                grade={facility.score.ofs_grade}
                size="lg"
              />
            </div>

            {/* Radar Chart */}
            <div className="flex justify-center">
              <IndexRadar indices={facility.score.indices} />
            </div>
          </div>

          {/* Index Breakdown */}
          <IndexBreakdown indices={facility.score.indices} />

          {/* JTI Card if available */}
          {facility.jti && (
            <div className="mt-6">
              <JTICard data={facility.jti} />
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
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Advanced Analytics</h2>
                <p className="text-sm text-slate-500">Trends, comparisons & detailed analysis</p>
              </div>
            </div>
            <Link
              to="/billing"
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              <Crown className="w-3 h-3" />
              Pro
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

      {/* NoFilter Unlock Modal */}
      <NoFilterUnlockModal
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        onUnlock={() => setNofilterUnlocked(true)}
      />

      {/* Open Jobs - blurred for non-paid users after first 2 */}
      {jobs && jobs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Open Positions ({jobs.length})
            </h2>
            {!isPaidUser && jobs.length > 2 && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded flex items-center gap-1">
                <Lock className="w-3 h-3" />
                {jobs.length - 2} more locked
              </span>
            )}
          </div>
          <div className="space-y-3">
            {/* Show first 2 jobs for everyone */}
            {jobs.slice(0, isPaidUser ? 5 : 2).map((job: any) => (
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

            {/* Show blurred sample jobs for non-paid users */}
            {!isPaidUser && jobs.length > 2 && (
              <div className="relative">
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 rounded-lg flex flex-col items-center justify-center">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                    <Lock className="w-5 h-5 text-slate-400" />
                  </div>
                  <span className="text-xs text-slate-500 bg-white/80 px-2 py-1 rounded mb-2">Sample Data</span>
                  <Link
                    to="/billing"
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                  >
                    <Crown className="w-3 h-3" />
                    Upgrade to view all
                  </Link>
                </div>
                <div className="space-y-3 opacity-60">
                  {[
                    { title: 'Registered Nurse - ICU', type: 'RN', shift: 'Night', pay: 48 },
                    { title: 'Staff Nurse - Med/Surg', type: 'RN', shift: 'Day', pay: 42 },
                    { title: 'Charge Nurse - ER', type: 'RN', shift: 'Rotating', pay: 52 },
                  ].slice(0, Math.min(3, jobs.length - 2)).map((sample, idx) => (
                    <div
                      key={idx}
                      className="block p-4 rounded-lg border border-slate-100 bg-slate-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-slate-700">{sample.title}</h3>
                          <div className="flex gap-2 mt-1 text-sm text-slate-400">
                            <span>{sample.type}</span>
                            <span>• {sample.shift}</span>
                          </div>
                        </div>
                        <span className="text-slate-400 font-medium">
                          ${sample.pay}/hr
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isPaidUser && jobs.length > 5 && (
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
