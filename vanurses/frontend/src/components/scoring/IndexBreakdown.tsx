import { useState } from 'react'
import { Info } from 'lucide-react'

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

// Index descriptions from Scoring page methodology
const INDEX_DESCRIPTIONS: Record<string, string> = {
  pci: 'Analyzes how competitive pay rates are compared to regional and national benchmarks',
  eri: 'Aggregates employee sentiment from multiple trusted review platforms',
  lssi: 'Evaluates neighborhood safety using official crime statistics and community data',
  pei: 'Based on official CMS HCAHPS scores measuring patient satisfaction',
  fsi: 'Analyzes operational metrics that impact your work environment',
  cmsi: 'Official CMS Five-Star ratings for nursing homes measuring overall quality of care',
  ali: 'Measures convenience and quality of life near the facility',
  jti: 'Scores how transparent and complete job postings are',
  lsi: 'Leapfrog Hospital Safety Grades measuring patient safety practices at hospitals',
  csi: 'Evaluates traffic patterns and accessibility for your commute',
  qli: 'Assesses community demographics and living conditions',
  oii: 'Measures economic mobility and long-term opportunity potential based on Census Bureau research',
  cci: 'Considers weather patterns and seasonal conditions',
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
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)

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
              {/* Info tooltip */}
              {INDEX_DESCRIPTIONS[key] && (
                <div className="relative">
                  <button
                    onClick={() => setActiveTooltip(activeTooltip === key ? null : key)}
                    onMouseEnter={() => setActiveTooltip(key)}
                    onMouseLeave={() => setActiveTooltip(null)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={`Info about ${name}`}
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  {activeTooltip === key && (
                    <div className="absolute left-0 bottom-full mb-2 z-20 w-64 p-3 bg-slate-800 text-white text-sm rounded-lg shadow-lg">
                      <div className="font-medium mb-1">{name}</div>
                      <p className="text-slate-300 text-xs">{INDEX_DESCRIPTIONS[key]}</p>
                      {/* Arrow */}
                      <div className="absolute left-3 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-800" />
                    </div>
                  )}
                </div>
              )}
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
