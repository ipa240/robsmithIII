import { Link } from 'react-router-dom'
import { Clock, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { useSubscription } from '../hooks/useSubscription'

export default function TrialBanner() {
  const { isTrial, trialDaysRemaining, tier } = useSubscription()
  const [dismissed, setDismissed] = useState(false)

  // Don't show if not in trial, already paid, or dismissed
  if (!isTrial || tier !== 'free' || dismissed) {
    return null
  }

  const isUrgent = trialDaysRemaining <= 1

  return (
    <div className={`relative ${isUrgent ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-primary-500 to-accent-500'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-white">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium">
              {isUrgent ? (
                trialDaysRemaining === 0 ? (
                  "Your trial ends today! Upgrade now to keep premium features."
                ) : (
                  "Only 1 day left in your trial! Don't lose access to premium features."
                )
              ) : (
                `${trialDaysRemaining} days left in your free trial. Enjoying VANurses?`
              )}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/billing"
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isUrgent
                  ? 'bg-white text-red-600 hover:bg-red-50'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Upgrade Now
            </Link>

            {!isUrgent && (
              <button
                onClick={() => setDismissed(true)}
                className="text-white/70 hover:text-white p-1"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Inline trial indicator for specific features
export function TrialIndicator() {
  const { isTrial, trialDaysRemaining } = useSubscription()

  if (!isTrial) return null

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
      <Clock className="w-3 h-3" />
      Trial: {trialDaysRemaining}d left
    </span>
  )
}
