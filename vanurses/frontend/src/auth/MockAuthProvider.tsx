import { createContext, useContext, ReactNode } from 'react'

// Mock auth context that matches react-oidc-context API
const mockAuthContext = {
  isLoading: false,
  isAuthenticated: false,
  user: null,
  error: null,
  signinRedirect: () => {
    alert('Authentication not configured. Please configure Zitadel.')
    return Promise.resolve()
  },
  signoutRedirect: () => Promise.resolve(),
  removeUser: () => Promise.resolve(),
}

const MockAuthContext = createContext(mockAuthContext)

export function MockAuthProvider({ children }: { children: ReactNode }) {
  return (
    <MockAuthContext.Provider value={mockAuthContext}>
      {children}
    </MockAuthContext.Provider>
  )
}

export function useMockAuth() {
  return useContext(MockAuthContext)
}
