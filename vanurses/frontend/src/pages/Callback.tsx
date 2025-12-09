import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { useNavigate } from 'react-router-dom'
import { api, setAuthToken } from '../api/client'

export default function Callback() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    async function checkOnboarding() {
      if (!auth.isAuthenticated || checking) return
      if (!auth.user?.access_token) return

      setChecking(true)

      // IMPORTANT: Set auth token before making API calls
      setAuthToken(auth.user.access_token)

      try {
        const response = await api.get('/api/me')
        const userData = response.data?.data

        // Check if onboarding is completed (stored directly on user object)
        const onboardingCompleted = userData?.onboarding_completed

        if (!onboardingCompleted) {
          // Redirect to onboarding for new users
          navigate('/onboarding', { replace: true })
        } else {
          // Redirect to dashboard or intended destination
          const returnTo = (auth.user?.state as { returnTo?: string })?.returnTo || '/dashboard'
          navigate(returnTo, { replace: true })
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
        // On error, redirect to onboarding to be safe
        navigate('/onboarding', { replace: true })
      }
    }

    if (auth.isAuthenticated && auth.user?.access_token) {
      checkOnboarding()
    }
  }, [auth.isAuthenticated, auth.user?.access_token, navigate, checking])

  if (auth.error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
          <p className="text-slate-600 mb-6">{auth.error.message}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto mb-4"></div>
        <p className="text-slate-600">Completing sign in...</p>
      </div>
    </div>
  )
}
