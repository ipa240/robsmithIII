import { Flame, Award, Target, CheckCircle, Bookmark, Folder, Crown, Star } from 'lucide-react'

interface Badge {
  id: string
  name: string
  icon: string
}

interface NextMilestone {
  days: number
  name: string
  icon: string
  daysRemaining: number
}

interface StreakData {
  currentStreak: number
  longestStreak: number
  lastLogin: string
  badges: Badge[]
  nextMilestone: NextMilestone
}

interface Props {
  data: StreakData | undefined
  isLoading: boolean
}

const iconMap: Record<string, any> = {
  fire: Flame,
  trophy: Award,
  crown: Crown,
  star: Star,
  'check-circle': CheckCircle,
  bookmark: Bookmark,
  folder: Folder,
  footprints: Target,
  medal: Award,
  diamond: Star
}

export default function StreakCounter({ data, isLoading }: Props) {
  // Show loading state when data is loading OR when data hasn't been fetched yet
  if (isLoading || !data) {
    return (
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200 p-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-orange-100 rounded w-1/3 mb-2" />
            <div className="h-3 bg-orange-100 rounded w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  const Icon = iconMap[data.nextMilestone?.icon] || Flame

  return (
    <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200 p-4">
      <div className="flex items-center gap-4">
        {/* Streak flame */}
        <div className="relative">
          <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg">
            <Flame className="w-7 h-7 text-white" />
          </div>
          {data.currentStreak > 0 && (
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full px-2 py-0.5 text-xs font-bold text-orange-600 shadow">
              {data.currentStreak}
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-orange-600">
              {data.currentStreak} day{data.currentStreak !== 1 ? 's' : ''}
            </span>
            {data.longestStreak > data.currentStreak && (
              <span className="text-xs text-slate-500">
                (Best: {data.longestStreak})
              </span>
            )}
          </div>

          {/* Next milestone progress */}
          {data.nextMilestone && data.nextMilestone.daysRemaining > 0 && (
            <div className="mt-1">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Icon className="w-3 h-3" />
                <span>{data.nextMilestone.daysRemaining} more for "{data.nextMilestone.name}"</span>
              </div>
              <div className="mt-1 h-1.5 bg-orange-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full transition-all"
                  style={{
                    width: `${((data.currentStreak / data.nextMilestone.days) * 100).toFixed(0)}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Badges */}
      {data.badges.length > 0 && (
        <div className="mt-3 pt-3 border-t border-orange-200/50">
          <div className="flex flex-wrap gap-2">
            {data.badges.slice(0, 4).map(badge => {
              const BadgeIcon = iconMap[badge.icon] || Award
              return (
                <div
                  key={badge.id}
                  className="flex items-center gap-1.5 px-2 py-1 bg-white/60 rounded-full text-xs"
                  title={badge.name}
                >
                  <BadgeIcon className="w-3 h-3 text-amber-600" />
                  <span className="text-slate-700">{badge.name}</span>
                </div>
              )
            })}
            {data.badges.length > 4 && (
              <span className="px-2 py-1 text-xs text-slate-500">
                +{data.badges.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
