import { useAuth as useOidcAuth } from 'react-oidc-context'

const isAuthConfigured = !!import.meta.env.VITE_ZITADEL_CLIENT_ID

// Mock auth object for when auth is not configured
const mockAuth = {
  isLoading: false,
  isAuthenticated: false,
  user: null,
  signinRedirect: () => {
    console.warn('Auth not configured - cannot sign in')
    return Promise.resolve()
  },
  signoutRedirect: () => {
    console.warn('Auth not configured - cannot sign out')
    return Promise.resolve()
  },
}

export function useOptionalAuth() {
  // If auth is not configured, return mock
  if (!isAuthConfigured) {
    return mockAuth
  }

  // Otherwise use the real auth hook
  try {
    return useOidcAuth()
  } catch {
    return mockAuth
  }
}
