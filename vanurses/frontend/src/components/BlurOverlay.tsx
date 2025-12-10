import { ReactNode, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Crown, ChevronRight, Play, Sparkles } from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import DemoModal from './DemoModal'
import PricingTiers from './PricingTiers'

interface BlurOverlayProps {
  /** Title shown in the overlay */
  title: string
  /** Description of what this feature does */
  description: string
  /** Show demo button */
  showDemo?: boolean
  /** Demo key for DemoModal content selection */
  demoKey?: 'compare' | 'dashboard' | 'trends' | 'learning' | 'applications' | 'profile' | 'resume'
  /** Show pricing tiers in overlay */
  showPricing?: boolean
  /** Custom CTA button text */
  ctaText?: string
  /** Custom CTA link */
  ctaLink?: string
  /** Callback when demo button is clicked */
  onDemoClick?: () => void
  /** Content to blur */
  children: ReactNode
  /** Intensity of blur effect */
  blurIntensity?: 'light' | 'medium' | 'heavy'
  /** Show signup CTA for unauthenticated users */
  showSignupCta?: boolean
}

export default function BlurOverlay({
  title,
  description,
  showDemo = false,
  demoKey,
  showPricing = false,
  ctaText,
  ctaLink,
  onDemoClick,
  children,
  blurIntensity = 'medium',
  showSignupCta = false,
}: BlurOverlayProps) {
  const auth = useAuth()
  const [showDemoModal, setShowDemoModal] = useState(false)

  const blurClasses = {
    light: 'blur-[2px]',
    medium: 'blur-sm',
    heavy: 'blur-md',
  }

  const isAuthenticated = auth.isAuthenticated

  const handleDemoClick = () => {
    if (onDemoClick) {
      onDemoClick()
    } else {
      setShowDemoModal(true)
    }
  }

  return (
    <div className="relative">
      {/* Blurred content */}
      <div
        className={`${blurClasses[blurIntensity]} pointer-events-none select-none`}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-white via-white/95 to-white/80 flex items-center justify-center p-4">
        <div className="text-center max-w-lg">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-600 mb-4">
            <Lock className="w-8 h-8" />
          </div>

          {/* Title & Description */}
          <h3 className="text-xl font-semibold text-slate-900 mb-2">{title}</h3>
          <p className="text-slate-600 mb-6">{description}</p>

          {/* Pricing Tiers (if enabled) */}
          {showPricing && (
            <div className="mb-6">
              <PricingTiers compact />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {/* Demo Button */}
            {showDemo && (
              <button
                onClick={handleDemoClick}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                <Play className="w-4 h-4" />
                See How It Works
              </button>
            )}

            {/* Primary CTA */}
            {showSignupCta && !isAuthenticated ? (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                <Sparkles className="w-5 h-5" />
                Create Free Account
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                to={ctaLink || '/billing'}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                <Crown className="w-5 h-5" />
                {ctaText || 'Upgrade Now'}
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Demo Modal */}
      {showDemoModal && demoKey && (
        <DemoModal
          demoKey={demoKey}
          onClose={() => setShowDemoModal(false)}
        />
      )}
    </div>
  )
}

/** Inline blur for single elements like badges/scores */
export function BlurredValue({
  children,
  showUpgradeHint = false,
}: {
  children: ReactNode
  showUpgradeHint?: boolean
}) {
  return (
    <span className="relative inline-block">
      <span className="blur-sm select-none">{children}</span>
      {showUpgradeHint && (
        <span
          className="absolute inset-0 flex items-center justify-center"
          title="Upgrade to view"
        >
          <Lock className="w-3 h-3 text-slate-400" />
        </span>
      )}
    </span>
  )
}

/** Simple banner for view limit reached */
export function ViewLimitBanner({
  title = "You've reached your viewing limit",
  description = "Create a free account to continue exploring jobs",
  isAuthenticated = false,
}: {
  title?: string
  description?: string
  isAuthenticated?: boolean
}) {
  return (
    <div className="bg-gradient-to-r from-primary-50 to-teal-50 border border-primary-200 rounded-xl p-6 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 mb-3">
        <Lock className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 mb-4">{description}</p>
      {!isAuthenticated ? (
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          <Sparkles className="w-4 h-4" />
          Sign Up Free
        </Link>
      ) : (
        <Link
          to="/billing"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          <Crown className="w-4 h-4" />
          Upgrade Plan
        </Link>
      )}
    </div>
  )
}
