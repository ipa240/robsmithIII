import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import {
  TrendingUp, TrendingDown, BarChart3,
  Building2, Briefcase, DollarSign,
  ArrowUpRight, ArrowDownRight, Minus, Lock, Loader2, Crown,
  MapPin, Clock, Award, Gift, Plane, Users, GraduationCap, Sun, Moon
} from 'lucide-react'
import { useSubscription, isAdminUnlocked } from '../hooks/useSubscription'

interface TrendData {
  month: string
  jobs: number
  avgPay: number | null
  facilities: number
}

interface FacilityTrend {
  id: string
  name: string
  city: string
  currentScore: number
  previousScore: number
  change: number
  grade: string
  trend: 'up' | 'down' | 'stable'
}

interface SpecialtyTrend {
  specialty: string
  jobs: number
  change: number
  demand: 'high' | 'medium' | 'stable' | 'declining'
}

interface PayByType {
  avgHourly: number
  jobCount: number
}

interface JobTypeTrend {
  type: string
  jobs: number
  percentage: number
}

interface NursingTypeTrend {
  type: string
  jobs: number
  avgHourly: number | null
}

interface TopHiringFacility {
  id: string
  name: string
  city: string
  activeJobs: number
  grade: string | null
  score: number | null
}

interface RegionTrend {
  region: string
  jobs: number
  facilities: number
  avgScore: number | null
}

interface ShiftTrend {
  shift: string
  jobs: number
  percentage: number
}

interface ExperienceTrend {
  level: string
  jobs: number
  percentage: number
  avgPay: number | null
}

interface CertificationTrend {
  certification: string
  jobs: number
  percentage: number
}

interface BenefitTrend {
  benefit: string
  jobs: number
  percentage: number
}

interface TravelTrend {
  stats: {
    totalJobs: number
    avgWeeklyPay: number | null
    avgContractWeeks: number | null
    avgHousingStipend: number | null
  }
  byRegion: Array<{
    region: string
    jobs: number
    avgWeekly: number | null
  }>
}

interface TrendsOverview {
  stats: {
    jobs: number
    jobsChange: number
    avgHourly: number
    avgHourlyByType?: Record<string, PayByType>
    payChange: number
    facilities: number
    facilitiesChange: number
    avgGrade: string
  }
  monthly: TrendData[]
}

