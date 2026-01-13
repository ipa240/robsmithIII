import { useAuth } from 'react-oidc-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  User, Mail, Shield, Heart, MapPin, Briefcase, Award,
  Edit2, Check, X, Lock, Crown, Trash2, AlertTriangle, Eye, Building2, Loader2, ClipboardList, Search, Users, Bell, MessageSquare
} from 'lucide-react'
import { api, setAuthToken } from '../api/client'
import { SEO } from '../components/SEO'

// OFS Index definitions (10 total indices)
const OFS_INDICES = [
  { code: 'pci', title: 'Pay & Compensation', desc: 'Competitive salary importance' },
  { code: 'ali', title: 'Amenities & Lifestyle', desc: 'Nearby dining, shopping, gyms' },
  { code: 'csi', title: 'Commute', desc: 'Low traffic, easy drive' },
  { code: 'cci', title: 'Climate & Weather', desc: 'Pleasant year-round climate' },
  { code: 'lssi', title: 'Safety & Security', desc: 'Low crime, safe area' },
  { code: 'qli', title: 'Quality of Life', desc: 'Community livability' },
  { code: 'pei', title: 'Patient Experience', desc: 'Patient satisfaction scores' },
  { code: 'fsi', title: 'Facility Quality', desc: 'Facility ratings & services' },
  { code: 'eri', title: 'Employee Reviews', desc: 'Nurse satisfaction ratings' },
  { code: 'jti', title: 'Job Transparency', desc: 'Clear job posting details' },
]

const TIER_LIMITS: Record<string, number> = {
  free: 0,
  basic: 2,
  pro: 3,
  premium: 999
}

// Forum categories for email notification preferences
const FORUM_CATEGORIES = [
  { id: 'b824c386-c03c-4d11-81af-42722c7980e1', slug: 'general', name: 'General Discussion' },
  { id: 'c5c30212-6e15-468f-a308-976115d559b7', slug: 'virginia', name: 'Virginia Nurses' },
  { id: '57d18414-eb7f-4567-8fdc-79aae510b6ef', slug: 'icu', name: 'ICU/Critical Care' },
  { id: 'c4c192b5-9797-4530-a295-97f7cc7c18ec', slug: 'career', name: 'Career Advice' },
  { id: '9f753707-6125-4887-a70d-9bd44d27d4c4', slug: 'new-nurses', name: 'New Nurses' },
  { id: '77fd3eef-0ba4-4a3a-9f8f-ebe067871c8c', slug: 'travel', name: 'Travel Nursing' },
  { id: '9ce4926a-d675-4d82-87ec-3802f615d6af', slug: 'facility-reviews', name: 'Facility Reviews' },
]

