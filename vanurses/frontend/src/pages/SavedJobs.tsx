import { useAuth } from 'react-oidc-context'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bookmark, MapPin, Clock, DollarSign, Building2, Crown, AlertCircle, Lock, Sparkles } from 'lucide-react'
import { api, setAuthToken } from '../api/client'
import { useEffect } from 'react'
import { useSubscription } from '../hooks/useSubscription'
import { isAdminUnlocked } from '../hooks/useSubscription'
import { SEO } from '../components/SEO'

// Demo saved jobs for non-authenticated users
const DEMO_SAVED_JOBS = [
  { id: '1', title: 'ICU Registered Nurse', facility_name: 'Sentara Norfolk General', city: 'Norfolk', state: 'VA', shift_type: 'Night 7p-7a', pay_min: 38, nursing_type: 'RN', specialty: 'ICU', saved_at: new Date().toISOString() },
  { id: '2', title: 'Emergency Room RN', facility_name: 'VCU Medical Center', city: 'Richmond', state: 'VA', shift_type: 'Day 7a-7p', pay_min: 42, nursing_type: 'RN', specialty: 'ER', saved_at: new Date().toISOString() },
  { id: '3', title: 'Labor & Delivery Nurse', facility_name: 'Inova Fairfax Hospital', city: 'Falls Church', state: 'VA', shift_type: 'Rotating', pay_min: 40, nursing_type: 'RN', specialty: 'L&D', saved_at: new Date().toISOString() },
]

export default function SavedJobs() {
  const auth = useAuth()
  const { isPaid } = useSubscription()

  useEffect(() => {
    if (auth.user?.access_token) {
      setAuthToken(auth.user.access_token)
    }
  }, [auth.user?.access_token])

  const { data: savedJobs, isLoading } = useQuery({
    queryKey: ['saved-jobs'],
    queryFn: () => api.get('/api/me/saved-jobs').then(res => res.data.data),
    enabled: !!auth.user?.access_token
  })

  const FREE_LIMIT = 1
  const savedCount = savedJobs?.length || 0
  const atLimit = !isPaid && savedCount >= FREE_LIMIT

  // Show demo for non-authenticated users
  if (!auth.isAuthenticated && !isAdminUnlocked()) {
    return (
      <div className="space-y-6">
        <SEO
          title="Saved Jobs"
          description="View and manage your saved nursing jobs on VANurses. Track positions you're interested in and apply when ready."
          canonical="https://vanurses.net/saved"
        />
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Saved Jobs</h1>
          <p className="text-slate-600">Keep track of jobs you're interested in</p>
        </div>

        {/* Sign Up CTA */}
        <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-xl p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Bookmark className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2">Save Jobs You Love</h2>
              <p className="text-primary-100 mb-4">
                Create a free account to save jobs and never lose track of opportunities.
                <strong className="text-white"> Free users can save 1 job!</strong>
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => auth.signinRedirect()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50"
                >
                  <Sparkles className="w-4 h-4" />
                  Create Free Account
                </button>
                <button
                  onClick={() => auth.signinRedirect()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-white/50 text-white rounded-lg font-medium hover:bg-white/10"
                >
                  Already have an account? Log In
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Demo Preview - Blurred */}
        <div className="relative">
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 rounded-xl flex items-center justify-center">
            <div className="text-center p-8">
              <Lock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Your Saved Jobs</h3>
              <p className="text-slate-600 mb-4 max-w-md">
                Sign up to save jobs and access them anytime. Free accounts can save 1 job.
              </p>
              <button
                onClick={() => auth.signinRedirect()}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Sign Up Free
              </button>
            </div>
          </div>

          {/* Demo Jobs */}
          <div className="space-y-4 opacity-50">
            {DEMO_SAVED_JOBS.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-xl border border-slate-200 p-6"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">{job.title}</h3>
                    <div className="flex items-center gap-2 text-primary-600 mb-3">
                      <Building2 className="w-4 h-4" />
                      <span className="font-medium">{job.facility_name}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.city}, {job.state}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {job.shift_type}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${job.pay_min}/hr
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-primary-50 text-primary-700 text-sm rounded-full">
                      {job.nursing_type}
                    </span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full">
                      {job.specialty}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SEO
        title="Saved Jobs"
        description="View and manage your saved nursing jobs on VANurses. Track positions you're interested in and apply when ready."
        canonical="https://vanurses.net/saved"
      />
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Saved Jobs</h1>
        <p className="text-slate-600">
          {savedCount} job{savedCount !== 1 ? 's' : ''} saved
          {!isPaid && <span className="text-slate-400"> (Free limit: {FREE_LIMIT})</span>}
        </p>
      </div>

      {/* Upgrade Banner for Free Users */}
      {!isPaid && (
        <div className={`rounded-xl p-5 ${atLimit ? 'bg-amber-50 border border-amber-200' : 'bg-primary-50 border border-primary-200'}`}>
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${atLimit ? 'bg-amber-100' : 'bg-primary-100'}`}>
              {atLimit ? <AlertCircle className="w-5 h-5 text-amber-600" /> : <Crown className="w-5 h-5 text-primary-600" />}
            </div>
            <div className="flex-1">
              <h3 className={`font-semibold ${atLimit ? 'text-amber-900' : 'text-primary-900'}`}>
                {atLimit ? "You've reached your free limit" : 'Save unlimited jobs with Pro'}
              </h3>
              <p className={`text-sm mt-1 ${atLimit ? 'text-amber-700' : 'text-primary-700'}`}>
                {atLimit
                  ? `Free accounts can only save ${FREE_LIMIT} job. Upgrade to save unlimited jobs and never lose track of opportunities.`
                  : 'Upgrade to Pro to save unlimited jobs, get alerts, and track all your opportunities in one place.'
                }
              </p>
              <Link
                to="/billing"
                className={`inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg font-medium text-sm ${
                  atLimit
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                <Crown className="w-4 h-4" />
                Upgrade to Pro - $9/mo
              </Link>
            </div>
          </div>
        </div>
      )}

      {!savedJobs || savedJobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Bookmark className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No saved jobs yet</h3>
          <p className="text-slate-500 mb-4">
            Browse jobs and click the save button to add them here.
          </p>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Browse Jobs
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {savedJobs.map((job: any) => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className="block bg-white rounded-xl border border-slate-200 p-6 hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {job.title}
                  </h3>

                  {job.facility_name && (
                    <div className="flex items-center gap-2 text-primary-600 mb-3">
                      <Building2 className="w-4 h-4" />
                      <span className="font-medium">{job.facility_name}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    {job.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.city}, {job.state}
                      </span>
                    )}
                    {job.shift_type && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {job.shift_type}
                      </span>
                    )}
                    {(job.pay_min || job.pay_max) && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${job.pay_min?.toLocaleString() || job.pay_max?.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {job.nursing_type && (
                    <span className="px-3 py-1 bg-primary-50 text-primary-700 text-sm rounded-full">
                      {job.nursing_type}
                    </span>
                  )}
                  {job.specialty && (
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full">
                      {job.specialty}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-400">
                Saved {new Date(job.saved_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
