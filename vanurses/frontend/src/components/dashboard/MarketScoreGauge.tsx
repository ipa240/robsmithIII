import { TrendingUp, Lightbulb } from 'lucide-react'

interface MarketScoreData {
  score: number | null
  grade?: string
  factors?: {
    license_demand: number
    specialty_demand: number
    experience_match: number
  }
  suggestions?: string[]
  message?: string
}

interface Props {
  data: MarketScoreData | undefined
  isLoading: boolean
}

export default function MarketScoreGauge({ data, isLoading }: Props) {
  // Show loading state when data is loading OR when data hasn't been fetched yet
  if (isLoading || !data || data.score === null) {
    return (
      <div className="bg-gradient-to-br from-primary-50 to-accent-50 rounded-xl border border-primary-100 p-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 bg-primary-100 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-primary-100 rounded w-3/4" />
            <div className="h-4 bg-primary-100 rounded w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  const score = data.score
  const circumference = 2 * Math.PI * 42
  const progress = (score / 100) * circumference

  const getScoreColor = (s: number) => {
    if (s >= 80) return { stroke: '#10b981', bg: 'from-emerald-50', text: 'text-emerald-600' }
    if (s >= 60) return { stroke: '#3b82f6', bg: 'from-blue-50', text: 'text-blue-600' }
    if (s >= 40) return { stroke: '#f59e0b', bg: 'from-amber-50', text: 'text-amber-600' }
    return { stroke: '#ef4444', bg: 'from-red-50', text: 'text-red-600' }
  }

  const colors = getScoreColor(score)

  return (
    <div className={`bg-gradient-to-br ${colors.bg} to-white rounded-xl border border-slate-200 p-6`}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className={`w-5 h-5 ${colors.text}`} />
        <h3 className="font-semibold text-slate-900">Your Market Advantage Score</h3>
      </div>

      <div className="flex items-center gap-6">
        {/* Circular Gauge */}
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="56"
              cy="56"
              r="42"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="12"
            />
            <circle
              cx="56"
              cy="56"
              r="42"
              fill="none"
              stroke={colors.stroke}
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold ${colors.text}`}>{score}</span>
            <span className="text-xs text-slate-500">/100</span>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1">
          <div className={`text-lg font-semibold ${colors.text} mb-2`}>{data.grade}</div>

          {data.factors && (
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">License Demand</span>
                <span className="font-medium">{Math.round(data.factors.license_demand)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Specialty Demand</span>
                <span className="font-medium">{Math.round(data.factors.specialty_demand)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Experience Match</span>
                <span className="font-medium">{Math.round(data.factors.experience_match)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Suggestions */}
      {data.suggestions && data.suggestions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-600">{data.suggestions[0]}</p>
          </div>
        </div>
      )}
    </div>
  )
}
