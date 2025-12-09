import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts'

interface IndexData {
  score: number | null
  weighted: number
  weight_pct: number
  name: string
}

interface IndexRadarProps {
  indices: Record<string, IndexData>
  color?: string
}

export default function IndexRadar({ indices, color = '#0ea5e9' }: IndexRadarProps) {
  const data = Object.entries(indices)
    .filter(([key]) => key !== 'jti') // Exclude JTI from radar (shown separately)
    .map(([key, idx]) => ({
      index: idx.name.split(' ')[0], // Short name
      fullName: idx.name,
      value: idx.score ?? 0,
      weight: idx.weight_pct
    }))
    .sort((a, b) => b.weight - a.weight) // Sort by weight descending

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="index"
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
