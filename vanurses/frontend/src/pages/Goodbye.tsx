import { Link } from 'react-router-dom'
import { Heart, Home, ExternalLink } from 'lucide-react'

export default function Goodbye() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-100 text-primary-600 mb-6">
          <Heart className="w-10 h-10" />
        </div>

        {/* Message */}
        <h1 className="text-3xl font-bold text-slate-900 mb-4">
          Sorry to see you go
        </h1>
        <p className="text-slate-600 mb-8">
          Your account has been deleted. We appreciate you being part of the VANurses community.
          If you ever want to come back, we'll be here!
        </p>

        {/* Actions */}
        <div className="space-y-4">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </Link>

          <div className="text-sm text-slate-500">
            Have feedback?{' '}
            <a
              href="mailto:support@vanurses.net"
              className="text-primary-600 hover:underline inline-flex items-center gap-1"
            >
              Let us know
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Encouragement */}
        <div className="mt-12 p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500">
            Best of luck in your nursing career! Virginia's healthcare community is lucky to have you.
          </p>
        </div>
      </div>
    </div>
  )
}
