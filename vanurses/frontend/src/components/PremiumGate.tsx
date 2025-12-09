import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Crown, ChevronRight } from 'lucide-react'

interface PremiumGateProps {
  /** User's current subscription tier (optional - uses context if available) */
  userTier?: string
  /** Minimum tier required to view this content */
  requiredTier?: 'starter' | 'pro' | 'premium'
  /** Content to show if user has access */
  children?: ReactNode
  /** Title shown in the gate overlay (or feature name for backwards compat) */
  title?: string
  /** Feature name (backwards compat alias for title) */
  feature?: string
  /** Description shown in the gate overlay */
  description?: string
  /** Whether to blur the content or hide completely */
  blurContent?: boolean
  /** Show preview (backwards compat alias for blurContent) */
  showPreview?: boolean
  /** Preview content to show for free users (optional) */
  previewContent?: ReactNode
}

const TIER_LEVELS: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  premium: 3,
}

export default function PremiumGate({
  userTier = 'free',
  requiredTier = 'starter',
  children,
  title,
  feature,
  description = 'Upgrade your subscription to unlock this feature.',
  blurContent,
  showPreview,
  previewContent,
}: PremiumGateProps) {
  // Handle backwards compat props
  const displayTitle = title || feature || 'Premium Feature'
  const shouldBlur = blurContent ?? showPreview ?? true

  const userLevel = TIER_LEVELS[userTier?.toLowerCase()] || 0
  const requiredLevel = TIER_LEVELS[requiredTier] || 1

  const hasAccess = userLevel >= requiredLevel

  if (hasAccess) {
    return <>{children || null}</>
  }

  // If no children and not blurring, just show the upgrade prompt
  if (!children && !shouldBlur) {
    return (
      <div className="text-center p-6 max-w-md mx-auto">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-600 mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">{displayTitle}</h3>
        <p className="text-slate-600 mb-6">{description}</p>
        <Link
          to="/billing"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Crown className="w-5 h-5" />
          Upgrade to {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    )
  }

  // Show gated content
  return (
    <div className="relative">
      {/* Preview or blurred content */}
      {previewContent ? (
        <div>{previewContent}</div>
      ) : shouldBlur ? (
        <div className="blur-sm pointer-events-none select-none opacity-50">
          {children}
        </div>
      ) : null}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-white via-white/95 to-white/80 flex items-center justify-center">
        <div className="text-center p-6 max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-600 mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">{displayTitle}</h3>
          <p className="text-slate-600 mb-6">{description}</p>
          <Link
            to="/billing"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Crown className="w-5 h-5" />
            Upgrade to {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Simple inline badge for premium features */
export function PremiumBadge({ tier = 'starter' }: { tier?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
      <Crown className="w-3 h-3" />
      {tier.charAt(0).toUpperCase() + tier.slice(1)}+
    </span>
  )
}

/** Wrapper for showing limited preview with "See More" upgrade prompt */
export function LimitedPreview({
  userTier,
  requiredTier = 'starter',
  previewItems,
  totalItems,
  itemLabel = 'items',
  children,
}: {
  userTier: string
  requiredTier?: 'starter' | 'pro' | 'premium'
  previewItems: ReactNode
  totalItems: number
  itemLabel?: string
  children: ReactNode
}) {
  const userLevel = TIER_LEVELS[userTier?.toLowerCase()] || 0
  const requiredLevel = TIER_LEVELS[requiredTier] || 1

  if (userLevel >= requiredLevel) {
    return <>{children}</>
  }

  return (
    <div>
      {previewItems}
      <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-600">
            <Lock className="w-4 h-4" />
            <span>
              + {totalItems - 2} more {itemLabel} available
            </span>
          </div>
          <Link
            to="/billing"
            className="flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium text-sm"
          >
            Upgrade to see all
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
