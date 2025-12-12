import { Link } from 'react-router-dom'
import { DollarSign, Gift, Flame, Target, AlertCircle } from 'lucide-react'

interface QuickInsightsData {
  paySpikes: {
    facilities: { name: string; city: string; jobs: number }[]
    description: string
  }
  signOnBonuses: {
    count: number
    avgBonus: number
    description: string
  }
  hotSpecialties: {
    specialties: { name: string; jobs: number }[]
    description: string
  }
  jobMatches: {
    count: number
    description: string
  }
}

interface Props {
  data: QuickInsightsData | undefined
  isLoading: boolean
  isError?: boolean
}

export default function QuickInsightsBar({ data, isLoading, isError }: Props) {
  // Show loading state only when actively loading
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
            <div className="w-8 h-8 bg-slate-100 rounded-lg mb-3" />
            <div className="h-4 bg-slate-100 rounded w-1/2 mb-2" />
            <div className="h-6 bg-slate-100 rounded w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  // Show error state if there was an error or no data after loading
  if (isError || !data) {
    return (
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-center">
        <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-slate-600 text-sm">Unable to load insights</p>
        <p className="text-slate-500 text-xs mt-1">Try refreshing the page</p>
      </div>
    )
  }

  const cards = [
    {
      icon: DollarSign,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      title: 'Pay Spikes',
      value: data.paySpikes.facilities.length > 0
        ? `${data.paySpikes.facilities[0].name}`
        : 'No spikes',
      subtext: data.paySpikes.facilities.length > 0
        ? `+${data.paySpikes.facilities.length - 1} more facilities`
        : 'All paying normally',
      link: '/facilities?sort=pay'
    },
    {
      icon: Gift,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      title: 'Sign-On Bonuses',
      value: data.signOnBonuses.count > 0
        ? `${data.signOnBonuses.count} jobs`
        : 'None available',
      subtext: data.signOnBonuses.avgBonus > 0
        ? `Avg $${data.signOnBonuses.avgBonus.toLocaleString()}`
        : 'Check back soon',
      link: '/jobs?bonus=true'
    },
    {
      icon: Flame,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      title: 'Hot Specialties',
      value: data.hotSpecialties.specialties[0]?.name || 'N/A',
      subtext: data.hotSpecialties.specialties[0]
        ? `${data.hotSpecialties.specialties[0].jobs} jobs`
        : '',
      link: '/trends'
    },
    {
      icon: Target,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      title: 'Your Matches',
      value: data.jobMatches.count > 0
        ? `${data.jobMatches.count} jobs`
        : 'Complete profile',
      subtext: data.jobMatches.count > 0
        ? 'Match your profile'
        : 'to see matches',
      link: '/results'
    }
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <Link
          key={i}
          to={card.link}
          className="bg-white rounded-xl border border-slate-200 p-4 hover:border-primary-300 hover:shadow-sm transition-all"
        >
          <div className={`w-8 h-8 ${card.iconBg} rounded-lg flex items-center justify-center mb-3`}>
            <card.icon className={`w-4 h-4 ${card.iconColor}`} />
          </div>
          <div className="text-xs text-slate-500 mb-1">{card.title}</div>
          <div className="font-semibold text-slate-900 truncate">{card.value}</div>
          <div className="text-xs text-slate-500 truncate">{card.subtext}</div>
        </Link>
      ))}
    </div>
  )
}
