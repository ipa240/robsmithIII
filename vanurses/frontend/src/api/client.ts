import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || ''

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Current auth token (set by AuthProvider)
let currentToken: string | null = null

// Add auth token to requests
export function setAuthToken(token: string | null) {
  currentToken = token
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common['Authorization']
  }
}

// Get current token (for debugging)
export function getAuthToken(): string | null {
  return currentToken
}

// Admin unlock storage key (matches useSubscription.ts)
const ADMIN_UNLOCK_STORAGE_KEY = 'vanurses_admin_unlock'

// Request interceptor to ensure token is always current
api.interceptors.request.use(
  (config) => {
    if (currentToken && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${currentToken}`
    }
    // Add admin unlock header if unlocked
    if (typeof window !== 'undefined' && localStorage.getItem(ADMIN_UNLOCK_STORAGE_KEY) === 'true') {
      config.headers['X-Admin-Unlock'] = 'true'
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - could trigger re-auth here
      console.warn('API returned 401 - authentication may be required')
    }
    return Promise.reject(error)
  }
)
