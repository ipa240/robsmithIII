import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, ChevronRight, ChevronLeft, Heart, Star, Crown, Sparkles } from 'lucide-react'
import { api, setAuthToken } from '../api/client'

const NURSING_TYPES = ['RN', 'LPN', 'CNA', 'NP', 'CRNA', 'CNM', 'CNS']
const SPECIALTIES = [
  'ICU', 'ER', 'OR', 'Med-Surg', 'Telemetry', 'L&D', 'NICU', 'Peds',
  'Psych', 'Oncology', 'Dialysis', 'Home Health', 'Cardiac', 'Cath Lab',
  'CVOR', 'Hospice', 'LTC', 'Neuro', 'Ortho', 'Outpatient', 'PACU', 'Rehab', 'Wound Care'
]
const CERTIFICATIONS = ['ACLS', 'BLS', 'PALS', 'NRP', 'TNCC', 'CCRN', 'CEN', 'CNOR', 'OCN', 'RNC-OB', 'RNC-NIC']
const EMPLOYMENT_TYPES = ['Full-Time', 'Part-Time', 'PRN', 'Contract', 'Travel', 'Temporary', 'Other']
const SHIFTS = ['Days', 'Nights', 'Evenings', 'Rotating', 'Weekends', '8-Hour', '10-Hour', '12-Hour']

// OFS Index definitions for priority ratings (11 indices)
const OFS_INDICES = [
  { code: 'pci', title: 'Pay & Compensation', desc: 'How important is competitive salary?' },
  { code: 'eri', title: 'Employee Reviews', desc: 'Good work-life balance, management?' },
  { code: 'lssi', title: 'Safety & Security', desc: 'Low crime, safe area?' },
  { code: 'pei', title: 'Patient Experience', desc: 'High patient satisfaction scores?' },
  { code: 'fsi', title: 'Facility Quality', desc: 'Quality ratings, capacity, services?' },
  { code: 'ali', title: 'Amenities & Lifestyle', desc: 'Nearby dining, shopping, gyms?' },
  { code: 'jti', title: 'Job Transparency', desc: 'Clear pay info, benefits disclosed?' },
  { code: 'csi', title: 'Commute', desc: 'Low traffic, easy drive?' },
  { code: 'qli', title: 'Quality of Life', desc: 'Community demographics & livability?' },
  { code: 'oii', title: 'Opportunity Insights', desc: 'Economic mobility, long-term growth?', isNew: true },
  { code: 'cci', title: 'Climate & Weather', desc: 'Pleasant year-round climate?' },
]

const steps = [
  { id: 1, title: 'Welcome' },
  { id: 2, title: 'License' },
  { id: 3, title: 'Experience' },
  { id: 4, title: 'Preferences' },
  { id: 5, title: 'Location' },
  { id: 6, title: 'Priorities' },
  { id: 7, title: 'Complete' },
]

const TIERS = [
  {
    name: 'Free',
    price: 0,
    color: 'slate',
    features: [
      'Browse all jobs',
      'View facility ratings',
      '3 Sully AI chats/day',
      'Basic job search',
    ],
  },
  {
    name: 'Starter',
    price: 9,
    icon: Star,
    color: 'primary',
    features: [
      'Everything in Free',
      '25 Sully AI chats/month',
      '1 preference update',
      'Save unlimited jobs',
    ],
  },
  {
    name: 'Pro',
    price: 19,
    icon: Crown,
    color: 'amber',
    popular: true,
    features: [
      'Everything in Starter',
      '50 Sully AI chats/month',
      '3 preference updates',
      'Personalized job scoring',
      'Priority job matching',
    ],
  },
  {
    name: 'Premium',
    price: 29,
    icon: Sparkles,
    color: 'purple',
    features: [
      'Everything in Pro',
      '100 Sully AI chats/month',
      'Unlimited preference updates',
      'Advanced analytics',
      'Priority support',
    ],
  },
]

