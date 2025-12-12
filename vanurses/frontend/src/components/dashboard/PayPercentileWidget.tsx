import { DollarSign, TrendingUp } from 'lucide-react'

interface PayPercentileData {
  data: {
    min: number
    p25: number
    median: number
    p75: number
    max: number
    sampleSize: number
  } | null
  specialty: string
  message: string | null
}

interface Props {
  data: PayPercentileData | undefined
  isLoading: boolean
}

export default function PayPercentileWidget({ data, isLoading }: Props) {
  // Show loading state when data is loading OR when data hasn't been fetched yet
  if (isLoading || !data || !data.data) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
        <div className="h-6 bg-slate-100 rounded w-1/3 mb-4" />
        <div className="h-8 bg-slate-100 rounded w-full mb-4" />
        <div className="h-4 bg-slate-100 rounded w-1/2" />
      </div>
    )
  }

  const { min, p25, median, p75, max } = data.data
  const range = max - min

  const getPosition = (value: number) => ((value - min) / range) * 100

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-5 h-5 text-emerald-600" />
        <h3 className="font-semibold text-slate-900">Pay Range: {data.specialty || 'Your Role'}</h3>
      </div>

      {/* Pay bar visualization */}
      <div className="relative mb-4">
        <div className="h-8 bg-gradient-to-r from-slate-100 via-emerald-100 to-emerald-200 rounded-lg overflow-hidden">
          {/* Quartile markers */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
            style={{ left: `${getPosition(p25)}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-1 bg-emerald-600"
            style={{ left: `${getPosition(median)}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
            style={{ left: `${getPosition(p75)}%` }}
          />
        </div>

        {/* Labels */}
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>${min.toFixed(0)}</span>
          <span className="text-emerald-600 font-medium">Median: ${median.toFixed(0)}/hr</span>
          <span>${max.toFixed(0)}</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-slate-600">${min.toFixed(0)}</div>
          <div className="text-xs text-slate-400">Min</div>
        </div>
        <div>
          <div className="text-lg font-bold text-slate-700">${p25.toFixed(0)}</div>
          <div className="text-xs text-slate-400">25th</div>
        </div>
        <div>
          <div className="text-lg font-bold text-emerald-600">${median.toFixed(0)}</div>
          <div className="text-xs text-slate-400">Median</div>
        </div>
        <div>
          <div className="text-lg font-bold text-slate-700">${p75.toFixed(0)}</div>
          <div className="text-xs text-slate-400">75th</div>
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-400 text-center flex items-center justify-center gap-1">
        <TrendingUp className="w-3 h-3" />
        Based on {data.data.sampleSize} active job postings
      </div>
    </div>
  )
}
