import { Link } from 'react-router-dom'
import { UserCircle, ChevronRight, Sparkles } from 'lucide-react'

export default function CompleteOnboardingPrompt() {
  return (
    <div className="bg-gradient-to-r from-primary-50 via-accent-50 to-primary-50 rounded-xl border border-primary-200 p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
          <UserCircle className="w-7 h-7 text-primary-600" />
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Unlock Personalized Insights
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Complete your profile to see your Market Advantage Score, personalized job matches, and pay comparisons for your specialty.
          </p>
        </div>

        <Link
          to="/onboarding"
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors flex-shrink-0"
        >
          Complete Profile
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Feature preview */}
      <div className="mt-4 pt-4 border-t border-primary-200/50 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-xl font-bold text-primary-600">Score</div>
          <div className="text-xs text-slate-500">Market Advantage</div>
        </div>
        <div>
          <div className="text-xl font-bold text-emerald-600">Jobs</div>
          <div className="text-xs text-slate-500">Matched to You</div>
        </div>
        <div>
          <div className="text-xl font-bold text-purple-600">Pay</div>
          <div className="text-xs text-slate-500">vs Market Rate</div>
        </div>
      </div>
    </div>
  )
}