export default function Trends() {
  const auth = useAuth()
  const { tier, isPremium, isPaid } = useSubscription()
  // Only show premium content if authenticated AND paid
  const canSeePremiumContent = (auth.isAuthenticated && isPaid) || isAdminUnlocked()
  const [timeframe, setTimeframe] = useState<'3m' | '6m' | '1y'>('6m')

  // Fetch overview data
  const { data: overview, isLoading: overviewLoading } = useQuery<TrendsOverview>({
    queryKey: ['trends', 'overview', timeframe],
    queryFn: () => api.get(`/api/trends/overview?timeframe=${timeframe}`).then(r => r.data)
  })

  // Fetch rising facilities
  const { data: risingFacilities, isLoading: risingLoading } = useQuery<FacilityTrend[]>({
    queryKey: ['trends', 'facilities', 'rising'],
    queryFn: () => api.get('/api/trends/facilities/rising').then(r => r.data)
  })

  // Fetch falling facilities
  const { data: fallingFacilities, isLoading: fallingLoading } = useQuery<FacilityTrend[]>({
    queryKey: ['trends', 'facilities', 'falling'],
    queryFn: () => api.get('/api/trends/facilities/falling').then(r => r.data)
  })

  // Fetch specialty trends
  const { data: specialties, isLoading: specialtiesLoading } = useQuery<SpecialtyTrend[]>({
    queryKey: ['trends', 'specialties'],
    queryFn: () => api.get('/api/trends/specialties').then(r => r.data)
  })

  // Fetch job types (employment types)
  const { data: jobTypes, isLoading: jobTypesLoading } = useQuery<JobTypeTrend[]>({
    queryKey: ['trends', 'job-types'],
    queryFn: () => api.get('/api/trends/job-types').then(r => r.data)
  })

  // Fetch nursing types
  const { data: nursingTypes, isLoading: nursingTypesLoading } = useQuery<NursingTypeTrend[]>({
    queryKey: ['trends', 'nursing-types'],
    queryFn: () => api.get('/api/trends/nursing-types').then(r => r.data)
  })

  // Fetch top hiring facilities
  const { data: topHiring, isLoading: topHiringLoading } = useQuery<TopHiringFacility[]>({
    queryKey: ['trends', 'top-hiring'],
    queryFn: () => api.get('/api/trends/facilities/top-hiring').then(r => r.data)
  })

  // Fetch regions
  const { data: regions, isLoading: regionsLoading } = useQuery<RegionTrend[]>({
    queryKey: ['trends', 'regions'],
    queryFn: () => api.get('/api/trends/regions').then(r => r.data)
  })

  // Fetch shifts
  const { data: shifts, isLoading: shiftsLoading } = useQuery<ShiftTrend[]>({
    queryKey: ['trends', 'shifts'],
    queryFn: () => api.get('/api/trends/shifts').then(r => r.data)
  })

  // Fetch experience requirements
  const { data: experience, isLoading: experienceLoading } = useQuery<ExperienceTrend[]>({
    queryKey: ['trends', 'experience'],
    queryFn: () => api.get('/api/trends/experience').then(r => r.data)
  })

  // Fetch certifications
  const { data: certifications, isLoading: certificationsLoading } = useQuery<CertificationTrend[]>({
    queryKey: ['trends', 'certifications'],
    queryFn: () => api.get('/api/trends/certifications').then(r => r.data)
  })

  // Fetch benefits
  const { data: benefits, isLoading: benefitsLoading } = useQuery<BenefitTrend[]>({
    queryKey: ['trends', 'benefits'],
    queryFn: () => api.get('/api/trends/benefits').then(r => r.data)
  })

  // Fetch travel nursing data
  const { data: travelData, isLoading: travelLoading } = useQuery<TravelTrend>({
    queryKey: ['trends', 'travel'],
    queryFn: () => api.get('/api/trends/travel').then(r => r.data)
  })

  const stats = overview?.stats || { jobs: 0, jobsChange: 0, avgHourly: 0, payChange: 0, facilities: 0, facilitiesChange: 0, avgGrade: 'B' }
  const monthlyTrends = overview?.monthly || []
  const maxJobs = Math.max(...monthlyTrends.map(t => t.jobs), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary-600" />
            Market Trends
          </h1>
          <p className="text-slate-600">Track nursing job market trends in Virginia</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Timeframe:</span>
          <div className="flex border border-slate-300 rounded-lg overflow-hidden relative">
            {(['3m', '6m', '1y'] as const).map(t => (
              <button
                key={t}
                onClick={() => canSeePremiumContent && setTimeframe(t)}
                disabled={!canSeePremiumContent}
                className={`px-3 py-1.5 text-sm ${
                  timeframe === t
                    ? 'bg-primary-600 text-white'
                    : 'bg-white hover:bg-slate-50'
                } ${!canSeePremiumContent ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                {t}
              </button>
            ))}
            {!canSeePremiumContent && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                <Lock className="w-4 h-4 text-slate-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade Banner - ONE banner for all premium features */}
      {!canSeePremiumContent && (
        <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-xl p-6 text-white">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Crown className="w-6 h-6" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-lg font-bold">Unlock All Market Trends</h2>
              <p className="text-primary-100 text-sm">
                Starting at only <span className="font-semibold text-white">$9/month</span> · Built by a nurse, for nurses
              </p>
            </div>
            <Link
              to="/billing"
              className="px-6 py-2.5 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 flex-shrink-0 flex items-center gap-2"
            >
              <Crown className="w-4 h-4" />
              Upgrade Now
            </Link>
          </div>
        </div>
      )}

      {/* Key Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Briefcase className="w-5 h-5 text-slate-400" />
            <span className={`flex items-center text-sm font-medium ${
              stats.jobsChange > 0 ? 'text-emerald-600' : stats.jobsChange < 0 ? 'text-red-600' : 'text-slate-500'
            }`}>
              {stats.jobsChange > 0 ? <ArrowUpRight className="w-4 h-4" /> :
               stats.jobsChange < 0 ? <ArrowDownRight className="w-4 h-4" /> :
               <Minus className="w-4 h-4" />}
              {Math.abs(stats.jobsChange)}%
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {overviewLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : stats.jobs.toLocaleString()}
          </div>
          <div className="text-sm text-slate-500">Open Jobs</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-5 h-5 text-slate-400" />
            <span className={`flex items-center text-sm font-medium ${
              stats.payChange > 0 ? 'text-emerald-600' : stats.payChange < 0 ? 'text-red-600' : 'text-slate-500'
            }`}>
              {stats.payChange > 0 ? <ArrowUpRight className="w-4 h-4" /> :
               stats.payChange < 0 ? <ArrowDownRight className="w-4 h-4" /> :
               <Minus className="w-4 h-4" />}
              {Math.abs(stats.payChange)}%
            </span>
          </div>
          {overviewLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : overview?.stats?.avgHourlyByType ? (
            <>
              <div className="text-sm font-bold text-slate-900 mb-1">
                Virginia Market Rates
              </div>
              <div className="text-xs text-slate-500 space-y-0.5">
                <div>RN: ${overview.stats.avgHourlyByType.rn?.avgHourly?.toFixed(0) || '-'}/hr • LPN: ${overview.stats.avgHourlyByType.lpn?.avgHourly?.toFixed(0) || '-'}/hr</div>
                <div>CNA: ${overview.stats.avgHourlyByType.cna?.avgHourly?.toFixed(0) || '-'}/hr • NP: ${overview.stats.avgHourlyByType.np?.avgHourly?.toFixed(0) || '-'}/hr</div>
                <div>CRNA: ${overview.stats.avgHourlyByType.crna?.avgHourly?.toFixed(0) || '-'}/hr • Travel: ${overview.stats.avgHourlyByType.travel?.avgHourly?.toFixed(0) || '-'}/hr</div>
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-slate-900">
                ${stats.avgHourly.toFixed(2)}
              </div>
              <div className="text-sm text-slate-500">Avg Hourly Rate</div>
            </>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Building2 className="w-5 h-5 text-slate-400" />
            <span className={`flex items-center text-sm font-medium ${
              stats.facilitiesChange > 0 ? 'text-emerald-600' : stats.facilitiesChange < 0 ? 'text-red-600' : 'text-slate-500'
            }`}>
              {stats.facilitiesChange > 0 ? <ArrowUpRight className="w-4 h-4" /> :
               stats.facilitiesChange < 0 ? <ArrowDownRight className="w-4 h-4" /> :
               <Minus className="w-4 h-4" />}
              {Math.abs(stats.facilitiesChange)}%
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {overviewLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : stats.facilities}
          </div>
          <div className="text-sm text-slate-500">Active Facilities</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="w-5 h-5 text-slate-400" />
            <span className="flex items-center text-slate-500 text-sm font-medium">
              <Minus className="w-4 h-4" />
              0%
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {overviewLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : canSeePremiumContent ? (
              stats.avgGrade
            ) : (
              <span className="relative inline-block">
                <span className="blur-sm select-none">B+</span>
                <Lock className="absolute inset-0 m-auto w-4 h-4 text-slate-400" />
              </span>
            )}
          </div>
          <div className="text-sm text-slate-500">Avg Facility Grade</div>
        </div>
      </div>

      {/* Job Posting Trend Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Job Postings Over Time</h2>
        <div className="relative">
          {!canSeePremiumContent && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 rounded-lg flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                <Lock className="w-6 h-6 text-slate-400" />
              </div>
              <span className="text-xs text-slate-500 bg-white/80 px-2 py-1 rounded">Sample Data</span>
            </div>
          )}
          {canSeePremiumContent ? (
            overviewLoading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              </div>
            ) : monthlyTrends.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500">
                No trend data available for this timeframe
              </div>
            ) : (
              <div className="h-64 flex items-end gap-4">
                {monthlyTrends.map((data) => (
                  <div key={data.month} className="flex-1 flex flex-col items-center">
                    <div className="w-full relative">
                      <div
                        className="w-full bg-primary-500 rounded-t-lg transition-all hover:bg-primary-600"
                        style={{ height: `${(data.jobs / maxJobs) * 200}px` }}
                      />
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-sm font-medium text-slate-700">
                        {data.jobs}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">{data.month}</div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Placeholder data visible through light blur
            <div className="h-64 flex items-end gap-4">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, i) => (
                <div key={month} className="flex-1 flex flex-col items-center">
                  <div className="w-full relative">
                    <div
                      className="w-full bg-primary-200 rounded-t-lg"
                      style={{ height: `${[120, 140, 100, 160, 180, 150][i]}px` }}
                    />
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{month}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Facility Rankings */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Rising Facilities */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <h2 className="font-semibold text-slate-900">Top Rated Facilities</h2>
          </div>
          <div className="relative">
            {!canSeePremiumContent && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                  <Lock className="w-5 h-5 text-slate-400" />
                </div>
                <span className="text-xs text-slate-500 bg-white/80 px-2 py-1 rounded">Sample Data</span>
              </div>
            )}
            {canSeePremiumContent ? (
              risingLoading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {(risingFacilities || []).map((facility, i) => (
                    <div key={facility.id} className="p-4 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">{facility.name}</div>
                        <div className="text-sm text-slate-500">{facility.city}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{facility.currentScore}</div>
                        <div className="flex items-center text-emerald-600 text-sm">
                          <span className="text-xs mr-1">Grade</span>
                          {facility.grade}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              // Placeholder data visible through light blur
              <div className="divide-y divide-slate-100">
                {['Sentara Norfolk General', 'VCU Medical Center', 'Inova Fairfax', 'UVA Health', 'Riverside Regional'].map((name, i) => (
                  <div key={i} className="p-4 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{name}</div>
                      <div className="text-sm text-slate-500">Virginia</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{95 - i * 3}</div>
                      <div className="flex items-center text-emerald-600 text-sm">
                        <span className="text-xs mr-1">Grade</span>
                        {i < 2 ? 'A' : 'A-'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Falling Facilities */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-slate-900">Lower Rated Facilities</h2>
          </div>
          <div className="relative">
            {!canSeePremiumContent && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                  <Lock className="w-5 h-5 text-slate-400" />
                </div>
                <span className="text-xs text-slate-500 bg-white/80 px-2 py-1 rounded">Sample Data</span>
              </div>
            )}
            {canSeePremiumContent ? (
              fallingLoading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {(fallingFacilities || []).map((facility, i) => (
                    <div key={facility.id} className="p-4 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">{facility.name}</div>
                        <div className="text-sm text-slate-500">{facility.city}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{facility.currentScore}</div>
                        <div className="flex items-center text-red-600 text-sm">
                          <span className="text-xs mr-1">Grade</span>
                          {facility.grade}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              // Placeholder data visible through light blur
              <div className="divide-y divide-slate-100">
                {['Sample Hospital A', 'Sample Hospital B', 'Sample Hospital C', 'Sample Hospital D', 'Sample Hospital E'].map((name, i) => (
                  <div key={i} className="p-4 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{name}</div>
                      <div className="text-sm text-slate-500">Virginia</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{60 - i * 5}</div>
                      <div className="flex items-center text-red-600 text-sm">
                        <span className="text-xs mr-1">Grade</span>
                        {i < 2 ? 'C' : 'D'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Specialty Demand */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Specialty Demand</h2>
        <div className="relative">
          {!canSeePremiumContent && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 rounded-lg flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                <Lock className="w-6 h-6 text-slate-400" />
              </div>
              <span className="text-xs text-slate-500 bg-white/80 px-2 py-1 rounded">Sample Data</span>
            </div>
          )}
          {canSeePremiumContent ? (
            specialtiesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(specialties || []).slice(0, 9).map(spec => (
                  <div key={spec.specialty} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="font-medium text-slate-900">{spec.specialty}</div>
                      <div className={`text-sm ${
                        spec.demand === 'high' ? 'text-emerald-600' :
                        spec.demand === 'declining' ? 'text-red-600' :
                        'text-slate-500'
                      }`}>
                        {spec.demand === 'high' ? 'High Demand' :
                         spec.demand === 'declining' ? 'Declining' :
                         spec.demand === 'medium' ? 'Moderate' : 'Stable'}
                        <span className="text-slate-400 ml-2">({spec.jobs} jobs)</span>
                      </div>
                    </div>
                    <div className={`flex items-center font-medium ${
                      spec.change > 0 ? 'text-emerald-600' :
                      spec.change < 0 ? 'text-red-600' :
                      'text-slate-500'
                    }`}>
                      {spec.change > 0 ? <ArrowUpRight className="w-4 h-4" /> :
                       spec.change < 0 ? <ArrowDownRight className="w-4 h-4" /> :
                       <Minus className="w-4 h-4" />}
                      {Math.abs(spec.change)}%
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Placeholder data visible through light blur
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: 'ICU', demand: 'High Demand', jobs: 145, change: 12 },
                { name: 'Med-Surg', demand: 'High Demand', jobs: 203, change: 8 },
                { name: 'OR', demand: 'Moderate', jobs: 89, change: 3 },
                { name: 'ER', demand: 'High Demand', jobs: 167, change: 15 },
                { name: 'L&D', demand: 'Stable', jobs: 56, change: 0 },
                { name: 'Peds', demand: 'Moderate', jobs: 78, change: 5 },
                { name: 'Oncology', demand: 'Stable', jobs: 45, change: 2 },
                { name: 'Cardiac', demand: 'High Demand', jobs: 92, change: 10 },
                { name: 'Psych', demand: 'Moderate', jobs: 67, change: 4 },
              ].map((spec) => (
                <div key={spec.name} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <div className="font-medium text-slate-900">{spec.name}</div>
                    <div className={`text-sm ${
                      spec.demand === 'High Demand' ? 'text-emerald-600' : 'text-slate-500'
                    }`}>
                      {spec.demand}
                      <span className="text-slate-400 ml-2">({spec.jobs} jobs)</span>
                    </div>
                  </div>
                  <div className={`flex items-center font-medium ${
                    spec.change > 0 ? 'text-emerald-600' : 'text-slate-500'
                  }`}>
                    {spec.change > 0 ? <ArrowUpRight className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    {spec.change}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Employment Types & Nursing Types Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Employment Types */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Employment Types</h2>
          </div>
          <div className="relative">
            {!canSeePremiumContent && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 rounded-lg flex flex-col items-center justify-center">
                <Lock className="w-5 h-5 text-slate-400 mb-1" />
                <span className="text-xs text-slate-500">Premium</span>
              </div>
            )}
            {canSeePremiumContent ? (
              jobTypesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                </div>
              ) : (
                <div className="space-y-3">
                  {(jobTypes || []).map(jt => (
                    <div key={jt.type} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-700 capitalize">{jt.type.replace('_', ' ')}</span>
                          <span className="text-slate-500">{jt.jobs.toLocaleString()} jobs</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className="bg-primary-500 h-2 rounded-full"
                            style={{ width: `${jt.percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium text-slate-600 w-12 text-right">{Math.round(jt.percentage)}%</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-3">
                {[
                  { type: 'Full-time', count: 2195, pct: 79 },
                  { type: 'Part-time', count: 181, pct: 7 },
                  { type: 'Travel', count: 180, pct: 6 },
                  { type: 'PRN', count: 155, pct: 6 },
                  { type: 'Contract', count: 33, pct: 2 },
                ].map(jt => (
                  <div key={jt.type} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-slate-700">{jt.type}</span>
                        <span className="text-slate-500">{jt.count} jobs</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="bg-primary-200 h-2 rounded-full" style={{ width: `${jt.pct}%` }} />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-slate-600 w-12 text-right">{jt.pct}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nursing Types */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Nursing Type Demand</h2>
          </div>
          <div className="relative">
            {!canSeePremiumContent && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 rounded-lg flex flex-col items-center justify-center">
                <Lock className="w-5 h-5 text-slate-400 mb-1" />
                <span className="text-xs text-slate-500">Premium</span>
              </div>
            )}
            {canSeePremiumContent ? (
              nursingTypesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                </div>
              ) : (
                <div className="space-y-3">
                  {(nursingTypes || []).map(nt => (
                    <div key={nt.type} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <div className="font-medium text-slate-900">{nt.type}</div>
                        <div className="text-sm text-slate-500">{nt.jobs.toLocaleString()} positions</div>
                      </div>
                      <div className="text-right">
                        {nt.avgHourly && (
                          <div className="font-bold text-slate-900">${nt.avgHourly.toFixed(0)}/hr</div>
                        )}
                        <div className={`text-xs ${nt.jobs > 500 ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {nt.jobs > 500 ? 'High Demand' : 'Moderate'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-3">
                {[
                  { type: 'RN', jobs: 2100, pay: 38, demand: 'High Demand' },
                  { type: 'LPN', jobs: 350, pay: 25, demand: 'Moderate' },
                  { type: 'CNA', jobs: 200, pay: 17, demand: 'Moderate' },
                  { type: 'NP', jobs: 80, pay: 58, demand: 'High Demand' },
                ].map(nt => (
                  <div key={nt.type} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <div className="font-medium text-slate-900">{nt.type}</div>
                      <div className="text-sm text-slate-500">{nt.jobs} positions</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">${nt.pay}/hr</div>
                      <div className={`text-xs ${nt.demand === 'High Demand' ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {nt.demand}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Hiring Facilities */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-slate-900">Top Hiring Facilities</h2>
        </div>
        <div className="relative">
          {!canSeePremiumContent && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center">
              <Lock className="w-5 h-5 text-slate-400 mb-1" />
              <span className="text-xs text-slate-500">Premium</span>
            </div>
          )}
          {canSeePremiumContent ? (
            topHiringLoading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                {(topHiring || []).slice(0, 6).map((facility, i) => (
                  <Link
                    key={facility.id}
                    to={`/facilities/${facility.id}`}
                    className="p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">{facility.name}</div>
                        <div className="text-sm text-slate-500">{facility.city}</div>
                        <div className="text-sm font-semibold text-primary-600 mt-1">
                          {facility.activeJobs} open positions
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              {[
                { name: 'UVA Health', city: 'Charlottesville', jobs: 326 },
                { name: 'Sentara Martha Jefferson', city: 'Charlottesville', jobs: 239 },
                { name: 'Carilion Roanoke', city: 'Roanoke', jobs: 192 },
                { name: 'VCU Medical Center', city: 'Richmond', jobs: 156 },
                { name: 'Inova Fairfax', city: 'Falls Church', jobs: 134 },
                { name: 'Riverside Regional', city: 'Newport News', jobs: 98 },
              ].map((f, i) => (
                <div key={f.name} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{f.name}</div>
                      <div className="text-sm text-slate-500">{f.city}</div>
                      <div className="text-sm font-semibold text-primary-600 mt-1">{f.jobs} open positions</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Jobs by Region & Shift Availability Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Jobs by Region */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Jobs by City</h2>
          </div>
          <div className="relative">
            {!canSeePremiumContent && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 rounded-lg flex flex-col items-center justify-center">
                <Lock className="w-5 h-5 text-slate-400 mb-1" />
                <span className="text-xs text-slate-500">Premium</span>
              </div>
            )}
            {canSeePremiumContent ? (
              regionsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                </div>
              ) : (
                <div className="space-y-2">
                  {(regions || []).slice(0, 8).map(r => (
                    <div key={r.region} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-700 capitalize">{r.region.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-500">{r.jobs} jobs</span>
                        <span className="text-sm text-slate-400">{r.facilities} facilities</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-2">
                {[
                  { city: 'Charlottesville', jobs: 260, pay: 42 },
                  { city: 'Roanoke', jobs: 255, pay: 38 },
                  { city: 'Richmond', jobs: 194, pay: 40 },
                  { city: 'Norfolk', jobs: 186, pay: 39 },
                  { city: 'Falls Church', jobs: 145, pay: 45 },
                  { city: 'Newport News', jobs: 98, pay: 37 },
                ].map(r => (
                  <div key={r.city} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-700">{r.city}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-slate-500">{r.jobs} jobs</span>
                      <span className="text-sm font-medium text-emerald-600">${r.pay}/hr avg</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Shift Availability */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Shift Availability</h2>
          </div>
          <div className="relative">
            {!canSeePremiumContent && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 rounded-lg flex flex-col items-center justify-center">
                <Lock className="w-5 h-5 text-slate-400 mb-1" />
                <span className="text-xs text-slate-500">Premium</span>
              </div>
            )}
            {canSeePremiumContent ? (
              shiftsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                </div>
              ) : (
                <div className="space-y-4">
                  {(shifts || []).map(s => (
                    <div key={s.shift} className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                        {s.shift.toLowerCase().includes('day') ? (
                          <Sun className="w-5 h-5 text-amber-500" />
                        ) : s.shift.toLowerCase().includes('night') ? (
                          <Moon className="w-5 h-5 text-indigo-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-700 capitalize">{s.shift}</span>
                          <span className="text-slate-500">{s.jobs.toLocaleString()} jobs</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              s.shift.toLowerCase().includes('day') ? 'bg-amber-500' :
                              s.shift.toLowerCase().includes('night') ? 'bg-indigo-500' : 'bg-slate-400'
                            }`}
                            style={{ width: `${s.percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium text-slate-600 w-12 text-right">{Math.round(s.percentage)}%</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-4">
                {[
                  { shift: 'Day Shift', count: 1450, pct: 53 },
                  { shift: 'Night Shift', count: 890, pct: 32 },
                  { shift: 'Rotating', count: 310, pct: 11 },
                  { shift: 'Weekend', count: 94, pct: 4 },
                ].map(s => (
                  <div key={s.shift} className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      {s.shift.includes('Day') ? (
                        <Sun className="w-5 h-5 text-amber-500" />
                      ) : s.shift.includes('Night') ? (
                        <Moon className="w-5 h-5 text-indigo-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-slate-700">{s.shift}</span>
                        <span className="text-slate-500">{s.count} jobs</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            s.shift.includes('Day') ? 'bg-amber-200' :
                            s.shift.includes('Night') ? 'bg-indigo-200' : 'bg-slate-300'
                          }`}
                          style={{ width: `${s.pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-slate-600 w-12 text-right">{s.pct}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Experience & Certifications Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Experience Requirements */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Experience Requirements</h2>
          </div>
          <div className="relative">
            {!canSeePremiumContent && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 rounded-lg flex flex-col items-center justify-center">
                <Lock className="w-5 h-5 text-slate-400 mb-1" />
                <span className="text-xs text-slate-500">Premium</span>
              </div>
            )}
            {canSeePremiumContent ? (
              experienceLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                </div>
              ) : (
                <div className="space-y-3">
                  {(experience || []).length > 0 ? (experience || []).map(e => (
                    <div key={e.level} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <div className="font-medium text-slate-900 capitalize">{e.level}</div>
                        <div className="text-sm text-slate-500">{e.jobs.toLocaleString()} positions ({Math.round(e.percentage)}%)</div>
                      </div>
                      {e.avgPay && (
                        <div className="text-right">
                          <div className="font-bold text-emerald-600">${e.avgPay.toFixed(0)}/hr</div>
                          <div className="text-xs text-slate-500">avg pay</div>
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="text-center text-slate-500 py-4">Experience data coming soon</div>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-3">
                {[
                  { level: 'Entry Level (0-1 yr)', count: 456, pct: 17, pay: 32 },
                  { level: '1-3 Years', count: 892, pct: 32, pay: 38 },
                  { level: '3-5 Years', count: 756, pct: 27, pay: 42 },
                  { level: '5+ Years', count: 640, pct: 24, pay: 48 },
                ].map(e => (
                  <div key={e.level} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <div className="font-medium text-slate-900">{e.level}</div>
                      <div className="text-sm text-slate-500">{e.count} positions ({e.pct}%)</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-600">${e.pay}/hr</div>
                      <div className="text-xs text-slate-500">avg pay</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Required Certifications */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Required Certifications</h2>
          </div>
          <div className="relative">
            {!canSeePremiumContent && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 rounded-lg flex flex-col items-center justify-center">
                <Lock className="w-5 h-5 text-slate-400 mb-1" />
                <span className="text-xs text-slate-500">Premium</span>
              </div>
            )}
            {canSeePremiumContent ? (
              certificationsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(certifications || []).slice(0, 10).map(c => (
                    <div
                      key={c.certification}
                      className="px-3 py-2 bg-slate-100 rounded-lg text-sm"
                    >
                      <span className="font-medium text-slate-700">{c.certification}</span>
                      <span className="text-slate-500 ml-2">({c.jobs})</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="flex flex-wrap gap-2">
                {[
                  { cert: 'BLS', count: 2100 },
                  { cert: 'ACLS', count: 1450 },
                  { cert: 'PALS', count: 680 },
                  { cert: 'NRP', count: 320 },
                  { cert: 'TNCC', count: 210 },
                  { cert: 'CCRN', count: 180 },
                  { cert: 'CEN', count: 145 },
                  { cert: 'OCN', count: 98 },
                ].map(c => (
                  <div key={c.cert} className="px-3 py-2 bg-slate-100 rounded-lg text-sm">
                    <span className="font-medium text-slate-700">{c.cert}</span>
                    <span className="text-slate-500 ml-2">({c.count})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Travel Nursing */}
      <div className="bg-gradient-to-r from-primary-50 to-accent-50 rounded-xl border border-primary-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Plane className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-slate-900">Travel Nursing in Virginia</h2>
        </div>
        <div className="relative">
          {!canSeePremiumContent && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 rounded-lg flex flex-col items-center justify-center">
              <Lock className="w-5 h-5 text-slate-400 mb-1" />
              <span className="text-xs text-slate-500">Premium</span>
            </div>
          )}
          {canSeePremiumContent ? (
            travelLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
              </div>
            ) : travelData?.stats ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4">
                  <div className="text-2xl font-bold text-primary-600">{travelData.stats.totalJobs}</div>
                  <div className="text-sm text-slate-500">Travel Positions</div>
                </div>
                {travelData.stats.avgWeeklyPay && (
                  <div className="bg-white rounded-lg p-4">
                    <div className="text-2xl font-bold text-emerald-600">${travelData.stats.avgWeeklyPay.toLocaleString()}</div>
                    <div className="text-sm text-slate-500">Avg Weekly Pay</div>
                  </div>
                )}
                <div className="bg-white rounded-lg p-4">
                  <div className="text-2xl font-bold text-slate-900">{travelData.stats.avgContractWeeks ? `${travelData.stats.avgContractWeeks} weeks` : '13 weeks'}</div>
                  <div className="text-sm text-slate-500">Avg Contract</div>
                </div>
                {travelData.stats.avgHousingStipend && (
                  <div className="bg-white rounded-lg p-4">
                    <div className="text-2xl font-bold text-amber-600">${travelData.stats.avgHousingStipend.toLocaleString()}</div>
                    <div className="text-sm text-slate-500">Avg Housing Stipend</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-500 text-center py-4">No travel nursing data available</div>
            )
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-primary-600">180</div>
                <div className="text-sm text-slate-500">Travel Positions</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-emerald-600">$2,450</div>
                <div className="text-sm text-slate-500">Avg Weekly Pay</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-slate-900">13 weeks</div>
                <div className="text-sm text-slate-500">Avg Contract</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-amber-600">$1,200</div>
                <div className="text-sm text-slate-500">Avg Housing Stipend</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Benefits */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-slate-900">Common Benefits Offered</h2>
        </div>
        <div className="relative">
          {!canSeePremiumContent && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 rounded-lg flex flex-col items-center justify-center">
              <Lock className="w-5 h-5 text-slate-400 mb-1" />
              <span className="text-xs text-slate-500">Premium</span>
            </div>
          )}
          {canSeePremiumContent ? (
            benefitsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(benefits || []).slice(0, 8).map(b => (
                  <div key={b.benefit} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="font-medium text-slate-700">{b.benefit}</span>
                    <span className="text-sm text-slate-500">{Math.round(b.percentage)}%</span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { benefit: 'Health Insurance', pct: 92 },
                { benefit: '401(k)', pct: 85 },
                { benefit: 'PTO', pct: 88 },
                { benefit: 'Tuition Reimbursement', pct: 72 },
                { benefit: 'Sign-on Bonus', pct: 45 },
                { benefit: 'Relocation', pct: 38 },
                { benefit: 'CEU Allowance', pct: 65 },
                { benefit: 'Night Differential', pct: 78 },
              ].map(b => (
                <div key={b.benefit} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700">{b.benefit}</span>
                  <span className="text-sm text-slate-500">{b.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
