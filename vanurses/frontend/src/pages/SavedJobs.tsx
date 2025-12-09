import { useAuth } from 'react-oidc-context'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bookmark, MapPin, Clock, DollarSign, Building2 } from 'lucide-react'
import { api, setAuthToken } from '../api/client'
import { useEffect } from 'react'

export default function SavedJobs() {
  const auth = useAuth()

  useEffect(() => {
    if (auth.user?.access_token) {
      setAuthToken(auth.user.access_token)
    }
  }, [auth.user?.access_token])

  const { data: savedJobs, isLoading } = useQuery({
    queryKey: ['saved-jobs'],
    queryFn: () => api.get('/api/me/saved-jobs').then(res => res.data.data),
    enabled: !!auth.user?.access_token
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Saved Jobs</h1>
        <p className="text-slate-600">
          {savedJobs?.length || 0} jobs saved
        </p>
      </div>

      {!savedJobs || savedJobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Bookmark className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No saved jobs yet</h3>
          <p className="text-slate-500 mb-4">
            Browse jobs and click the save button to add them here.
          </p>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Browse Jobs
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {savedJobs.map((job: any) => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className="block bg-white rounded-xl border border-slate-200 p-6 hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {job.title}
                  </h3>

                  {job.facility_name && (
                    <div className="flex items-center gap-2 text-primary-600 mb-3">
                      <Building2 className="w-4 h-4" />
                      <span className="font-medium">{job.facility_name}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    {job.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.city}, {job.state}
                      </span>
                    )}
                    {job.shift_type && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {job.shift_type}
                      </span>
                    )}
                    {(job.pay_min || job.pay_max) && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${job.pay_min?.toLocaleString() || job.pay_max?.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

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
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-400">
                Saved {new Date(job.saved_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