// Completion step component with matched jobs count and tier upsell
function OnboardingComplete({ formData }: { formData: any }) {
  const navigate = useNavigate()
  const [selectedTier, setSelectedTier] = useState<string | null>(null)

  // Fetch ALL matched jobs (no filter to avoid 0 count)
  const { data: matchedJobs, isLoading } = useQuery({
    queryKey: ['matched-jobs-preview'],
    queryFn: () => api.get('/api/jobs/matched', { params: { limit: 50 } }).then(res => res.data.data || []),
  })

  // Also get total job count for messaging
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/api/stats').then(res => res.data.data),
  })

  const jobCount = stats?.total_jobs || matchedJobs?.length || 0
  const previewJobs = matchedJobs?.slice(0, 5) || []

  const handleContinue = () => {
    if (selectedTier && selectedTier !== 'Free') {
      // Go to billing with tier pre-selected, then redirect to results after checkout
      navigate(`/billing?plan=${selectedTier.toLowerCase()}&redirect=/results`)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="text-center">
      {/* Congrats Header */}
      <div className="mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <Check className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">You're All Set!</h2>
        {isLoading ? (
          <p className="text-slate-600">Finding jobs for you...</p>
        ) : (
          <p className="text-slate-600">
            We have <span className="font-bold text-primary-600">{jobCount.toLocaleString()}</span> nursing jobs in Virginia ready for you to explore!
          </p>
        )}
      </div>

      {/* Blurred Job Preview Teaser */}
      <div className="mb-6 relative">
        <p className="text-xs text-slate-500 mb-2">Preview of matched jobs:</p>
        <div className="bg-slate-50 rounded-lg p-3 max-h-32 overflow-hidden relative">
          <div className="space-y-2">
            {previewJobs.map((job: any, i: number) => (
              <div key={job.id || i} className={`flex items-center justify-between text-left text-sm p-2 bg-white rounded border border-slate-100 ${i > 1 ? 'blur-sm' : ''}`}>
                <div className="truncate flex-1">
                  <div className="font-medium text-slate-800 truncate">{job.title}</div>
                  <div className="text-xs text-slate-500">{job.facility_name}</div>
                </div>
                {job.facility_score && (
                  <div className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded font-medium">
                    {job.facility_score.ofs_grade}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Fade overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-50 to-transparent"></div>
        </div>
      </div>

      {/* Tier Options - Selectable */}
      <div className="mb-5">
        <p className="text-sm font-medium text-slate-700 mb-3">
          Choose your plan to get started:
        </p>
        <div className="grid grid-cols-2 gap-2">
          {TIERS.map(tier => (
            <button
              key={tier.name}
              onClick={() => setSelectedTier(tier.name)}
              className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                selectedTier === tier.name
                  ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                  : tier.popular
                    ? 'border-amber-400 bg-amber-50 hover:border-amber-500'
                    : tier.price === 0
                      ? 'border-slate-300 bg-slate-50 hover:border-slate-400'
                      : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              {tier.popular && !selectedTier && (
                <div className="absolute -top-2 right-2 px-2 py-0.5 bg-amber-400 text-amber-900 text-[10px] font-medium rounded-full">
                  Best Value
                </div>
              )}
              {selectedTier === tier.name && (
                <div className="absolute -top-2 right-2 px-2 py-0.5 bg-primary-500 text-white text-[10px] font-medium rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> Selected
                </div>
              )}
              <div className="flex items-center gap-2 mb-1">
                {tier.icon && <tier.icon className={`w-4 h-4 ${
                  selectedTier === tier.name ? 'text-primary-600' :
                  tier.color === 'primary' ? 'text-primary-500' :
                  tier.color === 'amber' ? 'text-amber-500' :
                  tier.color === 'purple' ? 'text-purple-500' : 'text-slate-400'
                }`} />}
                <span className="font-semibold text-slate-900 text-sm">{tier.name}</span>
                <span className="ml-auto font-bold text-slate-900">
                  {tier.price === 0 ? 'Free' : `$${tier.price}`}
                  {tier.price > 0 && <span className="text-[10px] text-slate-500 font-normal">/mo</span>}
                </span>
              </div>
              <ul className="text-[11px] text-slate-600 space-y-0.5">
                {tier.features.map(f => (
                  <li key={f} className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={handleContinue}
          disabled={!selectedTier}
          className={`block w-full py-2.5 font-medium rounded-lg transition-all text-sm ${
            selectedTier && selectedTier !== 'Free'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90'
              : selectedTier === 'Free'
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {!selectedTier
            ? 'Select a plan to continue'
            : selectedTier === 'Free'
              ? 'Continue with Free'
              : `Get ${selectedTier} - $${TIERS.find(t => t.name === selectedTier)?.price}/mo`
          }
        </button>
        {selectedTier && selectedTier !== 'Free' && (
          <button
            onClick={() => navigate('/dashboard')}
            className="block w-full py-2 text-slate-500 hover:text-slate-700 text-sm"
          >
            Maybe later, continue with Free
          </button>
        )}
        <p className="text-[11px] text-slate-400">
          You can upgrade anytime from your profile
        </p>
      </div>
    </div>
  )
}

export default function Onboarding() {
  const auth = useAuth()
  const [currentStep, setCurrentStep] = useState(1)

  const [formData, setFormData] = useState({
    // License
    license_type: '',
    license_state: 'VA',
    compact_license: false,
    license_number: '',
    license_expires_at: '',
    nclex_passed: null as boolean | null,

    // Experience
    years_experience: 0,
    specialties: [] as string[],
    certifications: [] as string[],

    // Job preferences
    employment_types: [] as string[],
    shift_preferences: [] as string[],
    childcare_needs: '' as 'onsite' | 'nearby' | 'none' | '',

    // Location
    location_zip: '',

    // OFS Index priorities (1-5 scale, default 3) - all 11 indices
    index_priorities: {
      pci: 3, eri: 3, lssi: 3, pei: 3, fsi: 3,
      ali: 3, jti: 3, csi: 3, qli: 3, oii: 3, cci: 3
    } as Record<string, number>
  })

  useEffect(() => {
    if (auth.user?.access_token) {
      setAuthToken(auth.user.access_token)
    }
  }, [auth.user?.access_token])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put('/api/me/preferences', formData)
      await api.post('/api/me/onboarding/complete')
    }
  })

  const toggleArray = (arr: string[], item: string) => {
    return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item]
  }

  const nextStep = () => {
    if (currentStep < steps.length) {
      // Save preferences when moving from step 6 to step 7 (complete)
      if (currentStep === 6) {
        saveMutation.mutate()
      }
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Progress */}
        <div className="bg-slate-50 px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep > step.id
                    ? 'bg-primary-600 text-white'
                    : currentStep === step.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}>
                  {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 ${
                    currentStep > step.id ? 'bg-primary-600' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {currentStep === 1 && (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Welcome to VANurses!</h2>
              <p className="text-slate-600 mb-6">
                Let's personalize your experience. We'll ask a few questions to
                help match you with the best nursing jobs in Virginia.
              </p>
              <p className="text-sm text-slate-500">This takes about 2 minutes.</p>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Your License</h2>
              <div className="space-y-4">
                {/* NCLEX Question */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Did you pass your NCLEX yet?
                  </label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setFormData(f => ({ ...f, nclex_passed: true }))}
                      className={`px-6 py-2 rounded-lg border ${
                        formData.nclex_passed === true
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setFormData(f => ({ ...f, nclex_passed: false }))}
                      className={`px-6 py-2 rounded-lg border ${
                        formData.nclex_passed === false
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'border-slate-200 hover:border-amber-300'
                      }`}
                    >
                      Not yet
                    </button>
                  </div>
                  {formData.nclex_passed === false && (
                    <p className="mt-2 text-sm text-amber-600">
                      No worries! You can still explore jobs and prepare for your nursing career.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    License Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {NURSING_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => setFormData(f => ({ ...f, license_type: type }))}
                        className={`px-4 py-2 rounded-lg border ${
                          formData.license_type === type
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'border-slate-200 hover:border-primary-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      License Number <span className="text-slate-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.license_number}
                      onChange={e => setFormData(f => ({ ...f, license_number: e.target.value }))}
                      placeholder="e.g., RN-123456"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Expiration Date <span className="text-slate-400">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={formData.license_expires_at}
                      onChange={e => setFormData(f => ({ ...f, license_expires_at: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.compact_license}
                      onChange={e => setFormData(f => ({ ...f, compact_license: e.target.checked }))}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <span className="text-slate-700">I have a Compact License (NLC)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Your Experience</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Years of Experience
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={formData.years_experience}
                    onChange={e => setFormData(f => ({ ...f, years_experience: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="text-center text-lg font-medium text-primary-600">
                    {formData.years_experience} years
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Specialties (select all that apply)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SPECIALTIES.map(s => (
                      <button
                        key={s}
                        onClick={() => setFormData(f => ({ ...f, specialties: toggleArray(f.specialties, s) }))}
                        className={`px-3 py-1.5 rounded-full border text-sm ${
                          formData.specialties.includes(s)
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'border-slate-200 hover:border-primary-300'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Certifications (select all that apply)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CERTIFICATIONS.map(c => (
                      <button
                        key={c}
                        onClick={() => setFormData(f => ({ ...f, certifications: toggleArray(f.certifications, c) }))}
                        className={`px-3 py-1.5 rounded-full border text-sm ${
                          formData.certifications.includes(c)
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Job Preferences</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Employment Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {EMPLOYMENT_TYPES.map(e => (
                      <button
                        key={e}
                        onClick={() => setFormData(f => ({ ...f, employment_types: toggleArray(f.employment_types, e) }))}
                        className={`px-3 py-1.5 rounded-full border text-sm ${
                          formData.employment_types.includes(e)
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'border-slate-200 hover:border-primary-300'
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Preferred Shifts
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SHIFTS.map(s => (
                      <button
                        key={s}
                        onClick={() => setFormData(f => ({ ...f, shift_preferences: toggleArray(f.shift_preferences, s) }))}
                        className={`px-3 py-1.5 rounded-full border text-sm ${
                          formData.shift_preferences.includes(s)
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'border-slate-200 hover:border-primary-300'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Do you need childcare assistance?
                  </label>
                  <p className="text-xs text-slate-500 mb-3">
                    Some facilities offer on-site childcare or are near quality daycare options
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setFormData(f => ({ ...f, childcare_needs: 'onsite' }))}
                      className={`px-4 py-2 rounded-lg border text-sm ${
                        formData.childcare_needs === 'onsite'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'border-slate-200 hover:border-purple-300'
                      }`}
                    >
                      On-site childcare preferred
                    </button>
                    <button
                      onClick={() => setFormData(f => ({ ...f, childcare_needs: 'nearby' }))}
                      className={`px-4 py-2 rounded-lg border text-sm ${
                        formData.childcare_needs === 'nearby'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'border-slate-200 hover:border-purple-300'
                      }`}
                    >
                      Nearby daycare helpful
                    </button>
                    <button
                      onClick={() => setFormData(f => ({ ...f, childcare_needs: 'none' }))}
                      className={`px-4 py-2 rounded-lg border text-sm ${
                        formData.childcare_needs === 'none'
                          ? 'bg-slate-600 text-white border-slate-600'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      No preference
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Your Location</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Where are you located?
                  </label>
                  <input
                    type="text"
                    value={formData.location_zip}
                    onChange={e => setFormData(f => ({ ...f, location_zip: e.target.value }))}
                    placeholder="Enter your zip code or city, state (e.g., 23219 or Richmond, VA)"
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 text-lg"
                  />
                  <p className="mt-2 text-sm text-slate-500">
                    This helps us find jobs near you and calculate commute times.
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">What Matters Most?</h2>
              <p className="text-slate-500 text-sm mb-6">
                Rate how important each factor is to you (tap hearts to rate 1-5)
              </p>
              <div className="space-y-4">
                {OFS_INDICES.map((index: any) => (
                  <div key={index.code} className={`flex items-center justify-between py-2 border-b ${index.isNew ? 'border-sky-200 bg-sky-50/50 -mx-2 px-2 rounded-lg' : 'border-slate-100'}`}>
                    <div className="flex-1">
                      <div className="font-medium text-slate-800 flex items-center gap-2">
                        {index.title}
                        {index.isNew && <span className="text-[10px] px-1.5 py-0.5 bg-sky-500 text-white rounded font-medium">NEW</span>}
                      </div>
                      <div className="text-xs text-slate-500">{index.desc}</div>
                    </div>
                    <div className="flex gap-1 ml-4">
                      {[1, 2, 3, 4, 5].map(rating => (
                        <button
                          key={rating}
                          onClick={() => setFormData(f => ({
                            ...f,
                            index_priorities: { ...f.index_priorities, [index.code]: rating }
                          }))}
                          className="p-1 hover:scale-110 transition-transform"
                        >
                          <Heart
                            className={`w-6 h-6 ${
                              rating <= formData.index_priorities[index.code]
                                ? 'fill-rose-500 text-rose-500'
                                : 'text-slate-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 7 && (
            <OnboardingComplete formData={formData} />
          )}
        </div>

        {/* Actions - hidden on step 7 since OnboardingComplete has its own buttons */}
        {currentStep < 7 && (
          <div className="px-8 py-4 bg-slate-50 border-t flex justify-between">
            {currentStep > 1 ? (
              <button
                onClick={prevStep}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={nextStep}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving...' : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
