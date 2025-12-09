interface IndexData {
  score: number | null
  weighted: number
  weight_pct: number
  name: string
}

interface IndexBreakdownProps {
  indices: Record<string, IndexData>
  showWeights?: boolean
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'bg-slate-200'
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-sky-500'
  if (score >= 40) return 'bg-amber-500'
  if (score >= 20) return 'bg-orange-500'
  return 'bg-red-500'
}

function getScoreBgColor(score: number | null): string {
  if (score === null) return 'bg-slate-50'
  if (score >= 80) return 'bg-emerald-50'
  if (score >= 60) return 'bg-sky-50'
  if (score >= 40) return 'bg-amber-50'
  if (score >= 20) return 'bg-orange-50'
  return 'bg-red-50'
}

export default function IndexBreakdown({ indices, showWeights = true }: IndexBreakdownProps) {
  // Sort by weight descending
  const sortedIndices = Object.entries(indices)
    .map(([key, idx]) => ({ key, ...idx }))
    .sort((a, b) => b.weight_pct - a.weight_pct)

  return (
    <div className="space-y-3">
      {sortedIndices.map(({ key, score, weighted, weight_pct, name }) => (
        <div key={key} className={`rounded-lg p-3 ${getScoreBgColor(score)}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900">{name}</span>
              {showWeights && (
                <span className="text-xs text-slate-500">({weight_pct}% weight)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">
                {score !== null ? score : 'N/A'}
              </span>
              {showWeights && score !== null && (
                <span className="text-xs text-slate-500">
                  +{weighted.toFixed(1)} pts
                </span>
              )}
            </div>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getScoreColor(score)}`}
              style={{ width: `${score ?? 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
