import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users, Building2, Briefcase, MessageCircle, DollarSign,
  RefreshCw, Search, Shield, BarChart3, MessageSquare,
  Check, X, Loader2
} from 'lucide-react'
import { api } from '../api/client'

interface AdminStats {
  users: {
    total: number
    new_today: number
    new_this_week: number
    active_subscriptions: number
    trial_users: number
  }
  facilities: {
    total: number
    with_scores: number
    average_ofs: number
  }
  jobs: {
    total_active: number
    new_today: number
    scraped_this_week: number
  }
  sully: {
    questions_today: number
    questions_this_week: number
    avg_response_time_ms: number
  }
  revenue: {
    mrr: number
    arr: number
    new_subs_this_month: number
  }
}

interface User {
  id: string
  email: string
  name: string
  tier: string
  created_at: string
  last_login: string
  sully_questions_today: number
}

interface Facility {
  id: string
  name: string
  city: string
  ofs_score: number | null
  ofs_grade: string | null
  active_jobs: number
}

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string
  is_approved: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  approved_at: string | null
  created_by_email: string | null
  approved_by_email: string | null
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'facilities' | 'scraper' | 'community'>('overview')
  const [userSearch, setUserSearch] = useState('')
  const queryClient = useQueryClient()

  // Check if user is admin
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/api/me').then(res => res.data.data)
  })

  // Block non-admins
  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (!userData?.is_admin) {
    return (
      <div className="text-center py-20">
        <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-600">Admin access required.</p>
      </div>
    )
  }

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/api/admin/stats').then(res => res.data)
  })

  const { data: usersData } = useQuery<{ users: User[] }>({
    queryKey: ['admin-users', userSearch],
    queryFn: () => api.get(`/api/admin/users?search=${userSearch}`).then(res => res.data),
    enabled: activeTab === 'users'
  })

  const { data: facilitiesData } = useQuery<{ facilities: Facility[] }>({
    queryKey: ['admin-facilities'],
    queryFn: () => api.get('/api/admin/facilities').then(res => res.data),
    enabled: activeTab === 'facilities'
  })

  const { data: scraperStatus } = useQuery({
    queryKey: ['scraper-status'],
    queryFn: () => api.get('/api/admin/scraper/status').then(res => res.data),
    enabled: activeTab === 'scraper'
  })

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<{
    categories: Category[]
    pending_count: number
  }>({
    queryKey: ['admin-categories'],
    queryFn: () => api.get('/api/admin/community/categories').then(res => res.data),
    enabled: activeTab === 'community'
  })

  const approveCategoryMutation = useMutation({
    mutationFn: (categoryId: string) =>
      api.post(`/api/admin/community/categories/${categoryId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
    }
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) =>
      api.delete(`/api/admin/community/categories/${categoryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
    }
  })

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(0)}`

  const pendingCategories = categoriesData?.categories.filter(c => !c.is_approved) || []
  const activeCategories = categoriesData?.categories.filter(c => c.is_approved && c.is_active) || []

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500">System management and analytics</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit flex-wrap">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'facilities', label: 'Facilities', icon: Building2 },
          { id: 'scraper', label: 'Scraper', icon: RefreshCw },
          { id: 'community', label: 'Community', icon: MessageSquare, badge: categoriesData?.pending_count }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Users Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900">Users</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">Total</span>
                <span className="font-semibold">{stats.users.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">New Today</span>
                <span className="font-semibold text-emerald-600">+{stats.users.new_today}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">Active Subs</span>
                <span className="font-semibold">{stats.users.active_subscriptions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">Trial</span>
                <span className="font-semibold">{stats.users.trial_users}</span>
              </div>
            </div>
          </div>

          {/* Jobs Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-slate-900">Jobs</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">Active</span>
                <span className="font-semibold">{stats.jobs.total_active.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">New Today</span>
                <span className="font-semibold text-emerald-600">+{stats.jobs.new_today}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">This Week</span>
                <span className="font-semibold">{stats.jobs.scraped_this_week}</span>
              </div>
            </div>
          </div>

          {/* Sully Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-slate-900">Sully AI</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">Today</span>
                <span className="font-semibold">{stats.sully.questions_today}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">This Week</span>
                <span className="font-semibold">{stats.sully.questions_this_week}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">Avg Response</span>
                <span className="font-semibold">{(stats.sully.avg_response_time_ms / 1000).toFixed(1)}s</span>
              </div>
            </div>
          </div>

          {/* Revenue Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-slate-900">Revenue</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">MRR</span>
                <span className="font-semibold">{formatCurrency(stats.revenue.mrr)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">ARR</span>
                <span className="font-semibold">{formatCurrency(stats.revenue.arr)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">New Subs</span>
                <span className="font-semibold text-emerald-600">+{stats.revenue.new_subs_this_month}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search users by email or name..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">User</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Tier</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Joined</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Last Login</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersData?.users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{user.name}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        user.tier === 'premium' ? 'bg-purple-100 text-purple-700' :
                        user.tier === 'pro' ? 'bg-blue-100 text-blue-700' :
                        user.tier === 'starter' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {user.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(user.last_login).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-sm text-primary-600 hover:text-primary-700">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Facilities Tab */}
      {activeTab === 'facilities' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Facility</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">City</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">OFS</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Grade</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Jobs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {facilitiesData?.facilities.map((facility) => (
                  <tr key={facility.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{facility.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{facility.city}</td>
                    <td className="px-4 py-3 text-sm">{facility.ofs_score ?? '-'}</td>
                    <td className="px-4 py-3">
                      {facility.ofs_grade && (
                        <span className={`inline-flex px-2 py-1 text-xs font-bold rounded ${
                          facility.ofs_grade.startsWith('A') ? 'bg-emerald-100 text-emerald-700' :
                          facility.ofs_grade.startsWith('B') ? 'bg-blue-100 text-blue-700' :
                          facility.ofs_grade.startsWith('C') ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {facility.ofs_grade}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{facility.active_jobs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scraper Tab */}
      {activeTab === 'scraper' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Scraper Status</h2>
              <button className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600">
                <RefreshCw className="w-4 h-4" />
                Run Now
              </button>
            </div>

            {scraperStatus && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Status</p>
                  <p className={`font-semibold ${scraperStatus.status === 'running' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {scraperStatus.status}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Last Run</p>
                  <p className="font-semibold">{new Date(scraperStatus.last_run).toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Jobs Found</p>
                  <p className="font-semibold">{scraperStatus.jobs_found}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Next Run</p>
                  <p className="font-semibold">{new Date(scraperStatus.next_scheduled).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Community Tab */}
      {activeTab === 'community' && (
        <div className="space-y-6">
          {categoriesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
          ) : (
            <>
              {/* Pending Categories */}
              {pendingCategories.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                  <div className="p-4 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                      Pending Approval
                      <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                        {pendingCategories.length}
                      </span>
                    </h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {pendingCategories.map((category) => (
                      <div key={category.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{category.name}</p>
                            <p className="text-sm text-slate-500">{category.description || 'No description'}</p>
                            {category.created_by_email && (
                              <p className="text-xs text-slate-400 mt-1">
                                Suggested by {category.created_by_email} on{' '}
                                {new Date(category.created_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approveCategoryMutation.mutate(category.id)}
                            disabled={approveCategoryMutation.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => deleteCategoryMutation.mutate(category.id)}
                            disabled={deleteCategoryMutation.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Categories */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                <div className="p-4 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-900">Active Categories ({activeCategories.length})</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Category</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Slug</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Icon</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Order</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeCategories.map((category) => (
                        <tr key={category.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-slate-900">{category.name}</p>
                              <p className="text-sm text-slate-500 truncate max-w-xs">{category.description}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">{category.slug}</td>
                          <td className="px-4 py-3 text-sm text-slate-500">{category.icon}</td>
                          <td className="px-4 py-3 text-sm text-slate-500">{category.sort_order}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => deleteCategoryMutation.mutate(category.id)}
                              disabled={deleteCategoryMutation.isPending}
                              className="text-sm text-red-600 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
