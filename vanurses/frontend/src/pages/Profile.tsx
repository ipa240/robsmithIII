import { useAuth } from 'react-oidc-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  User, Mail, Shield, Heart, MapPin, Briefcase, Award,
  Edit2, Check, X, Lock, Crown
} from 'lucide-react'
import { api, setAuthToken } from '../api/client'

// OFS Index definitions
const OFS_INDICES = [
  { code: 'pci', title: 'Pay & Compensation', desc: 'Competitive salary importance' },
  { code: 'ali', title: 'Amenities & Lifestyle', desc: 'Nearby dining, shopping, gyms' },
  { code: 'csi', title: 'Commute', desc: 'Low traffic, easy drive' },
  { code: 'cci', title: 'Climate & Weather', desc: 'Pleasant year-round climate' },
  { code: 'lssi', title: 'Safety & Security', desc: 'Low crime, safe area' },
  { code: 'qli', title: 'Quality of Life', desc: 'Community livability' },
  { code: 'pei', title: 'Patient Experience', desc: 'Patient satisfaction scores' },
  { code: 'fsi', title: 'Facility Quality', desc: 'Facility ratings & services' },
]

const TIER_LIMITS: Record<string, number> = {
  free: 0,
  basic: 2,
  pro: 3,
  premium: 999
}

export default function Profile() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [editingPrefs, setEditingPrefs] = useState(false)
  const [priorities, setPriorities] = useState<Record<string, number>>({})

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

  const updatePrefsMutation = useMutation({
    mutationFn: (data: any) => api.put('/api/me/preferences', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setEditingPrefs(false)
    }
  })

  // Initialize priorities when preferences load
  useEffect(() => {
    if (preferences?.index_priorities) {
      setPriorities(preferences.index_priorities)
    }
  }, [preferences])

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

          {preferences?.location_zip && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <MapPin className="w-5 h-5 text-slate-400" />
              <div>
                <div className="text-sm text-slate-500">Location</div>
                <div className="font-medium">{preferences.location_zip}</div>
              </div>
            </div>
          )}

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
        </div>
      </div>
    </div>
  )
}
