import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import {
  ArrowLeft, MapPin, Clock, DollarSign, Building2, Bookmark, BookmarkCheck,
  ExternalLink, Calendar, Award, Stethoscope, CheckCircle, Lock, Sparkles, Crown
} from 'lucide-react'
import { api } from '../api/client'
import { toTitleCase } from '../utils/format'
import { useJobViewLimit } from '../hooks/useJobViewLimit'
import { useSavedJobLimit } from '../hooks/useSavedJobLimit'
import { useSubscription } from '../hooks/useSubscription'

export default function JobDetail() {
  const { id } = useParams()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [showApplyToast, setShowApplyToast] = useState(false)
  const { isPaid } = useSubscription()
  const { canView, recordView, remainingViews, limitReached, hasViewed } = useJobViewLimit()
  const { canSave: canSaveJob, limitReached: saveLimitReached } = useSavedJobLimit()

  // Record job view when component mounts (only if user can view)
  useEffect(() => {
    if (id && canView(id)) {
      recordView(id)
    }
  }, [id, canView, recordView])

  // Track apply click mutation
  const trackApplyMutation = useMutation({
    mutationFn: (data: { job_id: string; job_title: string; facility_name: string; facility_city: string }) =>
      api.post('/api/applications/track-click', data),
    onSuccess: () => {
      setShowApplyToast(true)
      setTimeout(() => setShowApplyToast(false), 5000)
      queryClient.invalidateQueries({ queryKey: ['applications'] })
    }
  })

  const handleApplyClick = (job: any) => {
    // Track the click before opening external link
    if (auth.isAuthenticated) {
      trackApplyMutation.mutate({
        job_id: job.id,
        job_title: job.title,
        facility_name: job.facility_name || 'Unknown Facility',
        facility_city: job.city || ''
      })
    }
    // Open the external link
    window.open(job.source_url, '_blank', 'noopener,noreferrer')
  }

  // Check if job is saved
  const { data: savedJobs } = useQuery({
    queryKey: ['saved-jobs'],
    queryFn: () => api.get('/api/me/saved-jobs').then(res => res.data.data),
    enabled: auth.isAuthenticated
  })

  const isSaved = savedJobs?.some((j: { id: string }) => j.id === id)

  // Save job mutation
  const saveMutation = useMutation({
    mutationFn: () => api.post(`/api/me/saved-jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-jobs'] })
    }
  })

  // Unsave job mutation
  const unsaveMutation = useMutation({
    mutationFn: () => api.delete(`/api/me/saved-jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-jobs'] })
    }
  })

  const handleToggleSave = () => {
    if (isSaved) {
      unsaveMutation.mutate()
    } else {
      saveMutation.mutate()
    }
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.get(`/api/jobs/${id}`).then(res => res.data.data)
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Job Not Found</h2>
        <Link to="/jobs" className="text-primary-600 hover:underline">
          Back to Jobs
        </Link>
      </div>
    )
  }

  const job = data

  // Check if user can view this job (already viewed or under limit)
  const canViewThisJob = id ? canView(id) : true
  const alreadyViewed = id ? hasViewed(id) : false

  // Only paid authenticated users can bypass limits
  const hasPaidAccess = auth.isAuthenticated && isPaid

  // If limit reached and this job hasn't been viewed before, show upgrade prompt
  if (!canViewThisJob && !alreadyViewed && !hasPaidAccess) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Jobs
        </Link>

        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-600 mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            You've reached your free job view limit
          </h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Free users can view up to 3 job details. You've viewed all 3 of your free jobs.
            Upgrade to unlock unlimited job views and much more.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {!auth.isAuthenticated ? (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
              >
                <Sparkles className="w-5 h-5" />
                Create Free Account
              </Link>
            ) : (
              <Link
                to="/billing"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
              >
                <Crown className="w-5 h-5" />
                Upgrade Now
              </Link>
            )}
            <Link
              to="/jobs"
              className="text-slate-600 hover:text-slate-900"
            >
              Browse other jobs
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Jobs
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">{toTitleCase(job.title)}</h1>
              {job.facility_name && (
                <Link
                  to={`/facilities/${job.facility_id}`}
                  className="flex items-center gap-2 text-primary-600 hover:underline mb-3"
                >
                  <Building2 className="w-5 h-5" />
                  <span className="font-medium">{toTitleCase(job.facility_name)}</span>
                  {job.facility_system && (
                    <span className="text-slate-400">• {toTitleCase(job.facility_system)}</span>
                  )}
                </Link>
              )}
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
                {job.employment_type && (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-sm rounded-full">
                    {job.employment_type}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              {auth.isAuthenticated ? (
                <button
                  onClick={handleToggleSave}
                  disabled={saveMutation.isPending || unsaveMutation.isPending || (!isSaved && saveLimitReached)}
                  title={!isSaved && saveLimitReached ? 'Upgrade to save more jobs' : undefined}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                    isSaved
                      ? 'bg-primary-50 border-primary-200 text-primary-700 hover:bg-primary-100'
                      : saveLimitReached
                        ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                        : 'border-slate-200 hover:bg-slate-50'
                  } ${(saveMutation.isPending || unsaveMutation.isPending) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSaved ? (
                    <>
                      <BookmarkCheck className="w-4 h-4" />
                      Saved
                    </>
                  ) : saveLimitReached ? (
                    <>
                      <Lock className="w-4 h-4" />
                      Save Limit
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <Bookmark className="w-4 h-4" />
                  Save
                </Link>
              )}
              {job.source_url && (
                <button
                  onClick={() => handleApplyClick(job)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Apply Now
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="p-6 grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            {job.city && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Location</div>
                  <div className="text-slate-600">{job.city}, {job.state} {job.zip}</div>
                </div>
              </div>
            )}

            {job.shift_type && (
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Schedule</div>
                  <div className="text-slate-600">
                    {job.shift_type}
                    {job.shift_hours && ` • ${job.shift_hours}`}
                  </div>
                </div>
              </div>
            )}

            {(job.pay_min || job.pay_max) && (
              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Compensation</div>
                  <div className="text-slate-600">
                    {job.pay_min && job.pay_max
                      ? `$${job.pay_min.toLocaleString()} - $${job.pay_max.toLocaleString()}`
                      : job.pay_min
                        ? `From $${job.pay_min.toLocaleString()}`
                        : `Up to $${job.pay_max.toLocaleString()}`
                    }
                    {job.sign_on_bonus && (
                      <span className="ml-2 text-emerald-600">
                        + ${job.sign_on_bonus.toLocaleString()} sign-on
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {job.posted_at && (
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Posted</div>
                  <div className="text-slate-600">
                    {new Date(job.posted_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            )}

            {job.experience_required && (
              <div className="flex items-start gap-3">
                <Award className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Experience</div>
                  <div className="text-slate-600">{job.experience_required}</div>
                </div>
              </div>
            )}

            {job.specialty && (
              <div className="flex items-start gap-3">
                <Stethoscope className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Specialty</div>
                  <div className="text-slate-600">{job.specialty}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {job.description && (
          <div className="p-6 border-t border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Job Description</h2>
            <div className="prose prose-slate max-w-none">
              <p className="whitespace-pre-wrap text-slate-600">{job.description}</p>
            </div>
          </div>
        )}
      </div>

      {/* Apply Tracking Toast */}
      {showApplyToast && (
        <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up z-50">
          <CheckCircle className="w-6 h-6" />
          <div>
            <p className="font-medium">Application tracked!</p>
            <p className="text-sm text-emerald-100">
              Update your status in <Link to="/applications" className="underline">Applications</Link> after applying.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
