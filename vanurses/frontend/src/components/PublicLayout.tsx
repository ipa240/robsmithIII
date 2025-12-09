import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { Briefcase, Building2, LogIn, Map, Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function PublicLayout() {
  const auth = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navigation = [
    { name: 'Jobs', href: '/jobs', icon: Briefcase },
    { name: 'Facilities', href: '/facilities', icon: Building2 },
    { name: 'Map', href: '/map', icon: Map },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">VA</span>
              </div>
              <span className="text-xl font-bold text-slate-900">VANurses</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Auth buttons */}
            <div className="hidden md:flex items-center gap-3">
              {auth.isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => auth.signinRedirect()}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium"
                  >
                    <LogIn className="w-4 h-4" />
                    Log In
                  </button>
                  <button
                    onClick={() => auth.signinRedirect()}
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600"
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
            {!auth.isAuthenticated && (
              <button
                onClick={() => auth.signinRedirect()}
                className="flex items-center gap-3 px-4 py-3 bg-primary-600 text-white rounded-lg text-sm font-medium w-full"
              >
                <LogIn className="w-5 h-5" />
                Sign In
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Simple Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-slate-500">
          © 2025 VANurses. <Link to="/privacy" className="hover:text-slate-700">Privacy</Link> · <Link to="/terms" className="hover:text-slate-700">Terms</Link>
        </div>
      </footer>
    </div>
  )
}
