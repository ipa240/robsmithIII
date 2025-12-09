import { useAuth } from 'react-oidc-context'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Briefcase, Building2, Bookmark, DollarSign, ArrowRight,
  MessageSquare, Newspaper, FileCheck, Clock, Send
} from 'lucide-react'
import { api, setAuthToken } from '../api/client'
import { useEffect, useState } from 'react'

export default function Dashboard() {
  const auth = useAuth()
  const [sullyMessage, setSullyMessage] = useState('')

  // Set auth token for API calls
  useEffect(() => {
    if (auth.user?.access_token) {
      setAuthToken(auth.user.access_token)
    }
  }, [auth.user?.access_token])

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/api/stats').then(res => res.data.data)
  })

  const { data: recentJobs } = useQuery({
    queryKey: ['recent-jobs-diverse'],
    queryFn: () => api.get('/api/jobs/recent-diverse', { params: { limit: 5 } }).then(res => res.data.data)
  })

  const { data: topFacilities } = useQuery({
    queryKey: ['top-facilities'],
    queryFn: () => api.get('/api/facilities', { params: { limit: 5 } }).then(res => res.data.data)
  })

  const { data: savedJobs = [] } = useQuery({
    queryKey: ['saved-jobs'],
    queryFn: () => api.get('/api/me/saved-jobs').then(res => res.data.data || []),
    enabled: !!auth.user?.access_token
  })

  const { data: applications = [] } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => api.get('/api/me/applications').then(res => res.data.data || []),
    enabled: !!auth.user?.access_token
  })

  const { data: newsArticles = [] } = useQuery({
    queryKey: ['news-headlines'],
    queryFn: () => api.get('/api/news', { params: { limit: 3 } }).then(res => res.data.data || [])
  })

  const { data: trendsOverview } = useQuery({
    queryKey: ['trends-overview'],
    queryFn: () => api.get('/api/trends/overview').then(res => res.data)
  })

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/api/me').then(res => res.data.data),
    enabled: !!auth.user?.access_token
  })

  // Try multiple name sources with fallbacks
  const userName = user?.first_name ||
                   auth.user?.profile?.given_name ||
                   auth.user?.profile?.name?.split(' ')[0] ||
                   auth.user?.profile?.preferred_username?.split('@')[0] ||
                   'there'

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Welcome back, {userName}!
        </h1>
        <p className="text-slate-600">
          Here's what's happening in Virginia nursing today.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {stats?.total_jobs?.toLocaleString() || '-'}
              </div>
              <div className="text-sm text-slate-500">Active Jobs</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {stats?.total_facilities?.toLocaleString() || '-'}
              </div>
              <div className="text-sm text-slate-500">Facilities</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <Bookmark className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {savedJobs?.length || 0}
              </div>
              <div className="text-sm text-slate-500">Saved Jobs</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                ${trendsOverview?.stats?.avgHourly?.toFixed(0) || '-'}
              </div>
              <div className="text-sm text-slate-500">Avg Hourly</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent Jobs</h2>
          <Link to="/jobs" className="text-primary-600 hover:underline text-sm flex items-center gap-1">
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="space-y-3">
          {recentJobs?.map((job: any) => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className="block p-4 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-900">{job.title}</h3>
                  <div className="text-sm text-slate-500">
                    {job.facility_name || 'Various Facilities'} • {job.city}, {job.state}
                  </div>
                </div>
                <div className="flex gap-2">
                  {job.nursing_type && (
                    <span className="px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded-full">
                      {job.nursing_type}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Top Facilities */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Top Rated Facilities</h2>
          <Link to="/facilities" className="text-primary-600 hover:underline text-sm flex items-center gap-1">
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="space-y-3">
          {topFacilities?.map((facility: any) => (
            <Link
              key={facility.id}
              to={`/facilities/${facility.id}`}
              className="block p-4 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                {facility.score && (
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold grade-${facility.score.ofs_grade}`}>
                    {facility.score.ofs_grade}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900">{facility.name}</h3>
                  <div className="text-sm text-slate-500">
                    {facility.system_name || facility.city}, {facility.state}
                  </div>
                </div>
                {facility.job_count > 0 && (
                  <span className="text-sm text-emerald-600">
                    {facility.job_count} jobs
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Two Column Bottom Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ask Sully Quick Chat */}
        <div className="bg-gradient-to-br from-primary-50 to-accent-50 rounded-xl border border-primary-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <img
              src="/media/sully/sully-neutral.jpg"
              alt="Sully"
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Ask Sully</h2>
              <p className="text-sm text-slate-500">Your AI nursing career assistant</p>
            </div>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={sullyMessage}
              onChange={(e) => setSullyMessage(e.target.value)}
              placeholder="Ask about jobs, facilities, or pay..."
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && sullyMessage.trim()) {
                  window.location.href = `/sully?q=${encodeURIComponent(sullyMessage)}`
                }
              }}
            />
            <Link
              to={sullyMessage.trim() ? `/sully?q=${encodeURIComponent(sullyMessage)}` : '/sully'}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-1"
            >
              <Send className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {['What hospitals have the best ratings?', 'ICU jobs near Richmond', 'Average RN pay in VA'].map((q) => (
              <Link
                key={q}
                to={`/sully?q=${encodeURIComponent(q)}`}
                className="px-3 py-1 bg-white/70 text-slate-600 text-xs rounded-full hover:bg-white transition-colors"
              >
                {q}
              </Link>
            ))}
          </div>
        </div>

        {/* Application Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Your Applications</h2>
            <Link to="/applications" className="text-primary-600 hover:underline text-sm flex items-center gap-1">
              View all
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {applications?.length === 0 ? (
            <div className="text-center py-6">
              <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No applications yet</p>
              <Link to="/jobs" className="text-primary-600 hover:underline text-sm">
                Browse jobs to apply
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-amber-50 rounded-lg text-center">
                  <div className="text-xl font-bold text-amber-700">
                    {applications?.filter((a: any) => a.status === 'pending').length || 0}
                  </div>
                  <div className="text-xs text-amber-600">Pending</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <div className="text-xl font-bold text-blue-700">
                    {applications?.filter((a: any) => a.status === 'in_review').length || 0}
                  </div>
                  <div className="text-xs text-blue-600">In Review</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg text-center">
                  <div className="text-xl font-bold text-emerald-700">
                    {applications?.filter((a: any) => a.status === 'interview').length || 0}
                  </div>
                  <div className="text-xs text-emerald-600">Interview</div>
                </div>
              </div>
              {applications?.slice(0, 2).map((app: any) => (
                <div key={app.id} className="p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-slate-900 text-sm truncate">{app.job_title}</div>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      app.status === 'in_review' ? 'bg-blue-100 text-blue-700' :
                      app.status === 'interview' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {app.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {new Date(app.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* News Headlines */}
      {newsArticles?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-slate-400" />
              Nursing News
            </h2>
            <Link to="/news" className="text-primary-600 hover:underline text-sm flex items-center gap-1">
              View all
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {newsArticles.map((article: any) => (
              <a
                key={article.id}
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/30 transition-colors"
              >
                <span className="text-xs text-primary-600 font-medium mb-1 block">
                  {article.source}
                </span>
                <h3 className="font-medium text-slate-900 text-sm line-clamp-2 mb-2">
                  {article.title}
                </h3>
                <span className="text-xs text-slate-400">
                  {article.published_at ? new Date(article.published_at).toLocaleDateString() : 'Recent'}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
