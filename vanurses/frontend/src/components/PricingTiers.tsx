import { Check, Crown, Star, Zap, Building2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'

interface PricingTiersProps {
  /** Show compact version for overlays */
  compact?: boolean
  /** Highlight a specific tier */
  highlightTier?: 'starter' | 'pro' | 'premium'
  /** Hide free tier */
  hideFree?: boolean
}

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    icon: Star,
    description: 'Browse jobs and join the community',
    features: [
      'Browse all job listings',
      'View top 3 facilities',
      '3 Sully AI questions/day',
      'Community access',
      'News & updates',
    ],
    cta: 'Current Plan',
    color: 'slate',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$9',
    period: '/month',
    icon: Zap,
    description: 'Full access to job details and scores',
    features: [
      'Everything in Free',
      'Unlimited job views',
      'All facility OFS scores',
      'Save unlimited jobs',
      'Compare 2 facilities',
      '10 Sully questions/day',
    ],
    cta: 'Upgrade',
    color: 'blue',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19',
    period: '/month',
    icon: Crown,
    description: 'Advanced analytics and personalization',
    features: [
      'Everything in Starter',
      'Trend analytics',
      'Compare 5 facilities',
      'Personalized recommendations',
      '25 Sully questions/day',
      'Priority job alerts',
    ],
    cta: 'Upgrade',
    color: 'primary',
    popular: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$39',
    period: '/month',
    icon: Crown,
    description: 'Complete toolkit for serious job seekers',
    features: [
      'Everything in Pro',
      'Unlimited comparisons',
      'Resume builder',
      'PDF exports',
      'Custom scoring weights',
      'Unlimited Sully AI',
    ],
    cta: 'Upgrade',
    color: 'amber',
  },
]

export default function PricingTiers({
  compact = false,
  highlightTier,
  hideFree = false,
}: PricingTiersProps) {
  const { tier: currentTier } = useSubscription()

  const displayTiers = hideFree
    ? TIERS.filter((t) => t.id !== 'free')
    : TIERS

  if (compact) {
    // Compact version for overlays - just show 3 paid tiers
    const paidTiers = TIERS.filter((t) => t.id !== 'free')

    return (
      <div className="grid grid-cols-3 gap-3 text-left">
        {paidTiers.map((tier) => {
          const Icon = tier.icon
          const isHighlighted =
            highlightTier === tier.id || (!highlightTier && tier.popular)
          const isCurrent = currentTier === tier.id

          return (
            <div
              key={tier.id}
              className={`relative p-3 rounded-lg border ${
                isHighlighted
                  ? 'border-primary-300 bg-primary-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary-600 text-white text-xs font-medium rounded-full">
                  Popular
                </div>
              )}
              <div className="flex items-center gap-2 mb-1">
                <Icon
                  className={`w-4 h-4 ${
                    isHighlighted ? 'text-primary-600' : 'text-slate-400'
                  }`}
                />
                <span className="font-semibold text-slate-900">
                  {tier.name}
                </span>
              </div>
              <div className="text-lg font-bold text-slate-900">
                {tier.price}
                <span className="text-xs font-normal text-slate-500">
                  {tier.period}
                </span>
              </div>
              {isCurrent && (
                <span className="text-xs text-green-600 font-medium">
                  Current
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Full version
  return (
    <div className="grid md:grid-cols-4 gap-4">
      {displayTiers.map((tier) => {
        const Icon = tier.icon
        const isHighlighted =
          highlightTier === tier.id || (!highlightTier && tier.popular)
        const isCurrent = currentTier === tier.id

        const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
          slate: {
            bg: 'bg-slate-50',
            text: 'text-slate-600',
            border: 'border-slate-200',
          },
          blue: {
            bg: 'bg-blue-50',
            text: 'text-blue-600',
            border: 'border-blue-200',
          },
          primary: {
            bg: 'bg-primary-50',
            text: 'text-primary-600',
            border: 'border-primary-300',
          },
          amber: {
            bg: 'bg-amber-50',
            text: 'text-amber-600',
            border: 'border-amber-200',
          },
        }

        const colors = colorClasses[tier.color] || colorClasses.slate

        return (
          <div
            key={tier.id}
            className={`relative rounded-xl border-2 p-5 ${
              isHighlighted
                ? `${colors.border} ${colors.bg}`
                : 'border-slate-200 bg-white'
            } ${isCurrent ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}
          >
            {tier.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary-600 text-white text-xs font-semibold rounded-full">
                Most Popular
              </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-8 h-8 rounded-lg ${colors.bg} ${colors.text} flex items-center justify-center`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="font-bold text-lg text-slate-900">
                {tier.name}
              </span>
            </div>

            {/* Price */}
            <div className="mb-3">
              <span className="text-3xl font-bold text-slate-900">
                {tier.price}
              </span>
              <span className="text-slate-500 text-sm">{tier.period}</span>
            </div>

            {/* Description */}
            <p className="text-slate-600 text-sm mb-4">{tier.description}</p>

            {/* Features */}
            <ul className="space-y-2 mb-5">
              {tier.features.map((feature, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-slate-600"
                >
                  <Check
                    className={`w-4 h-4 flex-shrink-0 mt-0.5 ${colors.text}`}
                  />
                  {feature}
                </li>
              ))}
            </ul>

            {/* CTA */}
            {isCurrent ? (
              <div className="w-full py-2.5 bg-green-100 text-green-700 rounded-lg text-center font-medium text-sm">
                Current Plan
              </div>
            ) : tier.id === 'free' ? (
              <div className="w-full py-2.5 bg-slate-100 text-slate-500 rounded-lg text-center font-medium text-sm">
                Free Forever
              </div>
            ) : (
              <Link
                to="/billing"
                className={`block w-full py-2.5 rounded-lg text-center font-medium text-sm transition-colors ${
                  isHighlighted
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tier.cta}
              </Link>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** HR-specific pricing display */
export function HRPricingTier() {
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-lg">HR / Recruiter Portal</h3>
          <p className="text-slate-300 text-sm">Enterprise solutions</p>
        </div>
      </div>

      <ul className="space-y-2 mb-5">
        {[
          'Post unlimited job listings',
          'Access candidate database',
          'Facility branding & promotion',
          'Analytics dashboard',
          'Priority support',
        ].map((feature, idx) => (
          <li key={idx} className="flex items-center gap-2 text-sm text-slate-200">
            <Check className="w-4 h-4 text-green-400" />
            {feature}
          </li>
        ))}
      </ul>

      <Link
        to="/hr/signup"
        className="block w-full py-2.5 bg-white text-slate-900 rounded-lg text-center font-medium text-sm hover:bg-slate-100 transition-colors"
      >
        Contact Sales
      </Link>
    </div>
  )
}
