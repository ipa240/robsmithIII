import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { Briefcase, Building2, LogIn, Map, Menu, X, LayoutDashboard, TrendingUp, GitCompare, Bot, FileCheck, GraduationCap, FileText, Newspaper, ChevronDown, Users, Award, Bookmark, User, CreditCard, HelpCircle } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import SullyButton from './SullyButton'

export default function PublicLayout() {
  const auth = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false)
  const moreDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
        setMoreDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const navigation = [
    { name: 'Jobs', href: '/jobs', icon: Briefcase },
    { name: 'Facilities', href: '/facilities', icon: Building2 },
    { name: 'Map', href: '/map', icon: Map },
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Trends', href: '/trends', icon: TrendingUp },
    { name: 'Compare', href: '/compare', icon: GitCompare },
    { name: 'Sully AI', href: '/sully', icon: Bot },
  ]

  const moreNavigation = [
    { name: 'Community', href: '/community', icon: Users },
    { name: 'Applications', href: '/applications', icon: FileCheck },
    { name: 'Learning', href: '/learn', icon: GraduationCap },
    { name: 'Resume', href: '/resume', icon: FileText },
    { name: 'News', href: '/news', icon: Newspaper },
    { name: 'Scoring Info', href: '/scoring', icon: Award },
    { name: 'Saved Jobs', href: '/saved', icon: Bookmark },
  ]

  const accountNavigation = [
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Billing', href: '/billing', icon: CreditCard },
    { name: 'Support', href: '/support', icon: HelpCircle },
  ]

  const isActive = (path: string) => location.pathname === path
  const isMoreActive = moreNavigation.some(item => isActive(item.href))

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/media/vanurses-logo.png"
                alt="VANurses"
                className="h-20 w-auto object-contain"
              />
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
              {/* More dropdown */}
              <div className="relative" ref={moreDropdownRef}>
                <button
                  onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isMoreActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  More
                  <ChevronDown className={`w-4 h-4 transition-transform ${moreDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {moreDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-50">
                    <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase">Features</div>
                    {moreNavigation.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setMoreDropdownOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 text-sm ${
                          isActive(item.href)
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.name}
                      </Link>
                    ))}
                    <div className="border-t border-slate-100 my-2" />
                    <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase">Account</div>
                    {accountNavigation.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setMoreDropdownOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 text-sm ${
                          isActive(item.href)
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
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
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                  isActive(item.href) ? 'bg-primary-50 text-primary-700' : 'text-slate-600'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
            <div className="border-t border-slate-100 my-2 pt-2">
              <p className="px-4 text-xs text-slate-400 uppercase tracking-wider mb-2">Features</p>
              {moreNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                    isActive(item.href) ? 'bg-primary-50 text-primary-700' : 'text-slate-600'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="border-t border-slate-100 my-2 pt-2">
              <p className="px-4 text-xs text-slate-400 uppercase tracking-wider mb-2">Account</p>
              {accountNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                    isActive(item.href) ? 'bg-primary-50 text-primary-700' : 'text-slate-600'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              ))}
            </div>
            {!auth.isAuthenticated && (
              <button
                onClick={() => auth.signinRedirect()}
                className="flex items-center gap-3 px-4 py-3 bg-primary-600 text-white rounded-lg text-sm font-medium w-full mt-2"
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

      {/* Sully Chat Button */}
      <SullyButton />
    </div>
  )
}
