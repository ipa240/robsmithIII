import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { X, LogIn } from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import { isAdminUnlocked } from '../hooks/useSubscription'
import SullyChat from './SullyChat'

export default function SullyButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const location = useLocation()
  const auth = useAuth()

  // Check if user has access (authenticated OR admin unlocked)
  const hasAccess = auth.isAuthenticated || isAdminUnlocked()

  // Hide on the Sully page since it has its own full chat interface
  if (location.pathname === '/sully') {
    return null
  }

  const handleClick = () => {
    if (!hasAccess) {
      setShowLoginPrompt(!showLoginPrompt)
    } else {
      setIsOpen(!isOpen)
      setShowLoginPrompt(false)
    }
  }

  return (
    <>
      {/* Chat Popup - for authenticated users or admin unlocked */}
      {hasAccess && (
        <SullyChat isOpen={isOpen} onClose={() => setIsOpen(false)} />
      )}

      {/* Login Prompt Popup for non-authenticated users */}
      {showLoginPrompt && !hasAccess && (
        <div className="fixed bottom-24 right-6 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          <div className="bg-gradient-to-r from-primary-600 to-accent-600 p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full ring-2 ring-white/50 overflow-hidden">
                <img
                  src="/media/sully/sully-neutral.jpg"
                  alt="Sully"
                  className="w-full h-full object-cover scale-125"
                />
              </div>
              <div>
                <h3 className="font-bold">Meet Sully!</h3>
                <p className="text-sm text-primary-100">Your AI nursing assistant</p>
              </div>
            </div>
          </div>
          <div className="p-4">
            <p className="text-sm text-slate-600 mb-4">
              Create a free account to chat with Sully and get personalized job recommendations, interview tips, and career advice.
            </p>
            <button
              onClick={() => auth.signinRedirect()}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Sign Up Free
            </button>
            <p className="text-xs text-slate-400 text-center mt-2">
              Already have an account? <button onClick={() => auth.signinRedirect()} className="text-primary-600 hover:underline">Log in</button>
            </p>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={handleClick}
        className={`fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all z-50 overflow-hidden ${
          isOpen || showLoginPrompt
            ? 'bg-slate-700'
            : 'hover:scale-110 hover:shadow-xl ring-2 ring-white ring-offset-2'
        }`}
        title="Chat with Sully"
      >
        {isOpen || showLoginPrompt ? (
          <X className="w-7 h-7 text-white" />
        ) : (
          <img
            src="/media/sully/sully-neutral.jpg"
            alt="Chat with Sully"
            className="w-full h-full object-cover scale-125"
          />
        )}
      </button>
    </>
  )
}
