import { Lock, TrendingUp, DollarSign, Briefcase, Eye, Award, Loader2, Star, ShieldCheck, Building2, Gift, Home, Clock, Heart, Users, MessageCircle, Shield, MapPin, Coffee, Car, CloudSun, Thermometer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { useSubscription, isAdminUnlocked } from '../hooks/useSubscription'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

interface FacilityAnalyticsProps {
  facilityId: string
  facilityName: string
}

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6']

// Helper to render star ratings
function StarRating({ rating, maxRating = 5 }: { rating: number; maxRating?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: maxRating }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
        />
      ))}
    </div>
  )
}

// Helper to get letter grade color
function getGradeColor(grade: string): string {
  switch (grade?.toUpperCase()) {
    case 'A': return 'bg-emerald-500'
    case 'B': return 'bg-blue-500'
    case 'C': return 'bg-amber-500'
    case 'D': return 'bg-orange-500'
    case 'F': return 'bg-red-500'
    default: return 'bg-slate-400'
  }
}

export default function FacilityAnalytics({ facilityId, facilityName }: FacilityAnalyticsProps) {
  const { isProOrAbove } = useSubscription()
  const hasAccess = isProOrAbove || isAdminUnlocked()

  // Fetch real analytics data
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['facility-analytics', facilityId],
    queryFn: () => api.get(`/api/facilities/${facilityId}/analytics`).then(res => res.data.data),
    enabled: hasAccess && !!facilityId,
  })

  // Show locked state for non-premium users
  if (!hasAccess) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            Premium Analytics
          </h2>
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
            <Lock className="w-3 h-3" />
            Pro
          </span>
        </div>

        {/* Blurred Preview */}
        <div className="relative">
          <div className="blur-sm pointer-events-none select-none">
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div className="h-32 bg-slate-100 rounded-lg"></div>
              <div className="h-32 bg-slate-100 rounded-lg"></div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="h-32 bg-slate-100 rounded-lg"></div>
              <div className="h-32 bg-slate-100 rounded-lg"></div>
            </div>
          </div>

          {/* Upgrade CTA */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 max-w-sm text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Unlock Deep Analytics</h3>
              <p className="text-sm text-slate-600 mb-4">
                Get real data: pay comparisons, job market stats, transparency scores, and regional rankings for {facilityName}.
              </p>
              <Link
                to="/billing"
                className="block w-full px-4 py-2 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-lg font-medium hover:from-primary-700 hover:to-accent-700 transition-all"
              >
                Upgrade to Pro - $19/mo
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          <span className="ml-3 text-slate-500">Loading analytics...</span>
        </div>
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="text-center py-8 text-slate-500">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p>Analytics data not available for this facility.</p>
        </div>
      </div>
    )
  }

  // Prepare chart data
  const payComparisonData = [
    { name: 'Facility', value: analytics.pay_comparison?.facility_avg || 0, fill: '#10b981' },
    { name: 'Regional', value: analytics.pay_comparison?.regional_avg || 0, fill: '#94a3b8' },
    { name: 'State', value: analytics.pay_comparison?.state_avg || 0, fill: '#64748b' },
  ].filter(d => d.value > 0)

  const transparencyData = [
    { name: 'Pay', value: analytics.transparency?.pay_disclosure_rate || 0 },
    { name: 'Benefits', value: analytics.transparency?.benefits_disclosure_rate || 0 },
    { name: 'Bonus', value: analytics.transparency?.bonus_disclosure_rate || 0 },
    { name: 'Shift', value: analytics.transparency?.shift_clarity_rate || 0 },
  ]

  const specialtyData = (analytics.job_market?.specialty_breakdown || []).slice(0, 6).map((s: any, i: number) => ({
    name: s.specialty?.length > 12 ? s.specialty.substring(0, 12) + '...' : s.specialty,
    value: s.count,
    fill: COLORS[i % COLORS.length]
  }))

  // Prepare radar data for indices
  const radarData = Object.entries(analytics.indices || {})
    .filter(([_, v]: any) => v.score !== null)
    .map(([key, val]: any) => ({
      subject: val.name?.split(' ')[0] || key.toUpperCase(),
      score: val.score || 0,
      fullMark: 100
    }))

  // Check if we have quality rating data
  const hasCMS = analytics.quality_ratings?.cms?.overall_rating
  const hasLeapfrog = analytics.quality_ratings?.leapfrog?.safety_grade
  const hasQualityRatings = hasCMS || hasLeapfrog

  // Check if we have BLS market data
  const hasBLS = analytics.bls_market_wages?.state_wages?.length > 0 || analytics.bls_market_wages?.metro_wages?.length > 0

  // Check if we have compensation data
  const comp = analytics.compensation || {}
  const hasCompensation = comp.avg_sign_on_bonus || comp.avg_housing_stipend || comp.travel_contracts > 0

  // Check if we have HCAHPS patient satisfaction data
  const hasHCAHPS = analytics.patient_satisfaction?.star_rating || analytics.patient_satisfaction?.nurse_communication

  // Check if we have housing cost data
  const hasHousing = analytics.housing_costs?.median_rent

  // Check if we have employee reviews
  const hasReviews = analytics.employee_reviews?.overall_rating

  // Check if we have safety data
  const hasSafety = analytics.safety?.safety_grade

  // Check if we have amenities data
  const hasAmenities = analytics.amenities?.scores?.overall

  // Check if we have commute data
  const hasCommute = analytics.commute?.commute_grade

  // Check if we have climate data
  const hasClimate = analytics.climate?.climate_grade

  // Check if we have facility stats
  const hasFacilityStats = analytics.facility_stats?.total_beds || analytics.facility_stats?.ownership_type

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-600" />
          Facility Analytics
        </h2>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {analytics.score_summary?.regional_rank && (
            <span className="flex items-center gap-1 bg-primary-50 text-primary-700 px-2 py-1 rounded-full">
              <Award className="w-3 h-3" />
              #{analytics.score_summary.regional_rank} in {analytics.region}
            </span>
          )}
          <span>Real-time data</span>
        </div>
      </div>

      {/* Quality Ratings Section - CMS & Leapfrog */}
      {hasQualityRatings && (
        <div className="mb-6 border border-slate-200 rounded-lg p-4 bg-gradient-to-r from-amber-50/50 to-emerald-50/50">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-slate-900">Quality & Safety Ratings</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {/* CMS Nursing Home Ratings */}
            {hasCMS && (
              <div className="bg-white rounded-lg p-4 border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">CMS Quality Rating</span>
                  <span className="text-xs text-slate-400">Nursing Home</span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <StarRating rating={analytics.quality_ratings.cms.overall_rating} />
                  <span className="text-lg font-bold text-slate-900">
                    {analytics.quality_ratings.cms.overall_rating}/5
                  </span>
                  {analytics.quality_ratings.cms.state_average && (
                    <span className="text-xs text-slate-500">
                      (State avg: {analytics.quality_ratings.cms.state_average.toFixed(1)})
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-slate-50 rounded">
                    <div className="text-sm font-semibold">{analytics.quality_ratings.cms.health_inspection_rating || '-'}</div>
                    <div className="text-[10px] text-slate-500">Inspection</div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <div className="text-sm font-semibold">{analytics.quality_ratings.cms.staffing_rating || '-'}</div>
                    <div className="text-[10px] text-slate-500">Staffing</div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <div className="text-sm font-semibold">{analytics.quality_ratings.cms.quality_measure_rating || '-'}</div>
                    <div className="text-[10px] text-slate-500">Quality</div>
                  </div>
                </div>
                {analytics.quality_ratings.cms.abuse_icon === 'Y' && (
                  <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    Abuse citation on record
                  </div>
                )}
              </div>
            )}

            {/* Leapfrog Hospital Safety */}
            {hasLeapfrog && (
              <div className="bg-white rounded-lg p-4 border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">Leapfrog Safety Grade</span>
                  <span className="text-xs text-slate-400">{analytics.quality_ratings.leapfrog.grade_period}</span>
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <div className={`w-14 h-14 rounded-xl ${getGradeColor(analytics.quality_ratings.leapfrog.safety_grade)} flex items-center justify-center`}>
                    <span className="text-2xl font-bold text-white">
                      {analytics.quality_ratings.leapfrog.safety_grade}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {analytics.quality_ratings.leapfrog.safety_grade === 'A' ? 'Top Safety Rating' :
                       analytics.quality_ratings.leapfrog.safety_grade === 'B' ? 'Good Safety Rating' :
                       analytics.quality_ratings.leapfrog.safety_grade === 'C' ? 'Average Safety' : 'Below Average'}
                    </div>
                    <div className="text-xs text-slate-500">Hospital Patient Safety</div>
                  </div>
                </div>
                {analytics.quality_ratings.leapfrog.grade_distribution && (
                  <div className="text-xs text-slate-500">
                    VA Hospitals: {Object.entries(analytics.quality_ratings.leapfrog.grade_distribution).map(([g, c]) =>
                      `${c} ${g}'s`
                    ).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pay Comparison */}
        <div className="border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <h3 className="font-medium text-slate-900">Pay Comparison (Avg $/hr)</h3>
          </div>
          {payComparisonData.length > 0 ? (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={payComparisonData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 'dataMax + 5']} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}/hr`, 'Average']} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {payComparisonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 text-xs mt-2">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-emerald-500"></div>
                  This Facility
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-slate-400"></div>
                  Regional Avg
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-slate-600"></div>
                  State Avg
                </span>
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
              No pay data available
            </div>
          )}
        </div>

        {/* Job Market */}
        <div className="border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-primary-500" />
            <h3 className="font-medium text-slate-900">Job Market</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 bg-slate-50 rounded-lg">
              <div className="text-xl font-bold text-slate-900">{analytics.job_market?.total_active_jobs || 0}</div>
              <div className="text-[10px] text-slate-500">Active Jobs</div>
            </div>
            <div className="text-center p-2 bg-emerald-50 rounded-lg">
              <div className="text-xl font-bold text-emerald-600">{analytics.job_market?.jobs_with_pay_disclosed || 0}</div>
              <div className="text-[10px] text-slate-500">Pay Disclosed</div>
            </div>
            <div className="text-center p-2 bg-amber-50 rounded-lg">
              <div className="text-xl font-bold text-amber-600">{analytics.job_market?.jobs_with_bonus || 0}</div>
              <div className="text-[10px] text-slate-500">With Bonus</div>
            </div>
          </div>
          {specialtyData.length > 0 ? (
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={specialtyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={45}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => percent > 0.1 ? name : ''}
                    labelLine={false}
                  >
                    {specialtyData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-28 flex items-center justify-center text-slate-400 text-sm">
              No specialty data
            </div>
          )}
        </div>

        {/* Transparency Score */}
        <div className="border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-purple-500" />
            <h3 className="font-medium text-slate-900">Job Transparency</h3>
          </div>
          <div className="space-y-3">
            {transparencyData.map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">{item.name} Disclosed</span>
                  <span className="font-medium text-slate-900">{item.value.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, item.value)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-3">
            Higher is better - shows how transparent job postings are
          </p>
        </div>

        {/* Score Indices Radar */}
        <div className="border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-amber-500" />
            <h3 className="font-medium text-slate-900">Score Breakdown</h3>
          </div>
          {radarData.length > 3 ? (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                  <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-slate-400 text-sm">
              Not enough index data for radar chart
            </div>
          )}
          {analytics.score_summary?.ofs_grade && (
            <div className="text-center mt-2">
              <span className="text-sm text-slate-500">Overall Grade: </span>
              <span className="font-bold text-lg text-primary-600">{analytics.score_summary.ofs_grade}</span>
            </div>
          )}
        </div>
      </div>

      {/* Compensation Package - Travel Nursing */}
      {hasCompensation && (
        <div className="mt-6 border border-slate-200 rounded-lg p-4 bg-gradient-to-r from-violet-50/50 to-indigo-50/50">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-violet-600" />
            <h3 className="font-semibold text-slate-900">Compensation Package</h3>
            {comp.travel_contracts > 0 && (
              <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                {comp.travel_contracts} Travel Contracts
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {comp.avg_sign_on_bonus && (
              <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
                <DollarSign className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                <div className="text-lg font-bold text-emerald-600">
                  ${comp.avg_sign_on_bonus.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500">Avg Sign-On Bonus</div>
                <div className="text-[10px] text-slate-400">{comp.jobs_with_bonus} jobs</div>
              </div>
            )}
            {comp.avg_housing_stipend && (
              <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
                <Home className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                <div className="text-lg font-bold text-blue-600">
                  ${comp.avg_housing_stipend.toLocaleString()}/mo
                </div>
                <div className="text-xs text-slate-500">Avg Housing Stipend</div>
              </div>
            )}
            {comp.avg_contract_weeks && (
              <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
                <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                <div className="text-lg font-bold text-amber-600">
                  {comp.avg_contract_weeks} weeks
                </div>
                <div className="text-xs text-slate-500">Avg Contract Length</div>
              </div>
            )}
            {comp.avg_guaranteed_hours && (
              <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
                <Briefcase className="w-5 h-5 text-slate-500 mx-auto mb-1" />
                <div className="text-lg font-bold text-slate-600">
                  {comp.avg_guaranteed_hours} hrs/wk
                </div>
                <div className="text-xs text-slate-500">Guaranteed Hours</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BLS Market Wage Comparison */}
      {hasBLS && (
        <div className="mt-6 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-600" />
              <h3 className="font-semibold text-slate-900">Market Rate Comparison (BLS)</h3>
            </div>
            {analytics.bls_market_wages?.metro_area && (
              <span className="text-xs text-slate-500">{analytics.bls_market_wages.metro_area}</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 text-xs border-b border-slate-100">
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium text-right">25th %</th>
                  <th className="pb-2 font-medium text-right">Median</th>
                  <th className="pb-2 font-medium text-right">75th %</th>
                  <th className="pb-2 font-medium text-right">90th %</th>
                </tr>
              </thead>
              <tbody>
                {(analytics.bls_market_wages?.metro_wages?.length > 0
                  ? analytics.bls_market_wages.metro_wages
                  : analytics.bls_market_wages?.state_wages || []
                ).map((wage: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-50">
                    <td className="py-2 font-medium text-slate-900">{wage.occupation}</td>
                    <td className="py-2 text-right text-slate-600">${wage.hourly_25th?.toFixed(2) || '-'}</td>
                    <td className="py-2 text-right font-semibold text-emerald-600">${wage.hourly_median?.toFixed(2) || '-'}</td>
                    <td className="py-2 text-right text-slate-600">${wage.hourly_75th?.toFixed(2) || '-'}</td>
                    <td className="py-2 text-right text-slate-500">${wage.hourly_90th?.toFixed(2) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            {analytics.bls_market_wages?.metro_wages?.length > 0
              ? 'Metro area data shown.'
              : 'Statewide Virginia data shown.'}
          </p>
        </div>
      )}

      {/* HCAHPS Patient Satisfaction */}
      {hasHCAHPS && (
        <div className="mt-6 border border-slate-200 rounded-lg p-4 bg-gradient-to-r from-rose-50/50 to-pink-50/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" />
              <h3 className="font-semibold text-slate-900">Patient Satisfaction (HCAHPS)</h3>
            </div>
            {analytics.patient_satisfaction?.star_rating && (
              <div className="flex items-center gap-1">
                <StarRating rating={analytics.patient_satisfaction.star_rating} />
                <span className="text-sm font-medium text-slate-600">
                  ({analytics.patient_satisfaction.surveys_completed?.toLocaleString()} surveys)
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
              <MessageCircle className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <div className="text-lg font-bold text-blue-600">
                {analytics.patient_satisfaction.nurse_communication}%
              </div>
              <div className="text-xs text-slate-500">Nurse Comm.</div>
              {analytics.patient_satisfaction.state_averages?.nurse_communication && (
                <div className="text-[10px] text-slate-400">
                  (Avg: {analytics.patient_satisfaction.state_averages.nurse_communication}%)
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
              <Users className="w-5 h-5 text-violet-500 mx-auto mb-1" />
              <div className="text-lg font-bold text-violet-600">
                {analytics.patient_satisfaction.doctor_communication}%
              </div>
              <div className="text-xs text-slate-500">Doctor Comm.</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
              <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <div className="text-lg font-bold text-amber-600">
                {analytics.patient_satisfaction.staff_responsiveness}%
              </div>
              <div className="text-xs text-slate-500">Responsiveness</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
              <Heart className="w-5 h-5 text-rose-500 mx-auto mb-1" />
              <div className="text-lg font-bold text-rose-600">
                {analytics.patient_satisfaction.would_recommend}%
              </div>
              <div className="text-xs text-slate-500">Recommend</div>
              {analytics.patient_satisfaction.state_averages?.would_recommend && (
                <div className="text-[10px] text-slate-400">
                  (Avg: {analytics.patient_satisfaction.state_averages.would_recommend}%)
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <div className="p-2 bg-slate-50 rounded">
              <div className="font-semibold">{analytics.patient_satisfaction.cleanliness}%</div>
              <div className="text-[10px] text-slate-500">Cleanliness</div>
            </div>
            <div className="p-2 bg-slate-50 rounded">
              <div className="font-semibold">{analytics.patient_satisfaction.quietness}%</div>
              <div className="text-[10px] text-slate-500">Quietness</div>
            </div>
            <div className="p-2 bg-slate-50 rounded">
              <div className="font-semibold">{analytics.patient_satisfaction.discharge_info}%</div>
              <div className="text-[10px] text-slate-500">Discharge Info</div>
            </div>
            <div className="p-2 bg-slate-50 rounded">
              <div className="font-semibold">{analytics.patient_satisfaction.overall_rating_9_10}%</div>
              <div className="text-[10px] text-slate-500">Rate 9-10</div>
            </div>
          </div>
        </div>
      )}

      {/* Housing Costs */}
      {hasHousing && (
        <div className="mt-6 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Home className="w-5 h-5 text-teal-600" />
              <h3 className="font-semibold text-slate-900">Cost of Living</h3>
            </div>
            <span className="text-xs text-slate-500">{analytics.housing_costs.area}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-teal-600">
                ${analytics.housing_costs.median_rent?.toLocaleString()}/mo
              </div>
              <div className="text-xs text-slate-500">Median Rent</div>
              {analytics.housing_costs.state_averages?.median_rent && (
                <div className="text-[10px] text-slate-400">
                  vs ${analytics.housing_costs.state_averages.median_rent?.toLocaleString()} state avg
                </div>
              )}
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-slate-700">
                ${(analytics.housing_costs.median_home_value / 1000)?.toFixed(0)}k
              </div>
              <div className="text-xs text-slate-500">Median Home</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-amber-600">
                {analytics.housing_costs.rent_burden_pct}%
              </div>
              <div className="text-xs text-slate-500">Rent Burden</div>
              <div className="text-[10px] text-slate-400">% of income</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-emerald-600">
                ${(analytics.housing_costs.median_income / 1000)?.toFixed(0)}k
              </div>
              <div className="text-xs text-slate-500">Median Income</div>
            </div>
          </div>
        </div>
      )}

      {/* Pay by Nursing Type */}
      {analytics.pay_comparison?.by_nursing_type?.length > 0 && (
        <div className="mt-6 border border-slate-200 rounded-lg p-4">
          <h3 className="font-medium text-slate-900 mb-3">Average Pay by Role (This Facility)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {analytics.pay_comparison.by_nursing_type.slice(0, 8).map((item: any, idx: number) => (
              <div key={idx} className="text-center p-2 bg-slate-50 rounded-lg">
                <div className="text-lg font-bold text-emerald-600">
                  ${item.avg_hourly?.toFixed(0) || '-'}
                </div>
                <div className="text-xs text-slate-500">{item.nursing_type || 'N/A'}</div>
                <div className="text-[10px] text-slate-400">{item.job_count} jobs</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employee Reviews */}
      {hasReviews && (
        <div className="mt-6 border border-slate-200 rounded-lg p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Employee Reviews</h3>
            </div>
            <div className="flex items-center gap-1">
              <StarRating rating={Math.round(analytics.employee_reviews.overall_rating)} />
              <span className="text-sm font-medium text-slate-600 ml-1">
                {analytics.employee_reviews.overall_rating.toFixed(1)}/5
              </span>
              <span className="text-xs text-slate-400">
                ({analytics.employee_reviews.review_count} reviews)
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {analytics.employee_reviews.work_life_balance && (
              <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
                <div className="text-lg font-bold text-blue-600">
                  {analytics.employee_reviews.work_life_balance.toFixed(1)}
                </div>
                <div className="text-xs text-slate-500">Work-Life Balance</div>
              </div>
            )}
            {analytics.employee_reviews.management && (
              <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
                <div className="text-lg font-bold text-violet-600">
                  {analytics.employee_reviews.management.toFixed(1)}
                </div>
                <div className="text-xs text-slate-500">Management</div>
              </div>
            )}
            {analytics.employee_reviews.culture && (
              <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
                <div className="text-lg font-bold text-emerald-600">
                  {analytics.employee_reviews.culture.toFixed(1)}
                </div>
                <div className="text-xs text-slate-500">Culture</div>
              </div>
            )}
            {analytics.employee_reviews.compensation_benefits && (
              <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
                <div className="text-lg font-bold text-amber-600">
                  {analytics.employee_reviews.compensation_benefits.toFixed(1)}
                </div>
                <div className="text-xs text-slate-500">Compensation</div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 mt-3 text-sm">
            {analytics.employee_reviews.recommend_pct && (
              <span className="text-slate-600">
                <span className="font-semibold text-emerald-600">{analytics.employee_reviews.recommend_pct}%</span> recommend to a friend
              </span>
            )}
            {analytics.employee_reviews.ceo_approval_pct && (
              <span className="text-slate-600">
                <span className="font-semibold text-blue-600">{analytics.employee_reviews.ceo_approval_pct}%</span> approve of CEO
              </span>
            )}
          </div>
        </div>
      )}

      {/* Safety & Crime */}
      {hasSafety && (
        <div className="mt-6 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-slate-900">Location Safety</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full ${getGradeColor(analytics.safety.safety_grade)} text-white font-bold text-sm`}>
                {analytics.safety.safety_grade}
              </div>
              <span className="text-sm text-slate-500">Safety Grade</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {analytics.safety.violent_crime_rate && (
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-red-600">
                  {analytics.safety.violent_crime_rate.toFixed(0)}
                </div>
                <div className="text-xs text-slate-500">Violent Crime Rate</div>
                {analytics.safety.vs_state_violent && (
                  <div className={`text-[10px] ${analytics.safety.vs_state_violent < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {analytics.safety.vs_state_violent > 0 ? '+' : ''}{(analytics.safety.vs_state_violent * 100).toFixed(0)}% vs state
                  </div>
                )}
              </div>
            )}
            {analytics.safety.property_crime_rate && (
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-amber-600">
                  {analytics.safety.property_crime_rate.toFixed(0)}
                </div>
                <div className="text-xs text-slate-500">Property Crime Rate</div>
              </div>
            )}
            {analytics.safety.safety_score && (
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-emerald-600">
                  {analytics.safety.safety_score}
                </div>
                <div className="text-xs text-slate-500">Safety Score</div>
              </div>
            )}
            {analytics.safety.state_percentile && (
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-blue-600">
                  {analytics.safety.state_percentile}%
                </div>
                <div className="text-xs text-slate-500">State Percentile</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nearby Amenities */}
      {hasAmenities && (
        <div className="mt-6 border border-slate-200 rounded-lg p-4 bg-gradient-to-r from-orange-50/50 to-amber-50/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-600" />
              <h3 className="font-semibold text-slate-900">Nearby Amenities</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full ${getGradeColor(analytics.amenities.scores.grade)} text-white font-bold text-sm`}>
                {analytics.amenities.scores.grade}
              </div>
              <span className="text-sm text-slate-500">Score: {analytics.amenities.scores.overall}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
              <Coffee className="w-4 h-4 text-amber-500 mx-auto mb-1" />
              <div className="text-sm font-bold">{analytics.amenities.restaurants}</div>
              <div className="text-[10px] text-slate-500">Restaurants</div>
            </div>
            <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
              <div className="w-4 h-4 mx-auto mb-1 text-emerald-500">🛒</div>
              <div className="text-sm font-bold">{analytics.amenities.grocery_stores}</div>
              <div className="text-[10px] text-slate-500">Grocery</div>
            </div>
            <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
              <div className="w-4 h-4 mx-auto mb-1 text-blue-500">💪</div>
              <div className="text-sm font-bold">{analytics.amenities.gyms}</div>
              <div className="text-[10px] text-slate-500">Gyms</div>
            </div>
            <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
              <div className="w-4 h-4 mx-auto mb-1 text-green-500">🌳</div>
              <div className="text-sm font-bold">{analytics.amenities.parks}</div>
              <div className="text-[10px] text-slate-500">Parks</div>
            </div>
            <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
              <div className="w-4 h-4 mx-auto mb-1 text-pink-500">👶</div>
              <div className="text-sm font-bold">{analytics.amenities.childcare}</div>
              <div className="text-[10px] text-slate-500">Childcare</div>
            </div>
          </div>
          {analytics.amenities.has_onsite_daycare && (
            <div className="mt-3 text-xs text-emerald-600 flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              On-site daycare available
            </div>
          )}
        </div>
      )}

      {/* Commute & Traffic */}
      {hasCommute && (
        <div className="mt-6 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-slate-600" />
              <h3 className="font-semibold text-slate-900">Commute & Traffic</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full ${getGradeColor(analytics.commute.commute_grade)} text-white font-bold text-sm`}>
                {analytics.commute.commute_grade}
              </div>
              <span className="text-sm text-slate-500">Score: {analytics.commute.commute_score}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className={`text-lg font-bold ${analytics.commute.congestion_ratio > 1.3 ? 'text-red-600' : 'text-emerald-600'}`}>
                {((analytics.commute.congestion_ratio - 1) * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-slate-500">Congestion Added</div>
              <div className="text-[10px] text-slate-400">to commute time</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <div className={`px-2 py-0.5 rounded-full ${getGradeColor(analytics.commute.day_shift_grade)} text-white font-bold text-sm inline-block`}>
                {analytics.commute.day_shift_grade}
              </div>
              <div className="text-xs text-slate-500 mt-1">Day Shift</div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <div className={`px-2 py-0.5 rounded-full ${getGradeColor(analytics.commute.night_shift_grade)} text-white font-bold text-sm inline-block`}>
                {analytics.commute.night_shift_grade}
              </div>
              <div className="text-xs text-slate-500 mt-1">Night Shift</div>
            </div>
            {analytics.commute.am_rush_ratio && (
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-amber-600">
                  {((analytics.commute.am_rush_ratio - 1) * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-slate-500">AM Rush Impact</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Climate & Weather */}
      {hasClimate && (
        <div className="mt-6 border border-slate-200 rounded-lg p-4 bg-gradient-to-r from-cyan-50/50 to-blue-50/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CloudSun className="w-5 h-5 text-cyan-600" />
              <h3 className="font-semibold text-slate-900">Climate & Weather</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full ${getGradeColor(analytics.climate.climate_grade)} text-white font-bold text-sm`}>
                {analytics.climate.climate_grade}
              </div>
              <span className="text-sm text-slate-500">Score: {analytics.climate.climate_score}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
              <Thermometer className="w-4 h-4 text-red-500 mx-auto mb-1" />
              <div className="text-lg font-bold text-red-600">{analytics.climate.summer_high?.toFixed(0)}°F</div>
              <div className="text-xs text-slate-500">Summer High</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
              <Thermometer className="w-4 h-4 text-blue-500 mx-auto mb-1" />
              <div className="text-lg font-bold text-blue-600">{analytics.climate.winter_low?.toFixed(0)}°F</div>
              <div className="text-xs text-slate-500">Winter Low</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
              <div className="w-4 h-4 mx-auto mb-1">☀️</div>
              <div className="text-lg font-bold text-amber-600">{analytics.climate.sunny_days}</div>
              <div className="text-xs text-slate-500">Sunny Days/yr</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
              <div className="w-4 h-4 mx-auto mb-1">❄️</div>
              <div className="text-lg font-bold text-cyan-600">{analytics.climate.annual_snow_inches?.toFixed(0)}"</div>
              <div className="text-xs text-slate-500">Annual Snow</div>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            {analytics.climate.annual_rain_inches && (
              <span>🌧️ {analytics.climate.annual_rain_inches.toFixed(0)}" annual rain</span>
            )}
            {analytics.climate.humidity && (
              <span>💧 {analytics.climate.humidity.toFixed(0)}% avg humidity</span>
            )}
          </div>
        </div>
      )}

      {/* Facility Statistics */}
      {hasFacilityStats && (
        <div className="mt-6 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-600" />
              <h3 className="font-semibold text-slate-900">Facility Statistics</h3>
            </div>
            {analytics.facility_stats.facility_grade && (
              <div className="flex items-center gap-2">
                <div className={`px-3 py-1 rounded-full ${getGradeColor(analytics.facility_stats.facility_grade)} text-white font-bold text-sm`}>
                  {analytics.facility_stats.facility_grade}
                </div>
                <span className="text-sm text-slate-500">FSI: {analytics.facility_stats.facility_score}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {analytics.facility_stats.total_beds && (
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-slate-700">{analytics.facility_stats.total_beds}</div>
                <div className="text-xs text-slate-500">Total Beds</div>
                {analytics.facility_stats.staffed_beds && (
                  <div className="text-[10px] text-slate-400">{analytics.facility_stats.staffed_beds} staffed</div>
                )}
              </div>
            )}
            {analytics.facility_stats.icu_beds && (
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-red-600">{analytics.facility_stats.icu_beds}</div>
                <div className="text-xs text-slate-500">ICU Beds</div>
              </div>
            )}
            {analytics.facility_stats.ownership_type && (
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-sm font-bold text-slate-700">{analytics.facility_stats.ownership_type}</div>
                <div className="text-xs text-slate-500">Ownership</div>
              </div>
            )}
            {analytics.facility_stats.urban_rural && (
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-sm font-bold text-slate-700">{analytics.facility_stats.urban_rural}</div>
                <div className="text-xs text-slate-500">Location Type</div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {analytics.facility_stats.is_teaching && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">🎓 Teaching Hospital</span>
            )}
            {analytics.facility_stats.has_emergency && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">🚨 Emergency Services</span>
            )}
            {analytics.facility_stats.birthing_friendly && (
              <span className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded-full">👶 Birthing Friendly</span>
            )}
            {analytics.facility_stats.hospital_type && (
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">{analytics.facility_stats.hospital_type}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
