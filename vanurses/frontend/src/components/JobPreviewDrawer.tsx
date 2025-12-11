import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { X, MapPin, Clock, DollarSign, Building2, ExternalLink, GraduationCap, Briefcase, Award, Calendar, Gift, Heart, ChevronRight, Loader2, Lock, Crown } from 'lucide-react'
import { api } from '../api/client'
import { toTitleCase } from '../utils/format'
import { useSubscription, isAdminUnlocked } from '../hooks/useSubscription'
import JobSection from './JobSection'

interface Job {
  id: string
  title: string
  facility_id: string
  facility_name: string
  facility_system: string
  facility_ofs_grade: string
  facility_ofs_score: number
  city: string
  state: string
  nursing_type: string
  specialty: string
  employment_type: string
  shift_type: string
  shift_hours: string
  pay_min: number
  pay_max: number
  sign_on_bonus: number
  source_url: string
  posted_at: string
}

interface JobPreviewDrawerProps {
  job: Job | null
  isOpen: boolean
  onClose: () => void
}

// Format employment types for display
const formatEmploymentType = (type: string): string => {
  const formatMap: Record<string, string> = {
    'full_time': 'Full Time',
    'part_time': 'Part Time',
    'prn': 'PRN',
    'travel': 'Travel',
  }
  return formatMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

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

// Grade color helper
const getGradeColor = (grade: string) => {
  const colors: Record<string, string> = {
    'A': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'B': 'bg-blue-100 text-blue-700 border-blue-200',
    'C': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'D': 'bg-orange-100 text-orange-700 border-orange-200',
    'F': 'bg-red-100 text-red-700 border-red-200',
  }
  return colors[grade] || 'bg-slate-100 text-slate-700 border-slate-200'
}

export default function JobPreviewDrawer({ job, isOpen, onClose }: JobPreviewDrawerProps) {
  const auth = useAuth()
  const { isPaid } = useSubscription()
  // Paid users OR admin unlocked can see grades (no top 3 exception on job pages)
  const canSeeGrades = (auth.isAuthenticated && isPaid) || isAdminUnlocked()

  // Fetch enriched job details when drawer is open
  const { data: details, isLoading: detailsLoading } = useQuery({
    queryKey: ['job-details', job?.id],
    queryFn: () => api.get(`/api/jobs/${job?.id}/details`).then(res => res.data.data),
    enabled: isOpen && !!job?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  if (!isOpen || !job) return null

  const parsed = details?.parsed || {}

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-900 truncate">
                {toTitleCase(job.title)}
              </h2>
              {job.facility_name && (
                <Link
                  to={`/facilities/${job.facility_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 text-primary-600 hover:text-primary-700 hover:underline text-sm mt-1"
                >
                  <Building2 className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{toTitleCase(job.facility_name)}</span>
                  {job.facility_ofs_grade && (
                    canSeeGrades ? (
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${getGradeColor(job.facility_ofs_grade[0]).replace(' border-', ' ')}`}>
                        {job.facility_ofs_grade}
                      </span>
                    ) : (
                      <span className="relative px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100">
                        <span className="blur-sm select-none text-slate-400">A+</span>
                        <Lock className="absolute inset-0 m-auto w-2.5 h-2.5 text-slate-400" />
                      </span>
                    )
                  )}
                </Link>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Quick Info Row */}
          <div className="flex flex-wrap gap-2">
            {job.facility_ofs_grade && (
              canSeeGrades ? (
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getGradeColor(job.facility_ofs_grade[0])}`}>
                  {job.facility_ofs_grade} Facility
                </span>
              ) : (
                <Link
                  to="/billing"
                  className="relative px-2.5 py-1 text-xs font-bold rounded-full border border-slate-200 bg-slate-100 flex items-center gap-1 hover:bg-slate-200 transition-colors"
                >
                  <span className="blur-sm select-none text-slate-400">A+</span>
                  <Lock className="w-3 h-3 text-slate-400" />
                  <Crown className="w-3 h-3 text-amber-400" />
                </Link>
              )
            )}
            {job.nursing_type && (
              <span className="px-2.5 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-full">
                {formatNursingType(job.nursing_type)}
              </span>
            )}
            {job.specialty && (
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">
                {formatSpecialty(job.specialty)}
              </span>
            )}
            {job.employment_type && (
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                {formatEmploymentType(job.employment_type)}
              </span>
            )}
          </div>

          {/* Key Details Grid */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg">
            {job.city && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700">{job.city}, {job.state}</span>
              </div>
            )}
            {job.shift_type && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700">{job.shift_type}</span>
              </div>
            )}
            {(job.pay_min || job.pay_max) && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700">
                  {job.pay_min && job.pay_max
                    ? `$${job.pay_min} - $${job.pay_max}/hr`
                    : job.pay_min
                      ? `From $${job.pay_min}/hr`
                      : `Up to $${job.pay_max}/hr`
                  }
                </span>
              </div>
            )}
            {job.posted_at && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700">
                  Posted {new Date(job.posted_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Sign-on Bonus Highlight */}
          {(job.sign_on_bonus || parsed.sign_on_bonus) && (
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-lg">
              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Gift className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-lg font-bold text-emerald-700">
                  ${(job.sign_on_bonus || parsed.sign_on_bonus).toLocaleString()} Sign-On Bonus
                </div>
                <div className="text-xs text-emerald-600">Available for qualified candidates</div>
              </div>
            </div>
          )}

          {/* Loading State for Details */}
          {detailsLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
              <span className="ml-2 text-sm text-slate-500">Loading job details...</span>
            </div>
          )}

          {/* Parsed Sections */}
          {!detailsLoading && (
            <div className="space-y-3">
              <JobSection
                title="About This Role"
                icon={<Briefcase className="w-4 h-4" />}
                content={parsed.summary}
              />

              <JobSection
                title="Education"
                icon={<GraduationCap className="w-4 h-4" />}
                content={parsed.education}
              />

              <JobSection
                title="Experience"
                icon={<Briefcase className="w-4 h-4" />}
                content={formatExperience(parsed.experience)}
              />

              <JobSection
                title="Certifications & Licenses"
                icon={<Award className="w-4 h-4" />}
                content={parsed.certifications}
              />

              <JobSection
                title="Schedule"
                icon={<Clock className="w-4 h-4" />}
                content={parsed.schedule}
              />

              <JobSection
                title="Benefits"
                icon={<Heart className="w-4 h-4" />}
                content={parsed.benefits}
                variant="highlight"
              />
            </div>
          )}

          {/* Raw text fallback if no parsed sections */}
          {!detailsLoading && !parsed.summary && !parsed.education && details?.raw_text && (
            <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
              <h3 className="font-semibold text-slate-700 mb-2">Job Description</h3>
              <p className="text-sm text-slate-600 whitespace-pre-line line-clamp-6">
                {details.raw_text.substring(0, 500)}...
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex gap-3">
          <Link
            to={`/jobs/${job.id}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors"
          >
            View Full Details
            <ChevronRight className="w-4 h-4" />
          </Link>
          {job.source_url && (
            <a
              href={job.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Apply
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </>
  )
}
