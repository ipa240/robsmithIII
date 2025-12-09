import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import {
  TrendingUp, TrendingDown, BarChart3, Calendar, Filter,
  Building2, Briefcase, DollarSign, ChevronUp, ChevronDown,
  ArrowUpRight, ArrowDownRight, Minus, Lock, Loader2
} from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription'
import PremiumGate from '../components/PremiumGate'

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

interface TrendsOverview {
  stats: {
    jobs: number
    jobsChange: number
    avgHourly: number
    payChange: number
    facilities: number
    facilitiesChange: number
    avgGrade: string
  }
  monthly: TrendData[]
}

export default function Trends() {
  const { tier, isPremium } = useSubscription()
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
          <div className="flex border border-slate-300 rounded-lg overflow-hidden">
            {(['3m', '6m', '1y'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1.5 text-sm ${
                  timeframe === t
                    ? 'bg-primary-600 text-white'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

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
          <div className="text-2xl font-bold text-slate-900">
            {overviewLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : `$${stats.avgHourly.toFixed(2)}`}
          </div>
          <div className="text-sm text-slate-500">Avg Hourly Rate</div>
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
            {overviewLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : stats.avgGrade}
          </div>
          <div className="text-sm text-slate-500">Avg Facility Grade</div>
        </div>
      </div>

      {/* Job Posting Trend Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Job Postings Over Time</h2>
        {overviewLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : monthlyTrends.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-500">
            No trend data available for this timeframe
          </div>
        ) : (
          <div className="h-64 flex items-end gap-4">
            {monthlyTrends.map((data, i) => (
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
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Rising Facilities */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <h2 className="font-semibold text-slate-900">Top Rated Facilities</h2>
          </div>
          {risingLoading ? (
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
          )}
        </div>

        {/* Falling Facilities */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-slate-900">Lower Rated Facilities</h2>
          </div>
          {isPremium ? (
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
            <div className="p-8 text-center">
              <Lock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm mb-4">
                See which facilities have lower scores
              </p>
              <PremiumGate feature="Lower Rated Facilities" />
            </div>
          )}
        </div>
      </div>

      {/* Specialty Demand */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Specialty Demand</h2>
        {specialtiesLoading ? (
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
        )}
      </div>

      {/* Premium CTA */}
      {!isPremium && (
        <div className="bg-gradient-to-r from-primary-50 to-accent-50 rounded-xl p-6 text-center">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Unlock Full Analytics
          </h3>
          <p className="text-slate-600 mb-4">
            Get historical data, custom reports, and predictive insights with Premium.
          </p>
          <a
            href="/billing"
            className="inline-flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
          >
            Upgrade to Premium
          </a>
        </div>
      )}
    </div>
  )
}
