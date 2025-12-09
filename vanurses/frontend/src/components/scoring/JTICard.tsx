import { Eye, Gift, Clock, DollarSign, Heart } from 'lucide-react'

interface JTIData {
  jti_score: number | null
  jti_grade: string | null
  jobs_analyzed: number
  breakdown: {
    pay_disclosure_rate: number
    benefits_disclosure_rate: number
    bonus_disclosure_rate: number
    shift_clarity_rate: number
  }
  comparison: {
    region: string | null
    region_average: number | null
    vs_region: number | null
  }
}

interface JTICardProps {
  data: JTIData | null
  loading?: boolean
  compact?: boolean
}

function getGradeColor(grade: string | null): string {
  switch (grade?.[0]?.toUpperCase()) {
    case 'A': return 'text-emerald-600 bg-emerald-100'
    case 'B': return 'text-sky-600 bg-sky-100'
    case 'C': return 'text-amber-600 bg-amber-100'
    case 'D': return 'text-orange-600 bg-orange-100'
    case 'F': return 'text-red-600 bg-red-100'
    default: return 'text-slate-600 bg-slate-100'
  }
}

export default function JTICard({ data, loading, compact = false }: JTICardProps) {
  if (loading) {
    return (
      <div className={`bg-slate-50 rounded-lg border border-slate-200 ${compact ? 'p-4' : 'p-6'} animate-pulse`}>
        <div className="h-5 bg-slate-200 rounded w-1/3 mb-3"></div>
        <div className="h-16 bg-slate-100 rounded"></div>
      </div>
    )
  }

  if (!data || data.jti_score === null) {
    return (
      <div className={`bg-slate-50 rounded-lg border border-slate-200 ${compact ? 'p-4' : 'p-6'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Eye className="w-4 h-4 text-purple-600" />
          <h3 className={`font-medium text-slate-900 ${compact ? 'text-sm' : ''}`}>Job Transparency</h3>
        </div>
        <p className="text-slate-500 text-xs">
          Transparency data not yet available.
        </p>
      </div>
    )
  }

  // Compact version - fits in with other index cards
  if (compact) {
    return (
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-purple-600" />
            <span className="font-medium text-slate-900 text-sm">Job Transparency</span>
          </div>
          <div className={`px-2 py-0.5 rounded-full text-sm font-bold ${getGradeColor(data.jti_grade)}`}>
            {data.jti_grade || 'N/A'} ({data.jti_score})
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-sm font-bold text-slate-900">{data.breakdown.pay_disclosure_rate}%</div>
            <div className="text-xs text-slate-500">Pay</div>
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">{data.breakdown.benefits_disclosure_rate}%</div>
            <div className="text-xs text-slate-500">Benefits</div>
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">{data.breakdown.bonus_disclosure_rate}%</div>
            <div className="text-xs text-slate-500">Bonus</div>
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">{data.breakdown.shift_clarity_rate}%</div>
            <div className="text-xs text-slate-500">Shift</div>
          </div>
        </div>
      </div>
    )
  }

  // Full version
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-slate-900">Job Transparency Index</h3>
        </div>
        <div className={`px-3 py-1 rounded-full font-bold ${getGradeColor(data.jti_grade)}`}>
          {data.jti_grade || 'N/A'} ({data.jti_score})
        </div>
      </div>

      <p className="text-sm text-slate-500 mb-4">
        Based on analysis of {data.jobs_analyzed} active job posting{data.jobs_analyzed !== 1 ? 's' : ''}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <DollarSign className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-slate-900">{data.breakdown.pay_disclosure_rate}%</div>
          <div className="text-xs text-slate-500">Pay Disclosed</div>
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <Heart className="w-5 h-5 text-pink-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-slate-900">{data.breakdown.benefits_disclosure_rate}%</div>
          <div className="text-xs text-slate-500">Benefits Listed</div>
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <Gift className="w-5 h-5 text-amber-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-slate-900">{data.breakdown.bonus_disclosure_rate}%</div>
          <div className="text-xs text-slate-500">Bonus Disclosed</div>
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <Clock className="w-5 h-5 text-purple-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-slate-900">{data.breakdown.shift_clarity_rate}%</div>
          <div className="text-xs text-slate-500">Shift Clarity</div>
        </div>
      </div>

      {data.comparison.region_average !== null && (
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">
              vs {data.comparison.region?.replace('_', ' ')} average
            </span>
            <span className={`font-medium ${(data.comparison.vs_region || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {(data.comparison.vs_region || 0) >= 0 ? '+' : ''}{data.comparison.vs_region}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
