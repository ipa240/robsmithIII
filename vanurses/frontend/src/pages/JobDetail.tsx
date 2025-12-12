import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import {
  ArrowLeft, MapPin, Clock, DollarSign, Building2, Bookmark, BookmarkCheck,
  ExternalLink, Calendar, Award, Stethoscope, CheckCircle, Lock, Unlock, Sparkles, Crown, Heart,
  GraduationCap, Briefcase, Gift, Loader2, FileText, MessageCircle, Share2, Copy, Check as CheckIcon
} from 'lucide-react'
import { api } from '../api/client'
import { toTitleCase } from '../utils/format'
import { useJobViewLimit } from '../hooks/useJobViewLimit'
import { useSavedJobLimit } from '../hooks/useSavedJobLimit'
import { useSubscription, isAdminUnlocked } from '../hooks/useSubscription'
import JobSection from '../components/JobSection'
import { NoFilterUnlockModal, NOFILTER_STORAGE_KEY, lockNoFilter } from '../components/NoFilterUnlockModal'

// Format nursing types for display: cna -> "CNA", rn -> "RN"
const formatNursingType = (type: string): string => {
  const formatMap: Record<string, string> = {
    'cna': 'CNA',
    'cnm': 'CNM',
    'crna': 'CRNA',
    'lpn': 'LPN',
    'np': 'NP',
    'rn': 'RN',
  }
  return formatMap[type?.toLowerCase()] || type?.toUpperCase() || type
}

// Format specialties for display: case_management -> "Case Management"
const formatSpecialty = (specialty: string): string => {
  const formatMap: Record<string, string> = {
    'cardiac': 'Cardiac',
    'case_management': 'Case Management',
    'cath_lab': 'Cath Lab',
    'cvor': 'CVOR',
    'dialysis': 'Dialysis',
    'education': 'Education',
    'endo': 'Endoscopy',
    'er': 'Emergency',
    'float': 'Float Pool',
    'general': 'General',
    'home_health': 'Home Health',
    'hospice': 'Hospice',
    'icu': 'ICU',
    'infection_control': 'Infection Control',
    'labor_delivery': 'Labor & Delivery',
    'ltc': 'Long Term Care',
    'med_surg': 'Med/Surg',
    'neuro': 'Neuro',
    'nicu': 'NICU',
    'oncology': 'Oncology',
    'or': 'OR',
    'ortho': 'Orthopedics',
    'outpatient': 'Outpatient',
    'pacu': 'PACU',
    'peds': 'Pediatrics',
    'pre_op': 'Pre-Op',
    'psych': 'Psych',
    'quality': 'Quality',
    'rehab': 'Rehab',
    'skilled_nursing': 'Skilled Nursing',
    'tele': 'Telemetry',
    'travel': 'Travel',
    'wound': 'Wound Care',
  }
  return formatMap[specialty?.toLowerCase()] || specialty?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || specialty
}

// Format employment types for display
const formatEmploymentType = (type: string): string => {
  const formatMap: Record<string, string> = {
    'full_time': 'Full Time',
    'part_time': 'Part Time',
    'prn': 'PRN',
    'travel': 'Travel',
    'contract': 'Contract',
    'temporary': 'Temporary',
  }
  return formatMap[type] || type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || type
}

