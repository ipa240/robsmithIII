import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface ScoreGaugeProps {
  score: number
  grade: string
  size?: 'sm' | 'md' | 'lg'
}

function getGradeColor(grade: string): string {
  const baseGrade = grade?.[0]?.toUpperCase() || ''
  switch (baseGrade) {
    case 'A': return '#10b981'
    case 'B': return '#0ea5e9'
    case 'C': return '#f59e0b'
    case 'D': return '#f97316'
    case 'F': return '#ef4444'
    default: return '#94a3b8'
  }
}

export default function ScoreGauge({ score, grade, size = 'md' }: ScoreGaugeProps) {
  const color = getGradeColor(grade)
  const data = [
    { value: score, name: 'score' },
    { value: 100 - score, name: 'remaining' }
  ]

  const sizeClass = {
    sm: 'w-24 h-24',
    md: 'w-32 h-32',
    lg: 'w-40 h-40'
  }[size]

  const fontSizes = {
    sm: { grade: 'text-xl', score: 'text-xs' },
    md: { grade: 'text-2xl', score: 'text-sm' },
    lg: { grade: 'text-3xl', score: 'text-base' }
  }[size]

  return (
    <div className={`relative ${sizeClass}`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            startAngle={90}
            endAngle={-270}
            innerRadius="70%"
            outerRadius="100%"
            dataKey="value"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill="#e2e8f0" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold ${fontSizes.grade}`} style={{ color }}>{grade}</span>
        <span className={`text-slate-500 ${fontSizes.score}`}>{Math.round(score)}/100</span>
      </div>
    </div>
  )
}
