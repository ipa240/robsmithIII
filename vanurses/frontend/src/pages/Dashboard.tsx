import { useAuth } from 'react-oidc-context'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Briefcase, Building2, Bookmark, DollarSign, ArrowRight,
  Newspaper, FileCheck, Clock, Send, Lock, Crown, Eye,
  GraduationCap, MessageCircle, ClipboardList
} from 'lucide-react'
import { api, setAuthToken, createAuthenticatedApi } from '../api/client'
import { useEffect, useState } from 'react'
import { useSubscription, isAdminUnlocked } from '../hooks/useSubscription'
import MarketScoreGauge from '../components/dashboard/MarketScoreGauge'
import QuickInsightsBar from '../components/dashboard/QuickInsightsBar'
import PayPercentileWidget from '../components/dashboard/PayPercentileWidget'
import RecommendationRows from '../components/dashboard/RecommendationRows'
import StreakCounter from '../components/dashboard/StreakCounter'
import CompleteOnboardingPrompt from '../components/dashboard/CompleteOnboardingPrompt'
import { SEO } from '../components/SEO'

export default function Dashboard() {
  const auth = useAuth()
  const { isPaid } = useSubscription()
  // Only show premium content if authenticated AND paid
  const canSeePremiumContent = (auth.isAuthenticated && isPaid) || isAdminUnlocked()
  const [sullyMessage, setSullyMessage] = useState('')
  const [tokenReady, setTokenReady] = useState(false)

  // Set auth token for API calls - track when it's done
  useEffect(() => {
    if (auth.user?.access_token) {
      setAuthToken(auth.user.access_token)
      setTokenReady(true)
    } else {
      setTokenReady(false)
    }
  }, [auth.user?.access_token])

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/api/stats').then(res => res.data.data)
  })

  const { data: recentJobs } = useQuery({
    queryKey: ['recent-jobs-diverse'],
    queryFn: () => api.get('/api/jobs/recent-diverse', { params: { limit: 5 } }).then(res => res.data.data)
  })

  const { data: topFacilities } = useQuery({
    queryKey: ['top-facilities'],
    queryFn: () => api.get('/api/facilities', { params: { limit: 5 } }).then(res => res.data.data)
  })

  const { data: savedJobs = [] } = useQuery({
    queryKey: ['saved-jobs'],
    queryFn: () => api.get('/api/me/saved-jobs').then(res => res.data.data || []),
    enabled: tokenReady
  })

  const { data: applications = [] } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => api.get('/api/me/applications').then(res => res.data.data || []),
    enabled: tokenReady
  })

  const { data: newsArticles = [] } = useQuery({
    queryKey: ['news-headlines'],
    queryFn: () => api.get('/api/news', { params: { limit: 3 } }).then(res => res.data.data || [])
  })

  // Query for watched facility jobs (Starter+ feature)
  const { data: watchedFacilityJobs = [] } = useQuery({
    queryKey: ['watched-facility-jobs'],
    queryFn: () => api.get('/api/me/watched-facilities/jobs').then(res => res.data.data || []),
    enabled: tokenReady && canSeePremiumContent
  })

  const { data: trendsOverview } = useQuery({
    queryKey: ['trends-overview'],
    queryFn: () => api.get('/api/trends/overview').then(res => res.data)
  })

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/api/me').then(res => res.data.data),
    enabled: tokenReady
  })

  // New dashboard personalization queries
  const { data: marketScore, isLoading: marketScoreLoading } = useQuery({
    queryKey: ['dashboard', 'market-score'],
    queryFn: () => api.get('/api/dashboard/market-score').then(res => res.data),
    enabled: tokenReady && !!user?.onboarding_completed,
    staleTime: 1000 * 60 * 30
  })

  // Create authenticated API using current token directly (more reliable than global state)
  const accessToken = auth.user?.access_token
  const authApi = createAuthenticatedApi(accessToken || null)

  const { data: quickInsights, isLoading: quickInsightsLoading, isError: quickInsightsError } = useQuery({
    queryKey: ['dashboard', 'quick-insights', !!accessToken],
    queryFn: () => authApi.get('/api/dashboard/quick-insights').then(res => res.data),
    enabled: !!accessToken,
    staleTime: 1000 * 60 * 15
  })

  const { data: payPercentile, isLoading: payPercentileLoading } = useQuery({
    queryKey: ['dashboard', 'pay-percentile'],
    queryFn: () => api.get('/api/dashboard/pay-percentile').then(res => res.data),
    enabled: tokenReady && !!user?.onboarding_completed,
    staleTime: 1000 * 60 * 30
  })

  const { data: recommendations, isLoading: recommendationsLoading } = useQuery({
    queryKey: ['dashboard', 'recommendations'],
    queryFn: () => api.get('/api/dashboard/recommendations').then(res => res.data),
    enabled: tokenReady,
    staleTime: 1000 * 60 * 15
  })

  const { data: streak, isLoading: streakLoading } = useQuery({
    queryKey: ['dashboard', 'streak'],
    queryFn: () => api.get('/api/dashboard/streak').then(res => res.data),
    enabled: tokenReady,
    staleTime: 1000 * 60 * 5
  })

  // Try multiple name sources with fallbacks
  const userName = user?.first_name ||
                   auth.user?.profile?.given_name ||
                   auth.user?.profile?.name?.split(' ')[0] ||
                   auth.user?.profile?.preferred_username?.split('@')[0] ||
                   'there'

  return (
    <div className="space-y-8">
      <SEO
        title="Dashboard"
        description="Your personalized VANurses dashboard. Track job applications, saved positions, and get AI-powered career insights."
        canonical="https://vanurses.net/dashboard"
      />
      {/* Page Header */}
      <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>

      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Welcome back, {userName}!
        </h2>
        <p className="text-slate-600">
          Here's what's happening in Virginia nursing today.
        </p>
      </div>

      {/* Stats Cards - Clickable Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/jobs" className="bg-white rounded-xl border border-slate-200 p-6 hover:border-primary-300 hover:shadow-md transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {stats?.total_jobs?.toLocaleString() || '-'}
              </div>
              <div className="text-sm text-slate-500">Active Jobs</div>
            </div>
          </div>
        </Link>

        <Link to="/facilities" className="bg-white rounded-xl border border-slate-200 p-6 hover:border-emerald-300 hover:shadow-md transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {stats?.total_facilities?.toLocaleString() || '-'}
              </div>
              <div className="text-sm text-slate-500">Facilities</div>
            </div>
          </div>
        </Link>

        <Link to="/saved" className="bg-white rounded-xl border border-slate-200 p-6 hover:border-amber-300 hover:shadow-md transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <Bookmark className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {savedJobs?.length || 0}
              </div>
              <div className="text-sm text-slate-500">Saved Jobs</div>
            </div>
          </div>
        </Link>

        <Link to="/trends" className="bg-white rounded-xl border border-slate-200 p-6 hover:border-purple-300 hover:shadow-md transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              {trendsOverview?.stats?.avgHourlyByType ? (
                <>
                  <div className="text-sm font-bold text-slate-900">
                    Market Rates
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div>RN: ${trendsOverview.stats.avgHourlyByType.rn?.avgHourly?.toFixed(0) || '-'}/hr • LPN: ${trendsOverview.stats.avgHourlyByType.lpn?.avgHourly?.toFixed(0) || '-'}/hr</div>
                    <div>CNA: ${trendsOverview.stats.avgHourlyByType.cna?.avgHourly?.toFixed(0) || '-'}/hr • NP: ${trendsOverview.stats.avgHourlyByType.np?.avgHourly?.toFixed(0) || '-'}/hr</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-slate-900">
                    ${trendsOverview?.stats?.avgHourly?.toFixed(0) || '-'}
                  </div>
                  <div className="text-sm text-slate-500">Avg Hourly</div>
                </>
              )}
            </div>
          </div>
        </Link>
      </div>

      {/* Quick Actions for Authenticated Users */}
      {auth.isAuthenticated && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Saved Jobs */}
            <Link
              to="/saved"
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center transition-colors">
                <Bookmark className="w-6 h-6 text-amber-600" />
              </div>
              <span className="font-medium text-slate-900">{savedJobs?.length || 0}</span>
              <span className="text-sm text-slate-500">Saved Jobs</span>
            </Link>

            {/* Application Tracker */}
            <Link
              to="/applications"
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                <ClipboardList className="w-6 h-6 text-blue-600" />
              </div>
              <span className="font-medium text-slate-900">{applications?.length || 0}</span>
              <span className="text-sm text-slate-500">Applications</span>
            </Link>

            {/* Learning / CEUs */}
            <Link
              to="/learning"
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center transition-colors">
                <GraduationCap className="w-6 h-6 text-emerald-600" />
              </div>
              <span className="font-medium text-slate-900">CEUs</span>
              <span className="text-sm text-slate-500">Learning</span>
            </Link>

            {/* Chat - Coming Soon */}
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 opacity-60 cursor-not-allowed relative">
              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-slate-200 text-slate-500 text-[10px] font-medium rounded">
                Soon
              </div>
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-slate-400" />
              </div>
              <span className="font-medium text-slate-500">-</span>
              <span className="text-sm text-slate-400">Chat</span>
            </div>
          </div>
        </div>
      )}

      {/* Go Back to Jobs Button + Upgrade Banner */}
      {!canSeePremiumContent && (
        <>
          <Link
            to="/jobs"
            className="block w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-xl text-center transition-colors"
          >
            Go Back to Job Page!
          </Link>
          <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-xl p-6 text-white">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Crown className="w-6 h-6" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-lg font-bold">Please support us!</h2>
                <p className="text-primary-100 text-sm">
                  Unlock all dashboard features, facility ratings, map and more for <span className="font-semibold text-white">$9</span>!
                </p>
                <p className="text-primary-200 text-xs mt-1">
                  Built by Virginia nurses, for Virginia nurses
                </p>
              </div>
              <Link
                to="/billing"
                className="px-6 py-2.5 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 flex-shrink-0 flex items-center gap-2"
              >
                <Crown className="w-4 h-4" />
                Support Us
              </Link>
            </div>
          </div>
        </>
      )}

      {/* Personalized Matches CTA - Paid Feature */}
      {canSeePremiumContent && (
        <Link
          to="/results"
          className="block bg-gradient-to-r from-primary-600 to-accent-600 rounded-xl p-6 text-white hover:opacity-95 transition-opacity"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold mb-1">See Your Personalized Matches</h2>
              <p className="text-primary-100">
                Jobs ranked by your priorities • Updated with your preferences
              </p>
            </div>
            <ArrowRight className="w-6 h-6" />
          </div>
        </Link>
      )}

      {/* Personalized Insights Section - Only for authenticated users */}
      {auth.isAuthenticated && (
        <>
          {/* Show onboarding prompt if not completed */}
          {user && !user.onboarding_completed && (
            <CompleteOnboardingPrompt />
          )}

          {/* Streak + Market Score Row - Show loading while user is loading, then show if onboarding completed */}
          {(userLoading || user?.onboarding_completed) && (
            <div className="grid lg:grid-cols-2 gap-6">
              <StreakCounter data={streak} isLoading={streakLoading || userLoading} />
              <MarketScoreGauge data={marketScore} isLoading={marketScoreLoading || userLoading} />
            </div>
          )}

          {/* Quick Insights Bar */}
          {canSeePremiumContent && !!accessToken && (
            <QuickInsightsBar data={quickInsights} isLoading={quickInsightsLoading} isError={quickInsightsError} />
          )}

          {/* Pay Percentile + Recommendations - Show loading while user is loading */}
          {canSeePremiumContent && (userLoading || user?.onboarding_completed) && (
            <div className="grid lg:grid-cols-2 gap-6">
              <PayPercentileWidget data={payPercentile} isLoading={payPercentileLoading || userLoading} />
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Recommended For You</h3>
                <RecommendationRows data={recommendations} isLoading={recommendationsLoading || userLoading} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Recent Jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent Jobs</h2>
          <Link to="/jobs" className="text-primary-600 hover:underline text-sm flex items-center gap-1">
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="relative">
          {!canSeePremiumContent && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 rounded-xl flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                <Lock className="w-6 h-6 text-slate-400" />
              </div>
              <span className="text-xs text-slate-500 bg-white/80 px-2 py-1 rounded">Sample Data</span>
            </div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="space-y-3">
            {canSeePremiumContent ? (
              recentJobs?.map((job: any) => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="block p-4 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900">{job.title}</h3>
                      <div className="text-sm text-slate-500">
                        {job.facility_name || 'Various Facilities'} • {job.city}, {job.state}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {job.nursing_type && (
                        <span className="px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded-full">
                          {job.nursing_type}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              // Placeholder data visible through light blur
              [
                { title: 'ICU Registered Nurse', facility: 'Sentara Norfolk General', location: 'Norfolk, VA', type: 'RN' },
                { title: 'Emergency Room RN', facility: 'VCU Medical Center', location: 'Richmond, VA', type: 'RN' },
                { title: 'Med-Surg Night Shift', facility: 'Inova Fairfax Hospital', location: 'Falls Church, VA', type: 'RN' },
              ].map((job, i) => (
                <div key={i} className="p-4 rounded-lg border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900">{job.title}</h3>
                      <div className="text-sm text-slate-500">
                        {job.facility} • {job.location}
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded-full">
                      {job.type}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Top Facilities */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Top Rated Facilities</h2>
          <Link to="/facilities" className="text-primary-600 hover:underline text-sm flex items-center gap-1">
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="relative">
          {!canSeePremiumContent && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 rounded-xl flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                <Lock className="w-6 h-6 text-slate-400" />
              </div>
              <span className="text-xs text-slate-500 bg-white/80 px-2 py-1 rounded">Sample Data</span>
            </div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="space-y-3">
            {canSeePremiumContent ? (
              topFacilities?.map((facility: any) => (
                <Link
                  key={facility.id}
                  to={`/facilities/${facility.id}`}
                  className="block p-4 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <span className="text-[7px] text-slate-400 uppercase tracking-wider mb-0.5">Score</span>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold ${
                        facility.score?.ofs_grade === 'A' || facility.ofs_grade === 'A' ? 'bg-emerald-500' :
                        facility.score?.ofs_grade === 'B' || facility.ofs_grade === 'B' ? 'bg-blue-500' :
                        facility.score?.ofs_grade === 'C' || facility.ofs_grade === 'C' ? 'bg-amber-500' :
                        facility.score?.ofs_grade === 'D' || facility.ofs_grade === 'D' ? 'bg-orange-500' :
                        facility.score?.ofs_grade === 'F' || facility.ofs_grade === 'F' ? 'bg-red-500' :
                        'bg-slate-400'
                      }`} title="Facility Score">
                        {facility.score?.ofs_grade || facility.ofs_grade || '-'}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900">{facility.name}</h3>
                      <div className="text-sm text-slate-500">
                        {facility.system_name || facility.city}, {facility.state}
                      </div>
                    </div>
                    {facility.job_count > 0 && (
                      <span className="text-sm text-emerald-600">
                        {facility.job_count} jobs
                      </span>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              // Placeholder data visible through light blur
              [
                { name: 'Sentara Norfolk General Hospital', location: 'Norfolk, VA', grade: 'A', jobs: 24 },
                { name: 'VCU Medical Center', location: 'Richmond, VA', grade: 'A', jobs: 18 },
                { name: 'Inova Fairfax Hospital', location: 'Falls Church, VA', grade: 'B', jobs: 31 },
              ].map((facility, i) => (
                <div key={i} className="p-4 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <span className="text-[7px] text-slate-400 uppercase tracking-wider mb-0.5">Score</span>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold ${
                        facility.grade === 'A' ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}>
                        {facility.grade}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900">{facility.name}</h3>
                      <div className="text-sm text-slate-500">{facility.location}</div>
                    </div>
                    <span className="text-sm text-emerald-600">{facility.jobs} jobs</span>
                  </div>
                </div>
              ))
            )}
            </div>
          </div>
        </div>
      </div>

      {/* New Jobs from Watched Facilities - Starter+ Feature */}
      {canSeePremiumContent && watchedFacilityJobs?.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-500" />
              New Jobs from Watched Facilities
            </h2>
            <Link to="/profile" className="text-primary-600 hover:underline text-sm flex items-center gap-1">
              Manage watched
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6">
            <div className="space-y-3">
              {watchedFacilityJobs.slice(0, 5).map((job: any) => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="block p-4 rounded-lg bg-white border border-amber-100 hover:border-amber-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900">{job.title}</h3>
                      <div className="text-sm text-slate-500">
                        {job.facility_name} • {job.city}, {job.state}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.nursing_type && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                          {job.nursing_type}
                        </span>
                      )}
                      {job.posted_at && (
                        <span className="text-xs text-slate-400">
                          {new Date(job.posted_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {watchedFacilityJobs.length > 5 && (
              <div className="mt-4 text-center">
                <Link to="/jobs" className="text-amber-700 hover:underline text-sm">
                  View all {watchedFacilityJobs.length} jobs from watched facilities
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Two Column Bottom Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ask Sully Quick Chat */}
        <div className="bg-gradient-to-br from-primary-50 to-accent-50 rounded-xl border border-primary-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <img
              src="/media/sully/sully-neutral.jpg"
              alt="Sully"
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Ask Sully</h2>
              <p className="text-sm text-slate-500">Your AI nursing career assistant</p>
            </div>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={sullyMessage}
              onChange={(e) => setSullyMessage(e.target.value)}
              placeholder="Ask about jobs, facilities, or pay..."
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && sullyMessage.trim()) {
                  window.location.href = `/sully?q=${encodeURIComponent(sullyMessage)}`
                }
              }}
            />
            <Link
              to={sullyMessage.trim() ? `/sully?q=${encodeURIComponent(sullyMessage)}` : '/sully'}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-1"
            >
              <Send className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {['What hospitals have the best ratings?', 'ICU jobs near Richmond', 'Average RN pay in VA'].map((q) => (
              <Link
                key={q}
                to={`/sully?q=${encodeURIComponent(q)}`}
                className="px-3 py-1 bg-white/70 text-slate-600 text-xs rounded-full hover:bg-white transition-colors"
              >
                {q}
              </Link>
            ))}
          </div>
        </div>

        {/* Application Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Your Applications</h2>
            <Link to="/applications" className="text-primary-600 hover:underline text-sm flex items-center gap-1">
              View all
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {applications?.length === 0 ? (
            <div className="text-center py-6">
              <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No applications yet</p>
              <Link to="/jobs" className="text-primary-600 hover:underline text-sm">
                Browse jobs to apply
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-amber-50 rounded-lg text-center">
                  <div className="text-xl font-bold text-amber-700">
                    {applications?.filter((a: any) => a.status === 'pending').length || 0}
                  </div>
                  <div className="text-xs text-amber-600">Pending</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <div className="text-xl font-bold text-blue-700">
                    {applications?.filter((a: any) => a.status === 'in_review').length || 0}
                  </div>
                  <div className="text-xs text-blue-600">In Review</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg text-center">
                  <div className="text-xl font-bold text-emerald-700">
                    {applications?.filter((a: any) => a.status === 'interview').length || 0}
                  </div>
                  <div className="text-xs text-emerald-600">Interview</div>
                </div>
              </div>
              {applications?.slice(0, 2).map((app: any) => (
                <div key={app.id} className="p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-slate-900 text-sm truncate">{app.job_title}</div>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      app.status === 'in_review' ? 'bg-blue-100 text-blue-700' :
                      app.status === 'interview' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {app.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {new Date(app.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* News Headlines */}
      {newsArticles?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-slate-400" />
              Nursing News
            </h2>
            <Link to="/news" className="text-primary-600 hover:underline text-sm flex items-center gap-1">
              View all
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {newsArticles.map((article: any) => (
              <a
                key={article.id}
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/30 transition-colors"
              >
                <span className="text-xs text-primary-600 font-medium mb-1 block">
                  {article.source}
                </span>
                <h3 className="font-medium text-slate-900 text-sm line-clamp-2 mb-2">
                  {article.title}
                </h3>
                <span className="text-xs text-slate-400">
                  {article.published_at ? new Date(article.published_at).toLocaleDateString() : 'Recent'}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
