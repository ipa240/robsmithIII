import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import {
  TrendingUp, TrendingDown, BarChart3,
  Building2, Briefcase, DollarSign,
  ArrowUpRight, ArrowDownRight, Minus, Lock, Loader2, Crown
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
    </div>
  )
}
