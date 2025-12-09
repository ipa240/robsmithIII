import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from 'react-oidc-context'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
})

// Zitadel OIDC Configuration
// Use a placeholder client_id if not configured - auth won't work but app will load
const clientId = import.meta.env.VITE_ZITADEL_CLIENT_ID || 'not-configured'
const zitadelUrl = import.meta.env.VITE_ZITADEL_ISSUER || 'http://localhost:8088'

// Note: Zitadel returns http:// in the issuer even when accessed via HTTPS (nginx terminates SSL)
// We provide explicit metadata to work around this issuer mismatch
const oidcConfig = {
  authority: zitadelUrl,
  client_id: clientId,
  redirect_uri: window.location.origin + '/callback',
  post_logout_redirect_uri: window.location.origin,
  scope: 'openid profile email',
  response_type: 'code',
  // Don't auto-renew if not configured
  automaticSilentRenew: clientId !== 'not-configured',
  // Provide explicit metadata to handle http/https issuer mismatch
  // Zitadel behind nginx reverse proxy reports http:// issuer but we access via https://
  metadata: {
    issuer: zitadelUrl.replace('https://', 'http://'),
    authorization_endpoint: `${zitadelUrl}/oauth/v2/authorize`,
    token_endpoint: `${zitadelUrl}/oauth/v2/token`,
    userinfo_endpoint: `${zitadelUrl}/oidc/v1/userinfo`,
    end_session_endpoint: `${zitadelUrl}/oidc/v1/end_session`,
    jwks_uri: `${zitadelUrl}/oauth/v2/keys`,
  },
  onSigninCallback: () => {
    // Remove OIDC params from URL after successful login
    window.history.replaceState({}, document.title, window.location.pathname)
  },
}

console.log('OIDC Config:', {
  authority: oidcConfig.authority,
  client_id: oidcConfig.client_id,
  redirect_uri: oidcConfig.redirect_uri,
})

if (clientId === 'not-configured') {
  console.warn('VITE_ZITADEL_CLIENT_ID not set - authentication will not work')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider {...oidcConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </AuthProvider>
  </React.StrictMode>,
)