export default function Profile() {
  const auth = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editingPrefs, setEditingPrefs] = useState(false)

  // Redirect to login if not authenticated
  if (!auth.isAuthenticated && !auth.isLoading) {
    auth.signinRedirect()
    return null
  }
  const [priorities, setPriorities] = useState<Record<string, number>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingZip, setEditingZip] = useState(false)
  const [zipCode, setZipCode] = useState('')

  // Employment & Directory state
  const [editingEmployment, setEditingEmployment] = useState(false)
  const [facilitySearch, setFacilitySearch] = useState('')
  const [showFacilityDropdown, setShowFacilityDropdown] = useState(false)
  const [selectedFacility, setSelectedFacility] = useState<{ id: string; name: string } | null>(null)
  const [isOtherFacility, setIsOtherFacility] = useState(false)
  const [employerName, setEmployerName] = useState('')
  const [directoryOptIn, setDirectoryOptIn] = useState(false)
  const [directoryDisplayName, setDirectoryDisplayName] = useState('')

  // Email notification state
  const [editingNotifications, setEditingNotifications] = useState(false)
  const [forumAlertsEnabled, setForumAlertsEnabled] = useState(true)
  const [forwardChatsEnabled, setForwardChatsEnabled] = useState(true)
  const [alertCategories, setAlertCategories] = useState<string[]>(['b824c386-c03c-4d11-81af-42722c7980e1']) // Default: General Discussion

  useEffect(() => {
    if (auth.user?.access_token) {
      setAuthToken(auth.user.access_token)
    }
  }, [auth.user?.access_token])

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/api/me').then(res => res.data.data),
    enabled: !!auth.user?.access_token
  })

  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => api.get('/api/me/preferences').then(res => res.data.data),
    enabled: !!auth.user?.access_token
  })

  // Query for watched facilities (Starter+ feature)
  const { data: watchedFacilities = [] } = useQuery({
    queryKey: ['watched-facilities'],
    queryFn: () => api.get('/api/me/watched-facilities').then(res => res.data.data || []),
    enabled: !!auth.user?.access_token
  })

  // Unwatch facility mutation
  const unwatchMutation = useMutation({
    mutationFn: (facilityId: string) => api.delete(`/api/me/watched-facilities/${facilityId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watched-facilities'] })
    }
  })

  // Get watch limit based on tier
  const getWatchLimit = () => {
    const t = user?.tier?.toLowerCase() || 'free'
    switch(t) {
      case 'starter': return 3
      case 'pro': return 5
      case 'premium': case 'admin': case 'hr': return 999
      default: return 0
    }
  }
  const watchLimit = getWatchLimit()
  const canWatchFacilities = ['starter', 'pro', 'premium', 'admin', 'hr'].includes(user?.tier?.toLowerCase() || '')

  const updatePrefsMutation = useMutation({
    mutationFn: (data: any) => api.put('/api/me/preferences', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setEditingPrefs(false)
    }
  })

  const deleteAccountMutation = useMutation({
    mutationFn: () => api.delete('/api/users/me'),
    onSuccess: () => {
      // Sign out and redirect to goodbye page
      auth.removeUser()
      navigate('/goodbye')
    },
    onError: (error) => {
      console.error('Failed to delete account:', error)
      alert('Failed to delete account. Please try again or contact support.')
    }
  })

  // Initialize priorities and zip when preferences load
  useEffect(() => {
    if (preferences?.index_priorities) {
      setPriorities(preferences.index_priorities)
    }
    if (preferences?.location_zip) {
      setZipCode(preferences.location_zip)
    }
    // Load employment & directory data
    if (preferences?.current_employer_name) {
      setEmployerName(preferences.current_employer_name)
      setIsOtherFacility(true)
    }
    if (preferences?.directory_opt_in !== undefined) {
      setDirectoryOptIn(preferences.directory_opt_in)
    }
    if (preferences?.directory_display_name) {
      setDirectoryDisplayName(preferences.directory_display_name)
    }
    // Load notification preferences (defaults if not set)
    setForumAlertsEnabled(preferences?.forum_alerts_enabled ?? true)
    setForwardChatsEnabled(preferences?.forward_chats_enabled ?? true)
    setAlertCategories(preferences?.alert_categories || ['b824c386-c03c-4d11-81af-42722c7980e1'])
  }, [preferences])

  // Facility search query
  const { data: facilitiesSearch = [] } = useQuery({
    queryKey: ['facilities-search', facilitySearch],
    queryFn: () => api.get('/api/facilities', { params: { search: facilitySearch, limit: 10 } }).then(res => res.data.data || []),
    enabled: facilitySearch.length >= 2 && !isOtherFacility && editingEmployment,
  })

  // Generate default directory display name: "F. Lastname [Facility Name]"
  const generateDirectoryName = (facility: string | null) => {
    const firstName = user?.first_name || auth.user?.profile?.given_name || ''
    const lastName = user?.last_name || auth.user?.profile?.family_name || ''
    const initial = firstName ? firstName.charAt(0).toUpperCase() + '.' : ''
    const facilityPart = facility ? ` [${facility}]` : ''
    return `${initial} ${lastName}${facilityPart}`.trim()
  }

  // Handle facility selection
  const handleSelectFacility = (facility: { id: string; name: string }) => {
    setSelectedFacility(facility)
    setFacilitySearch(facility.name)
    setShowFacilityDropdown(false)
    setIsOtherFacility(false)
    setEmployerName('')
    if (!directoryDisplayName) {
      setDirectoryDisplayName(generateDirectoryName(facility.name))
    }
  }

  // Handle "Other" selection
  const handleSelectOther = () => {
    setSelectedFacility(null)
    setIsOtherFacility(true)
    setShowFacilityDropdown(false)
    setFacilitySearch('')
  }

  // Save employment & directory settings
  const updateEmploymentMutation = useMutation({
    mutationFn: (data: any) => api.put('/api/me/preferences', {
      ...preferences,
      current_employer_facility_id: selectedFacility?.id || null,
      current_employer_name: isOtherFacility ? employerName : null,
      directory_opt_in: directoryOptIn,
      directory_display_name: directoryDisplayName
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
      setEditingEmployment(false)
    }
  })

  // Save email notification preferences
  const updateNotificationsMutation = useMutation({
    mutationFn: () => api.put('/api/me/preferences', {
      ...preferences,
      forum_alerts_enabled: forumAlertsEnabled,
      forward_chats_enabled: forwardChatsEnabled,
      alert_categories: alertCategories
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
      setEditingNotifications(false)
    }
  })

  const updateZipMutation = useMutation({
    mutationFn: (zip: string) => api.put('/api/me/preferences', {
      ...preferences,
      location_zip: zip
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
      setEditingZip(false)
    }
  })

  const handleSaveZip = () => {
    // Validate zip code format (5 digits)
    if (!/^\d{5}$/.test(zipCode)) {
      alert('Please enter a valid 5-digit zip code')
      return
    }
    updateZipMutation.mutate(zipCode)
  }

  const tier = user?.tier || 'free'
  const changesUsed = preferences?.preference_changes_count || 0
  const changesAllowed = TIER_LIMITS[tier] || 0
  const canEdit = tier === 'premium' || changesUsed < changesAllowed

  const handleSavePreferences = () => {
    updatePrefsMutation.mutate({
      ...preferences,
      index_priorities: priorities
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    )
  }

  const profile = auth.user?.profile

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <SEO
        title="My Profile"
        description="Manage your VANurses profile. Update your preferences, nursing credentials, and job search settings."
        canonical="https://vanurses.net/profile"
      />
      <h1 className="text-3xl font-bold text-slate-900">Your Profile</h1>

      {/* Personal Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {user?.first_name || profile?.given_name} {user?.last_name || profile?.family_name}
            </h2>
            <p className="text-slate-500">{user?.email || profile?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                tier === 'premium' ? 'bg-purple-100 text-purple-700' :
                tier === 'pro' ? 'bg-blue-100 text-blue-700' :
                tier === 'basic' ? 'bg-green-100 text-green-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {tier.charAt(0).toUpperCase() + tier.slice(1)} Plan
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Mail className="w-5 h-5 text-slate-400" />
            <div>
              <div className="text-sm text-slate-500">Email</div>
              <div className="font-medium">{user?.email || profile?.email}</div>
            </div>
            {user?.email_verified && (
              <span className="ml-auto px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                Verified
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <MapPin className="w-5 h-5 text-slate-400" />
            <div className="flex-1">
              <div className="text-sm text-slate-500">Location (Zip Code)</div>
              {editingZip ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="Enter zip code"
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm w-28 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveZip}
                    disabled={updateZipMutation.isPending}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingZip(false)
                      setZipCode(preferences?.location_zip || '')
                    }}
                    className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="font-medium">{preferences?.location_zip || 'Not set'}</div>
              )}
            </div>
            {!editingZip && (
              <button
                onClick={() => setEditingZip(true)}
                className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Shield className="w-5 h-5 text-slate-400" />
            <div>
              <div className="text-sm text-slate-500">Account Security</div>
              <div className="font-medium">Managed by Zitadel</div>
            </div>
            <a
              href="https://auth.vanurses.net/ui/console"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-primary-600 text-sm hover:underline"
            >
              Manage
            </a>
          </div>
        </div>
      </div>

      {/* Complete Profile Banner - Show when profile is incomplete */}
      {!preferences?.license_type && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-900">Complete Your Profile</h3>
              <p className="text-amber-700 text-sm mt-1">
                Add your nursing credentials to get personalized job recommendations and better facility matches.
              </p>
              <div className="flex gap-3 mt-4">
                <Link
                  to="/onboarding"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
                >
                  <ClipboardList className="w-4 h-4" />
                  Start Onboarding
                </Link>
                <Link
                  to="/profile/edit"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 text-sm font-medium"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Manually
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* License & Experience */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">License & Experience</h2>
          </div>
          <Link to="/profile/edit" className="text-primary-600 text-sm hover:underline">
            Edit in Profile Builder
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-slate-500">License Type</div>
            <div className="font-medium">{preferences?.license_type || 'Not set'}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">License State</div>
            <div className="font-medium">{preferences?.license_state || 'Not set'}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Years Experience</div>
            <div className="font-medium">{preferences?.years_experience || 0} years</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Compact License</div>
            <div className="font-medium">{preferences?.compact_license ? 'Yes' : 'No'}</div>
          </div>
        </div>

        {preferences?.specialties?.length > 0 && (
          <div className="mt-4">
            <div className="text-sm text-slate-500 mb-2">Specialties</div>
            <div className="flex flex-wrap gap-2">
              {preferences.specialties.map((s: string) => (
                <span key={s} className="px-2 py-1 bg-primary-50 text-primary-700 text-sm rounded-full">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Employment & Directory */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Employment & Directory</h2>
          </div>
          {editingEmployment ? (
            <div className="flex gap-2">
              <button
                onClick={() => setEditingEmployment(false)}
                className="p-2 text-slate-500 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={() => updateEmploymentMutation.mutate({})}
                disabled={updateEmploymentMutation.isPending}
                className="p-2 text-green-600 hover:text-green-700"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingEmployment(true)}
              className="p-2 text-primary-600 hover:text-primary-700"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {editingEmployment ? (
          <div className="space-y-4">
            {/* Facility Search */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Current Employer
              </label>
              <div className="relative">
                {!isOtherFacility ? (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={facilitySearch}
                        onChange={(e) => {
                          setFacilitySearch(e.target.value)
                          setShowFacilityDropdown(true)
                          if (selectedFacility && e.target.value !== selectedFacility.name) {
                            setSelectedFacility(null)
                          }
                        }}
                        onFocus={() => setShowFacilityDropdown(true)}
                        placeholder="Search for your hospital or facility..."
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    {/* Dropdown */}
                    {showFacilityDropdown && (facilitySearch.length >= 2 || facilitiesSearch.length > 0) && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {facilitiesSearch.map((f: any) => (
                          <button
                            key={f.id}
                            onClick={() => handleSelectFacility({ id: f.id, name: f.name })}
                            className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100 last:border-b-0"
                          >
                            <Building2 className="w-4 h-4 text-slate-400" />
                            <div>
                              <div className="text-sm font-medium text-slate-900">{f.name}</div>
                              <div className="text-xs text-slate-500">{f.city}, {f.state}</div>
                            </div>
                          </button>
                        ))}
                        {/* Other option */}
                        <button
                          onClick={handleSelectOther}
                          className="w-full px-4 py-2.5 text-left hover:bg-amber-50 flex items-center gap-2 bg-amber-50/50"
                        >
                          <span className="w-4 h-4 text-amber-600 text-lg leading-none">+</span>
                          <div>
                            <div className="text-sm font-medium text-amber-700">Other / Not Listed</div>
                            <div className="text-xs text-amber-600">Enter facility name manually</div>
                          </div>
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={employerName}
                        onChange={(e) => {
                          setEmployerName(e.target.value)
                          if (!directoryDisplayName) {
                            setDirectoryDisplayName(generateDirectoryName(e.target.value))
                          }
                        }}
                        placeholder="Enter your facility name"
                        className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          setIsOtherFacility(false)
                          setFacilitySearch('')
                          setEmployerName('')
                        }}
                        className="px-3 py-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-sm"
                      >
                        Search
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">Type your facility name if it's not in our system</p>
                  </div>
                )}
              </div>
              {selectedFacility && (
                <p className="mt-2 text-sm text-emerald-600 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Selected: {selectedFacility.name}
                </p>
              )}
            </div>

            {/* Directory Opt-in */}
            <div className="bg-slate-50 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={directoryOptIn}
                  onChange={(e) => {
                    setDirectoryOptIn(e.target.checked)
                    if (e.target.checked && !directoryDisplayName) {
                      setDirectoryDisplayName(generateDirectoryName(selectedFacility?.name || employerName || null))
                    }
                  }}
                  className="w-5 h-5 text-primary-600 rounded mt-0.5"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary-600" />
                    <span className="font-medium text-slate-900">Show me in the Nurse Directory</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Let other nurses find and connect with you in Community and Chat (coming soon).
                  </p>
                </div>
              </label>

              {/* Directory Display Name */}
              {directoryOptIn && (
                <div className="mt-3 pl-8">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Directory Display Name
                  </label>
                  <input
                    type="text"
                    value={directoryDisplayName}
                    onChange={(e) => setDirectoryDisplayName(e.target.value)}
                    placeholder="e.g., J. Smith [Hospital Name]"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    This is how you'll appear in the directory and community
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Building2 className="w-5 h-5 text-slate-400" />
              <div>
                <div className="text-sm text-slate-500">Current Employer</div>
                <div className="font-medium">
                  {preferences?.current_employer_name || selectedFacility?.name || 'Not set'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Users className="w-5 h-5 text-slate-400" />
              <div className="flex-1">
                <div className="text-sm text-slate-500">Nurse Directory</div>
                <div className="font-medium">
                  {preferences?.directory_opt_in ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <Check className="w-4 h-4" /> Listed as: {preferences?.directory_display_name || 'Not set'}
                    </span>
                  ) : (
                    <span className="text-slate-600">Not listed</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Email Notifications */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Email Notifications</h2>
          </div>
          {editingNotifications ? (
            <div className="flex gap-2">
              <button
                onClick={() => setEditingNotifications(false)}
                className="p-2 text-slate-500 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={() => updateNotificationsMutation.mutate()}
                disabled={updateNotificationsMutation.isPending}
                className="p-2 text-green-600 hover:text-green-700"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingNotifications(true)}
              className="p-2 text-primary-600 hover:text-primary-700"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <p className="text-sm text-slate-500 mb-4">
          Get email notifications for community discussions and Sully chat summaries.
        </p>

        {editingNotifications ? (
          <div className="space-y-4">
            {/* Forum Alerts Toggle */}
            <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={forumAlertsEnabled}
                onChange={(e) => setForumAlertsEnabled(e.target.checked)}
                className="w-5 h-5 text-primary-600 rounded mt-0.5"
              />
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary-600" />
                  <span className="font-medium text-slate-900">Community Forum Alerts</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Receive email notifications for new posts in selected categories
                </p>
              </div>
            </label>

            {/* Category Selection - Show when forum alerts enabled */}
            {forumAlertsEnabled && (
              <div className="pl-8">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Categories to Receive Alerts From
                </label>
                <div className="space-y-2">
                  {FORUM_CATEGORIES.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alertCategories.includes(cat.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAlertCategories([...alertCategories, cat.id])
                          } else {
                            setAlertCategories(alertCategories.filter(id => id !== cat.id))
                          }
                        }}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <span className="text-sm text-slate-700">{cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Forward Chats Toggle */}
            <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={forwardChatsEnabled}
                onChange={(e) => setForwardChatsEnabled(e.target.checked)}
                className="w-5 h-5 text-primary-600 rounded mt-0.5"
              />
              <div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary-600" />
                  <span className="font-medium text-slate-900">Forward Sully Chats to Email</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Get a summary of your Sully conversations sent to your email
                </p>
              </div>
            </label>

            <p className="text-xs text-slate-400 mt-2">
              Emails are sent from noreply@vanurses.net
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <MessageSquare className="w-5 h-5 text-slate-400" />
              <div className="flex-1">
                <div className="text-sm text-slate-500">Community Forum Alerts</div>
                <div className="font-medium">
                  {forumAlertsEnabled ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <Check className="w-4 h-4" /> Enabled ({alertCategories.length} {alertCategories.length === 1 ? 'category' : 'categories'})
                    </span>
                  ) : (
                    <span className="text-slate-600">Disabled</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Mail className="w-5 h-5 text-slate-400" />
              <div className="flex-1">
                <div className="text-sm text-slate-500">Forward Sully Chats to Email</div>
                <div className="font-medium">
                  {forwardChatsEnabled ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <Check className="w-4 h-4" /> Enabled
                    </span>
                  ) : (
                    <span className="text-slate-600">Disabled</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Watched Facilities - Starter+ Feature */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-slate-900">Watched Facilities</h2>
          </div>
          {canWatchFacilities && (
            <span className="text-sm text-slate-500">
              {watchedFacilities.length}/{watchLimit === 999 ? '∞' : watchLimit} watched
            </span>
          )}
        </div>

        {canWatchFacilities ? (
          watchedFacilities.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-3">
                Get notified when new jobs are posted at these facilities.
              </p>
              {watchedFacilities.map((watched: any) => (
                <div key={watched.facility_id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <Link
                    to={`/facilities/${watched.facility_id}`}
                    className="flex items-center gap-3 flex-1 hover:text-primary-600"
                  >
                    <Building2 className="w-5 h-5 text-amber-600" />
                    <div>
                      <div className="font-medium text-slate-900">{watched.facility_name}</div>
                      <div className="text-sm text-slate-500">{watched.facility_city}, {watched.facility_state}</div>
                    </div>
                  </Link>
                  <button
                    onClick={() => unwatchMutation.mutate(watched.facility_id)}
                    disabled={unwatchMutation.isPending}
                    className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                    title="Stop watching this facility"
                  >
                    {unwatchMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
              <Link
                to="/facilities"
                className="block text-center text-sm text-primary-600 hover:underline mt-3"
              >
                Browse facilities to watch more
              </Link>
            </div>
          ) : (
            <div className="text-center py-6">
              <Eye className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm mb-2">No facilities watched yet</p>
              <p className="text-xs text-slate-400 mb-3">
                Watch facilities to get notified when they post new jobs
              </p>
              <Link
                to="/facilities"
                className="inline-block px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
              >
                Browse Facilities
              </Link>
            </div>
          )
        ) : (
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
            <div className="flex items-start gap-3">
              <Crown className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">Watch Facilities (Starter+ Feature)</p>
                <p className="text-sm text-amber-700 mt-1">
                  Upgrade to Starter or higher to watch up to {tier === 'free' ? '3' : '5'} facilities and get notified when they post new jobs.
                </p>
                <Link
                  to="/billing"
                  className="inline-block mt-2 px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700"
                >
                  Upgrade Now
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* OFS Index Priorities - The main preference editing section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-slate-900">Your Job Priorities</h2>
          </div>
          <div className="flex items-center gap-3">
            {tier !== 'premium' && (
              <span className="text-sm text-slate-500">
                {changesAllowed - changesUsed} changes remaining
              </span>
            )}
            {editingPrefs ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingPrefs(false)}
                  className="p-2 text-slate-500 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSavePreferences}
                  disabled={updatePrefsMutation.isPending}
                  className="p-2 text-green-600 hover:text-green-700"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : canEdit ? (
              <button
                onClick={() => setEditingPrefs(true)}
                className="p-2 text-primary-600 hover:text-primary-700"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            ) : (
              <Link
                to="/billing"
                className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
              >
                <Lock className="w-4 h-4" />
                Upgrade to edit
              </Link>
            )}
          </div>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          These priorities help us find jobs that match what matters most to you.
          Rate each factor from 1-5 hearts.
        </p>

        <div className="space-y-4">
          {OFS_INDICES.map((index) => {
            const value = priorities[index.code] || preferences?.index_priorities?.[index.code] || 3
            return (
              <div key={index.code} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <div className="font-medium text-slate-900">{index.title}</div>
                  <div className="text-sm text-slate-500">{index.desc}</div>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => editingPrefs && setPriorities({ ...priorities, [index.code]: n })}
                      disabled={!editingPrefs}
                      className={`transition-colors ${editingPrefs ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <Heart
                        className={`w-5 h-5 ${
                          n <= value
                            ? 'fill-red-500 text-red-500'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {tier === 'free' && (
          <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
            <div className="flex items-start gap-3">
              <Crown className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">Upgrade to customize your priorities</p>
                <p className="text-sm text-amber-700 mt-1">
                  Free users cannot change preferences after onboarding.
                  Upgrade to Basic ($19/mo) for 2 changes, Pro ($29/mo) for 3 changes,
                  or Premium for unlimited.
                </p>
                <Link
                  to="/billing"
                  className="inline-block mt-2 px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700"
                >
                  View Plans
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View Results CTA */}
      <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-2">See Your Personalized Results</h2>
            <p className="text-primary-100">
              Jobs matched to your priorities with custom scores based on your preferences.
            </p>
          </div>
          <Link
            to="/results"
            className="px-6 py-3 bg-white text-primary-600 font-semibold rounded-lg hover:bg-primary-50 transition-colors"
          >
            View Results
          </Link>
        </div>
      </div>

      {/* Account Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Account Actions</h2>
        <div className="space-y-3">
          <button
            onClick={() => auth.signoutRedirect()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
          >
            Sign Out
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-red-200 rounded-lg hover:bg-red-50 text-red-600"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Delete Account?</h3>
                <p className="text-sm text-slate-500">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-slate-600 mb-6">
              All your data will be permanently deleted, including your saved jobs, applications, and preferences.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteAccountMutation.mutate()}
                disabled={deleteAccountMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
              >
                {deleteAccountMutation.isPending ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
