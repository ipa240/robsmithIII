import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Building2, Briefcase, BarChart3, Users, TrendingUp, Eye,
  Plus, Edit2, Trash2, Search, CheckCircle, Clock, AlertCircle,
  DollarSign, Zap, ChevronRight
} from 'lucide-react'
import { api } from '../api/client'

interface Job {
  id: string
  title: string
  department: string
  shift_type: string
  status: 'active' | 'paused' | 'closed'
  views: number
  applications: number
  posted_at: string
  is_boosted: boolean
}

interface FacilityStats {
  total_jobs: number
  active_jobs: number
  total_views: number
  total_applications: number
  avg_time_to_fill: number
  ofs_score: number
  ofs_grade: string
}

interface FacilityClaim {
  id: string
  status: 'pending' | 'verified' | 'rejected'
  submitted_at: string
}

export default function HR() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'jobs' | 'analytics' | 'feedback'>('dashboard')
  const [jobSearch, setJobSearch] = useState('')

  const { data: facilityStats } = useQuery<FacilityStats>({
    queryKey: ['hr-facility-stats'],
    queryFn: () => api.get('/api/hr/stats').then(res => res.data)
  })

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ['hr-jobs', jobSearch],
    queryFn: () => api.get(`/api/hr/jobs?search=${jobSearch}`).then(res => res.data.jobs),
    enabled: activeTab === 'jobs'
  })

  const { data: claimStatus } = useQuery<FacilityClaim | null>({
    queryKey: ['hr-claim-status'],
    queryFn: () => api.get('/api/hr/claim/status').then(res => res.data)
  })

  const isVerified = claimStatus?.status === 'verified'

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">HR Dashboard</h1>
            <p className="text-slate-500">Manage your facility's job listings</p>
          </div>
        </div>

        {isVerified && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Verified Employer
          </div>
        )}
      </div>

      {/* Verification Banner */}
      {!isVerified && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 mb-1">Verify Your Facility</h3>
              <p className="text-sm text-amber-700 mb-3">
                To post jobs and access full HR features, you need to verify that you represent this facility.
              </p>
              {claimStatus?.status === 'pending' ? (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <Clock className="w-4 h-4" />
                  Verification pending - we'll notify you within 24-48 hours
                </div>
              ) : (
                <button className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">
                  Start Verification
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'jobs', label: 'Job Listings', icon: Briefcase },
          { id: 'analytics', label: 'Analytics', icon: TrendingUp },
          { id: 'feedback', label: 'Nurse Feedback', icon: Users }
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
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && facilityStats && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm text-slate-500">Active Jobs</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{facilityStats.active_jobs}</p>
              <p className="text-xs text-slate-400 mt-1">{facilityStats.total_jobs} total</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-sm text-slate-500">Job Views</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{facilityStats.total_views.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">Last 30 days</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm text-slate-500">Applications</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{facilityStats.total_applications}</p>
              <p className="text-xs text-slate-400 mt-1">Last 30 days</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-sm text-slate-500">Avg Time to Fill</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{facilityStats.avg_time_to_fill} days</p>
              <p className="text-xs text-slate-400 mt-1">Industry avg: 42 days</p>
            </div>
          </div>

          {/* OFS Score Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Your Facility Score</h3>
                <p className="text-sm text-slate-500">How nurses perceive your workplace</p>
              </div>
              <div className="text-right">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${
                  facilityStats.ofs_grade.startsWith('A') ? 'bg-emerald-100 text-emerald-700' :
                  facilityStats.ofs_grade.startsWith('B') ? 'bg-blue-100 text-blue-700' :
                  facilityStats.ofs_grade.startsWith('C') ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  <span className="text-2xl font-bold">{facilityStats.ofs_grade}</span>
                  <span className="text-lg">({facilityStats.ofs_score})</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-600">
                Your OFS score is based on 10 indices including pay competitiveness, employee reviews,
                patient experience, and more. Higher scores attract more qualified applicants.
              </p>
              <a href="/facilities" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-2">
                View detailed breakdown <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              disabled={!isVerified}
              className="bg-primary-600 text-white rounded-xl p-5 text-left hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-6 h-6 mb-3" />
              <h3 className="font-semibold mb-1">Post New Job</h3>
              <p className="text-sm text-primary-100">Create a new job listing</p>
            </button>

            <button className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:bg-slate-50">
              <Zap className="w-6 h-6 mb-3 text-amber-500" />
              <h3 className="font-semibold text-slate-900 mb-1">Boost Listings</h3>
              <p className="text-sm text-slate-500">Get more visibility</p>
            </button>

            <button className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:bg-slate-50">
              <BarChart3 className="w-6 h-6 mb-3 text-blue-500" />
              <h3 className="font-semibold text-slate-900 mb-1">View Reports</h3>
              <p className="text-sm text-slate-500">Hiring analytics</p>
            </button>
          </div>
        </div>
      )}

      {/* Jobs Tab */}
      {activeTab === 'jobs' && (
        <div className="bg-white rounded-2xl border border-slate-200">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              disabled={!isVerified}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              New Job
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Job Title</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Department</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Views</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Apps</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Posted</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs?.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{job.title}</span>
                        {job.is_boosted && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                            Boosted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{job.department}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        job.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        job.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{job.views}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{job.applications}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(job.posted_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) || (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      {isVerified ? 'No jobs posted yet. Create your first job listing!' : 'Verify your facility to post jobs.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Hiring Performance</h2>
            <div className="h-64 flex items-center justify-center bg-slate-50 rounded-lg">
              <p className="text-slate-400">Analytics charts coming soon</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Top Performing Jobs</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-900">ICU RN - Night Shift</span>
                  <span className="text-sm text-emerald-600">24 applications</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-900">ER Nurse - PRN</span>
                  <span className="text-sm text-emerald-600">18 applications</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-900">Med-Surg RN</span>
                  <span className="text-sm text-emerald-600">12 applications</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Traffic Sources</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">VANurses Direct</span>
                  <span className="text-sm font-medium text-slate-900">62%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-primary-500 h-2 rounded-full" style={{ width: '62%' }}></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Google Search</span>
                  <span className="text-sm font-medium text-slate-900">28%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '28%' }}></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Referrals</span>
                  <span className="text-sm font-medium text-slate-900">10%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '10%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Tab */}
      {activeTab === 'feedback' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-slate-900">Nurse Intel Feedback</h2>
              <p className="text-sm text-slate-500">Anonymous feedback from nurses about your facility</p>
            </div>
            <span className="text-sm text-slate-400">Premium HR feature</span>
          </div>

          <div className="space-y-4">
            {/* Sample feedback items */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-900">Work-Life Balance</span>
                <span className="text-sm text-amber-600">3.5/5</span>
              </div>
              <p className="text-sm text-slate-600 italic">
                "Good scheduling flexibility, but short staffing on weekends can be challenging."
              </p>
              <p className="text-xs text-slate-400 mt-2">Posted 2 weeks ago</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-900">Management</span>
                <span className="text-sm text-emerald-600">4.2/5</span>
              </div>
              <p className="text-sm text-slate-600 italic">
                "Nurse managers are supportive and advocate for staff needs."
              </p>
              <p className="text-xs text-slate-400 mt-2">Posted 3 weeks ago</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-900">Compensation</span>
                <span className="text-sm text-blue-600">4.0/5</span>
              </div>
              <p className="text-sm text-slate-600 italic">
                "Pay is competitive with the market. Would appreciate more shift differentials."
              </p>
              <p className="text-xs text-slate-400 mt-2">Posted 1 month ago</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-primary-50 rounded-lg border border-primary-100">
            <h3 className="font-medium text-primary-900 mb-2">Respond to Feedback</h3>
            <p className="text-sm text-primary-700">
              HR Admin tier ($99/mo) allows you to publicly respond to feedback and show nurses
              you're listening. Responses appear on your facility profile.
            </p>
            <button className="mt-3 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
              Upgrade to HR Admin
            </button>
          </div>
        </div>
      )}

      {/* Boost Promo */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg mb-1">Boost Your Job Listings</h3>
            <p className="text-amber-100 text-sm">
              Get 3x more visibility and appear at the top of search results
            </p>
          </div>
          <button className="px-6 py-2.5 bg-white text-amber-600 rounded-lg font-medium hover:bg-amber-50">
            View Boost Options
          </button>
        </div>
      </div>
    </div>
  )
}
