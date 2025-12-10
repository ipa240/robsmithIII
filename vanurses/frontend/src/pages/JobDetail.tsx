import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import {
  ArrowLeft, MapPin, Clock, DollarSign, Building2, Bookmark, BookmarkCheck,
  ExternalLink, Calendar, Award, Stethoscope, CheckCircle, Lock, Sparkles, Crown, Heart,
  GraduationCap, Briefcase, Gift, Loader2, FileText, MessageCircle
} from 'lucide-react'
import { api } from '../api/client'
import { toTitleCase } from '../utils/format'
import { useJobViewLimit } from '../hooks/useJobViewLimit'
import { useSavedJobLimit } from '../hooks/useSavedJobLimit'
import { useSubscription, isAdminUnlocked } from '../hooks/useSubscription'
import JobSection from '../components/JobSection'

export default function JobDetail() {
  const { id } = useParams()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [showApplyToast, setShowApplyToast] = useState(false)
  const [viewMode, setViewMode] = useState<'extracted' | 'original'>('extracted')
  const [sullyOpinion, setSullyOpinion] = useState<string | null>(null)
  const [sullyLoading, setSullyLoading] = useState(false)
  const [sullyMood, setSullyMood] = useState<'optimistic' | 'neutral' | 'stern' | 'nofilter'>('optimistic')
  const { isPaid, canAccessJobs, isFacilities } = useSubscription()
  const { canView, recordView, remainingViews, limitReached, hasViewed } = useJobViewLimit()
  const { canSave: canSaveJob, limitReached: saveLimitReached } = useSavedJobLimit()

  // Record job view when component mounts (only if user can view)
  useEffect(() => {
    if (id && canView(id)) {
      recordView(id)
    }
  }, [id, canView, recordView])

  // Ask Sully for her opinion on this job
  const askSullyOpinion = async (job: any, mood: string = 'optimistic') => {
    if (!auth.isAuthenticated) return

    setSullyLoading(true)
    setSullyOpinion(null)

    try {
      const response = await api.post('/api/sully/job-opinion', {
        job_id: job.id,
        job_title: job.title,
        facility_name: job.facility_name,
        city: job.city,
        specialty: job.specialty,
        nursing_type: job.nursing_type,
        shift_type: job.shift_type,
        employment_type: job.employment_type,
        mood: mood
      })
      setSullyOpinion(response.data.opinion)
    } catch (error: any) {
      console.error('Error getting Sully opinion:', error)
      if (error.response?.data?.detail) {
        setSullyOpinion(error.response.data.detail)
      } else {
        setSullyOpinion('Sorry, I had trouble analyzing this job. Please try again.')
      }
    } finally {
      setSullyLoading(false)
    }
  }

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

  // Fetch enriched job details (parsed sections)
  const { data: enrichedDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['job-details', id],
    queryFn: () => api.get(`/api/jobs/${id}/details`).then(res => res.data.data),
    enabled: !!data && !!id, // Only fetch after main job data loads
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Get top 3 facilities for free score visibility
  const { data: topFacilities } = useQuery({
    queryKey: ['top-facilities-for-free'],
    queryFn: () => api.get('/api/facilities', { params: { limit: 3 } }).then(res => res.data.data)
  })

  // Set of top 3 facility IDs - free users can see scores for these
  const top3FacilityIds = new Set((topFacilities || []).map((f: any) => f.id))

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

  // Check if facilities-only user trying to access jobs
  if (isFacilities && !canAccessJobs) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link
          to="/facilities"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Facilities
        </Link>

        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-100 text-rose-600 mb-4">
            <Heart className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Your plan is for facility research
          </h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            The Facilities plan ($5/mo) is designed for researching nursing homes and hospitals.
            To view job details, upgrade to our Starter plan.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/billing"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              <Crown className="w-5 h-5" />
              Upgrade to Starter - $9/mo
            </Link>
            <Link
              to="/facilities"
              className="text-slate-600 hover:text-slate-900"
            >
              Browse facilities instead
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Check if user can view this job (already viewed or under limit)
  const canViewThisJob = id ? canView(id) : true
  const alreadyViewed = id ? hasViewed(id) : false

  // Only paid authenticated users can bypass limits
  const hasPaidAccess = (auth.isAuthenticated && isPaid) || isAdminUnlocked()

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
            {(!auth.isAuthenticated && !isAdminUnlocked()) ? (
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
                <div className="flex items-center gap-3 mb-3">
                  <Link
                    to={`/facilities/${job.facility_id}`}
                    className="flex items-center gap-2 text-primary-600 hover:underline"
                  >
                    <Building2 className="w-5 h-5" />
                    <span className="font-medium">{toTitleCase(job.facility_name)}</span>
                    {job.facility_system && (
                      <span className="text-slate-400">• {toTitleCase(job.facility_system)}</span>
                    )}
                  </Link>
                  {/* Facility Score Badge */}
                  {job.facility_ofs_grade && (() => {
                    const canSeeThisScore = ((auth.isAuthenticated && isPaid) || isAdminUnlocked()) || top3FacilityIds.has(job.facility_id)
                    return canSeeThisScore ? (
                      <div className="flex flex-col items-center" title="Facility Score based on 10 indices">
                        <span className="text-[8px] text-slate-400 uppercase tracking-wider leading-tight">Facility Score</span>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                          job.facility_ofs_grade.startsWith('A') ? 'bg-emerald-100 text-emerald-700' :
                          job.facility_ofs_grade.startsWith('B') ? 'bg-blue-100 text-blue-700' :
                          job.facility_ofs_grade.startsWith('C') ? 'bg-yellow-100 text-yellow-700' :
                          job.facility_ofs_grade.startsWith('D') ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {job.facility_ofs_grade}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center" title="Upgrade to view Facility Score">
                        <span className="text-[8px] text-slate-400 uppercase tracking-wider leading-tight">Facility Score</span>
                        <span className="relative px-2 py-0.5 text-xs font-bold rounded bg-slate-100">
                          <span className="blur-sm select-none text-slate-400">A+</span>
                          <Lock className="absolute inset-0 m-auto w-3 h-3 text-slate-400" />
                        </span>
                      </div>
                    )
                  })()}
                </div>
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

            {(job.pay_min || job.pay_max) ? (
              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Compensation</div>
                  {((auth.isAuthenticated && isPaid) || isAdminUnlocked()) ? (
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
                  ) : (
                    <div className="relative">
                      <div className="blur-sm select-none text-slate-500">
                        $65,000 - $95,000/year
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                        <Lock className="w-3 h-3" />
                        <Link to="/billing" className="text-primary-500 hover:underline">
                          Upgrade to view salary data
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : job.market_rate ? (
              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Compensation</div>
                  {((auth.isAuthenticated && isPaid) || isAdminUnlocked()) ? (
                    <>
                      <div className="text-slate-500">
                        ${job.market_rate.min} - ${job.market_rate.max}/hr
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Market rate for {job.market_rate.occupation} in {job.market_rate.area}
                      </div>
                    </>
                  ) : (
                    <div className="relative">
                      <div className="blur-sm select-none text-slate-500">
                        $32.50 - $48.75/hr
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                        <Lock className="w-3 h-3" />
                        <Link to="/billing" className="text-primary-500 hover:underline">
                          Upgrade to view market rates
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
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

        {/* Sign-on Bonus Highlight */}
        {(job.sign_on_bonus || enrichedDetails?.parsed?.sign_on_bonus) && (
          <div className="mx-6 mt-6 flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl">
            <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-700">
                ${(job.sign_on_bonus || enrichedDetails?.parsed?.sign_on_bonus).toLocaleString()} Sign-On Bonus
              </div>
              <div className="text-sm text-emerald-600">Available for qualified candidates</div>
            </div>
          </div>
        )}

        {/* Sully's Opinion Section */}
        <div className="p-6 border-t border-slate-200">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <img
                src={`/media/sully/sully-${sullyMood === 'nofilter' ? 'nofilter' : sullyMood === 'stern' ? 'stern' : sullyMood === 'neutral' ? 'neutral' : 'optimistic'}.jpg`}
                alt="Sully"
                className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-indigo-200"
              />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">What does Sully think?</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Sully is your AI career assistant. She'll review this job against your profile preferences
                  and share her thoughts. <span className="text-slate-500 italic">AI-generated insights - always verify details with the employer.</span>
                </p>

                {/* Personality Selection */}
                {!sullyOpinion && !sullyLoading && auth.isAuthenticated && (
                  <div className="mb-4">
                    <p className="text-xs text-slate-500 mb-2">Choose Sully's personality:</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSullyMood('optimistic')}
                        className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                          sullyMood === 'optimistic'
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Optimistic
                      </button>
                      <button
                        onClick={() => setSullyMood('neutral')}
                        className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                          sullyMood === 'neutral'
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Balanced
                      </button>
                      <button
                        onClick={() => setSullyMood('stern')}
                        className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                          sullyMood === 'stern'
                            ? 'bg-orange-100 text-orange-700 border border-orange-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Straight Talk
                      </button>
                      <button
                        onClick={() => setSullyMood('nofilter')}
                        className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                          sullyMood === 'nofilter'
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        title="Pro subscription required"
                      >
                        No Filter
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {sullyMood === 'optimistic' && 'Encouraging and supportive - finds the positives'}
                      {sullyMood === 'neutral' && 'Objective and balanced - just the facts'}
                      {sullyMood === 'stern' && 'Direct and no-nonsense - tells it like it is'}
                      {sullyMood === 'nofilter' && 'Brutally honest - like a veteran nurse after a rough shift (Pro only)'}
                    </p>
                  </div>
                )}

                {sullyOpinion ? (
                  <div className="bg-white rounded-lg p-4 border border-indigo-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-medium text-indigo-700">
                          Sully says ({sullyMood === 'nofilter' ? 'No Filter' : sullyMood === 'stern' ? 'Straight Talk' : sullyMood === 'neutral' ? 'Balanced' : 'Optimistic'}):
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setSullyOpinion(null)
                        }}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Ask again
                      </button>
                    </div>
                    <p className="text-slate-700">{sullyOpinion}</p>
                  </div>
                ) : sullyLoading ? (
                  <div className="flex items-center gap-3 text-indigo-600">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sully is analyzing this job...</span>
                  </div>
                ) : (
                  <button
                    onClick={() => askSullyOpinion(job, sullyMood)}
                    disabled={!auth.isAuthenticated}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      auth.isAuthenticated
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    Ask Sully
                  </button>
                )}

                {!auth.isAuthenticated && !sullyOpinion && (
                  <p className="text-xs text-slate-500 mt-2">
                    <Link to="/login" className="text-indigo-600 hover:underline">Sign in</Link> to get Sully's personalized opinion
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Job Details Section with Toggle */}
        <div className="p-6 border-t border-slate-200">
          {/* View Mode Toggle */}
          {(enrichedDetails?.parsed && Object.values(enrichedDetails.parsed).some(v => v)) && (enrichedDetails?.raw_text || job.description) && (
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setViewMode('extracted')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'extracted'
                    ? 'bg-primary-100 text-primary-700 border border-primary-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                AI Summary
              </button>
              <button
                onClick={() => setViewMode('original')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'original'
                    ? 'bg-primary-100 text-primary-700 border border-primary-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                Original Posting
              </button>
            </div>
          )}

          {detailsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
              <span className="ml-2 text-sm text-slate-500">Loading job details...</span>
            </div>
          ) : viewMode === 'extracted' && enrichedDetails?.parsed && Object.values(enrichedDetails.parsed).some(v => v) ? (
            <>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Job Details</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <JobSection
                  title="About This Role"
                  icon={<Briefcase className="w-4 h-4" />}
                  content={enrichedDetails.parsed.summary}
                />
                <JobSection
                  title="Education"
                  icon={<GraduationCap className="w-4 h-4" />}
                  content={enrichedDetails.parsed.education}
                />
                <JobSection
                  title="Experience Required"
                  icon={<Briefcase className="w-4 h-4" />}
                  content={enrichedDetails.parsed.experience}
                />
                <JobSection
                  title="Certifications & Licenses"
                  icon={<Award className="w-4 h-4" />}
                  content={enrichedDetails.parsed.certifications}
                />
                <JobSection
                  title="Schedule"
                  icon={<Clock className="w-4 h-4" />}
                  content={enrichedDetails.parsed.schedule}
                />
                <div className="md:col-span-2">
                  <JobSection
                    title="Benefits"
                    icon={<Heart className="w-4 h-4" />}
                    content={enrichedDetails.parsed.benefits}
                    variant="highlight"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                {viewMode === 'original' ? 'Original Job Posting' : 'Job Description'}
              </h2>
              <div className="prose prose-slate max-w-none bg-slate-50 rounded-lg p-4">
                <p className="whitespace-pre-wrap text-slate-600">
                  {enrichedDetails?.raw_text || job.description || 'No description available.'}
                </p>
              </div>
            </>
          )}
        </div>
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
