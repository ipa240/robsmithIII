import { Link } from 'react-router-dom'
import { DollarSign, Star, Clock, ArrowRight } from 'lucide-react'

interface Job {
  id: string
  title: string
  specialty: string
  payMin: number | null
  payMax: number | null
  city: string
  state: string
  facilityName: string
  ofsGrade: string | null
}

interface RecommendationCategory {
  title: string
  icon: string
  jobs: Job[]
}

interface RecommendationsData {
  bestPay: RecommendationCategory
  bestFacility: RecommendationCategory
  newThisWeek: RecommendationCategory
}

interface Props {
  data: RecommendationsData | undefined
  isLoading: boolean
}

const iconMap: Record<string, any> = {
  dollar: DollarSign,
  star: Star,
  clock: Clock
}

const gradeColors: Record<string, string> = {
  A: 'bg-emerald-500',
  B: 'bg-blue-500',
  C: 'bg-amber-500',
  D: 'bg-orange-500',
  F: 'bg-red-500'
}

export default function RecommendationRows({ data, isLoading }: Props) {
  // Show loading state when data is loading OR when data hasn't been fetched yet
  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
            <div className="h-5 bg-slate-100 rounded w-1/4 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map(j => (
                <div key={j} className="h-16 bg-slate-50 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const categories = [data.bestPay, data.bestFacility, data.newThisWeek]

  return (
    <div className="space-y-6">
      {categories.map((category, idx) => {
        if (!category.jobs.length) return null
        const Icon = iconMap[category.icon] || DollarSign

        return (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-primary-50 rounded-lg flex items-center justify-center">
                <Icon className="w-3.5 h-3.5 text-primary-600" />
              </div>
              <h3 className="font-semibold text-slate-900">{category.title}</h3>
            </div>

            <div className="space-y-2">
              {category.jobs.map(job => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/50 transition-colors"
                >
                  {job.ofsGrade && (
                    <div className={`w-8 h-8 ${gradeColors[job.ofsGrade] || 'bg-slate-400'} rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {job.ofsGrade}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">{job.title}</div>
                    <div className="text-sm text-slate-500 truncate">
                      {job.facilityName} • {job.city}, {job.state}
                    </div>
                  </div>
                  {job.payMax && (
                    <div className="text-sm font-medium text-emerald-600 flex-shrink-0">
                      ${job.payMax.toFixed(0)}/hr
                    </div>
                  )}
                </Link>
              ))}
            </div>

            {category.jobs.length >= 3 && (
              <Link
                to="/jobs"
                className="mt-3 flex items-center justify-center gap-1 text-sm text-primary-600 hover:underline"
              >
                View more
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        )
      })}
    </div>
  )
}
