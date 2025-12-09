import { ReactNode, useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import { useLocation } from 'react-router-dom'
import { setAuthToken } from '../api/client'

interface ProtectedRouteProps {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const auth = useAuth()
  const location = useLocation()

  // Set auth token whenever user changes
  useEffect(() => {
    if (auth.user?.access_token) {
      setAuthToken(auth.user.access_token)
    } else {
      setAuthToken(null)
    }
  }, [auth.user?.access_token])

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      // Redirect to Zitadel login
      auth.signinRedirect({ state: { returnTo: location.pathname } })
    }
  }, [auth.isLoading, auth.isAuthenticated, auth, location.pathname])

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    // Show loading while redirect happens
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    )
  }

  return <>{children}</>
}