// Format experience field - can be string or object {type, years}
const formatExperience = (experience: any): string | null => {
  if (!experience) return null
  if (typeof experience === 'string') return experience
  if (typeof experience === 'object') {
    const { type, years } = experience
    if (type && years) return `${years} year${years !== 1 ? 's' : ''} ${type}`
    if (type) return type
    if (years) return `${years} year${years !== 1 ? 's' : ''} experience`
  }
  return null
}

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [showApplyToast, setShowApplyToast] = useState(false)
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'extracted' | 'original'>('extracted')
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [sullyOpinion, setSullyOpinion] = useState<string | null>(null)
  const [sullyLoading, setSullyLoading] = useState(false)
  const [sullyMood, setSullyMood] = useState<'optimistic' | 'neutral' | 'stern' | 'nofilter'>('optimistic')
  const { isPaid, canAccessJobs, isFacilities } = useSubscription()

  // Check if No Filter mode is unlocked (same unlock code as Sully page)
  const [nofilterUnlocked, setNofilterUnlocked] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem(NOFILTER_STORAGE_KEY) === 'true'
  })
  const [showUnlockModal, setShowUnlockModal] = useState(false)

  const handleLockNofilter = () => {
    lockNoFilter()
    setNofilterUnlocked(false)
    if (sullyMood === 'nofilter') {
      setSullyMood('optimistic')
    }
  }

  // Check if user can use NoFilter (requires unlock code OR admin unlocked)
  const canUseNoFilter = nofilterUnlocked || isAdminUnlocked()
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
    if (!auth.isAuthenticated && !isAdminUnlocked()) return

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

  // Share functions
  const getShareUrl = () => `https://vanurses.net/jobs/${id}`
  const getShareText = (job: any) => `Check out this ${job.nursing_type || 'nursing'} job at ${job.facility_name || 'a Virginia hospital'}: ${job.title}`

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl())
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = getShareUrl()
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  const shareToFacebook = (job: any) => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`, '_blank', 'width=600,height=400')
  }

  const shareToTwitter = (job: any) => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText(job))}&url=${encodeURIComponent(getShareUrl())}`, '_blank', 'width=600,height=400')
  }

  const shareToLinkedIn = (job: any) => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getShareUrl())}`, '_blank', 'width=600,height=400')
  }

  const shareViaEmail = (job: any) => {
    window.location.href = `mailto:?subject=${encodeURIComponent(`Nursing Job: ${job.title}`)}&body=${encodeURIComponent(`${getShareText(job)}\n\n${getShareUrl()}`)}`
  }

  // Check if job is saved
  const { data: savedJobs } = useQuery({
    queryKey: ['saved-jobs'],
    queryFn: () => api.get('/api/me/saved-jobs').then(res => res.data.data),
    enabled: auth.isAuthenticated
  })

  const isSaved = Array.isArray(savedJobs) && savedJobs.some((j: { id: string }) => j.id === id)

  // Save job mutation
  const saveMutation = useMutation({
    mutationFn: () => api.post(`/api/me/saved-jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-jobs'] })
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to save job'
      setSaveErrorMessage(message)
      setTimeout(() => setSaveErrorMessage(null), 5000)
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

  // NOTE: On job detail pages, ALL OFS grades are blurred for free users (no top 3 exception)
  // The top 3 exception only applies to the Facilities page

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
        <p className="text-slate-600 mb-4">This job may have been removed or is no longer available.</p>
        <button
          onClick={() => navigate(-1)}
          className="text-primary-600 hover:underline inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    )
  }

  const job = data

  // Check if facilities-only user trying to access jobs
  if (isFacilities && !canAccessJobs) {
    return (
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

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
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

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
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

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
                  {/* Facility Score Badge - blurred for free users on job pages (no top 3 exception) */}
                  {job.facility_ofs_grade && (() => {
                    const canSeeThisScore = (auth.isAuthenticated && isPaid) || isAdminUnlocked()
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
                    {formatNursingType(job.nursing_type)}
                  </span>
                )}
                {job.specialty && (
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full">
                    {formatSpecialty(job.specialty)}
                  </span>
                )}
                {job.employment_type && (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-sm rounded-full">
                    {formatEmploymentType(job.employment_type)}
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
                <button
                  onClick={() => auth.signinRedirect()}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <Bookmark className="w-4 h-4" />
                  Save
                </button>
              )}

              {/* Share Button with Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>

                {/* Share Dropdown Menu */}
                {showShareMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowShareMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-slate-200 shadow-lg z-20 py-2">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <p className="text-xs text-slate-500">Share this job on VANurses</p>
                      </div>
                      <button
                        onClick={() => {
                          copyToClipboard()
                          setShowShareMenu(false)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 text-slate-700"
                      >
                        {linkCopied ? (
                          <>
                            <CheckIcon className="w-4 h-4 text-emerald-500" />
                            <span className="text-emerald-600">Link Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          shareToFacebook(job)
                          setShowShareMenu(false)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 text-slate-700"
                      >
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                        <span>Facebook</span>
                      </button>
                      <button
                        onClick={() => {
                          shareToTwitter(job)
                          setShowShareMenu(false)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 text-slate-700"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        <span>X (Twitter)</span>
                      </button>
                      <button
                        onClick={() => {
                          shareToLinkedIn(job)
                          setShowShareMenu(false)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 text-slate-700"
                      >
                        <svg className="w-4 h-4 text-blue-700" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                        </svg>
                        <span>LinkedIn</span>
                      </button>
                      <button
                        onClick={() => {
                          shareViaEmail(job)
                          setShowShareMenu(false)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 text-slate-700"
                      >
                        <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>Email</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

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
                  <div className="text-slate-600">{formatSpecialty(job.specialty)}</div>
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
                {!sullyOpinion && !sullyLoading && (auth.isAuthenticated || isAdminUnlocked()) && (
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
                        onClick={() => canUseNoFilter ? setSullyMood('nofilter') : setShowUnlockModal(true)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-colors flex items-center gap-1 ${
                          sullyMood === 'nofilter'
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : canUseNoFilter
                              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {!canUseNoFilter && <Lock className="w-3 h-3" />}
                        No Filter
                      </button>
                      {!canUseNoFilter ? (
                        <button
                          onClick={() => setShowUnlockModal(true)}
                          className="text-xs text-primary-600 hover:underline flex items-center gap-1 ml-2"
                        >
                          <Lock className="w-3 h-3" />
                          Unlock
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
                    <p className="text-[10px] text-slate-400 mt-1">
                      {sullyMood === 'optimistic' && 'Encouraging and supportive - finds the positives'}
                      {sullyMood === 'neutral' && 'Objective and balanced - just the facts'}
                      {sullyMood === 'stern' && 'Direct and no-nonsense - tells it like it is'}
                      {sullyMood === 'nofilter' && (canUseNoFilter
                        ? 'Brutally honest - like a veteran nurse after a rough shift'
                        : 'Click to unlock No Filter mode')}
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
                    disabled={!auth.isAuthenticated && !isAdminUnlocked()}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      (auth.isAuthenticated || isAdminUnlocked())
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    Ask Sully
                  </button>
                )}

                {!auth.isAuthenticated && !isAdminUnlocked() && !sullyOpinion && (
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
                  content={formatExperience(enrichedDetails.parsed.experience)}
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

      {/* NoFilter Unlock Modal */}
      <NoFilterUnlockModal
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        onUnlock={() => setNofilterUnlocked(true)}
      />

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

      {/* Save Error Toast */}
      {saveErrorMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-orange-600 text-white px-6 py-4 rounded-xl shadow-lg animate-slide-up z-50 text-center max-w-sm">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Lock className="w-5 h-5" />
            <p className="font-medium">Save limit reached</p>
          </div>
          <p className="text-sm text-orange-100 mb-3">
            Free users can only save 1 job. Upgrade to save more!
          </p>
          <Link
            to="/billing"
            className="inline-block bg-white text-orange-600 font-semibold px-4 py-2 rounded-lg hover:bg-orange-50"
          >
            Upgrade now
          </Link>
        </div>
      )}
    </div>
  )
}
