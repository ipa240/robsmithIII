import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import {
  Home, Briefcase, Building2, User, Bookmark,
  LogIn, LogOut, Menu, X, MessageCircle, Bell,
  Newspaper, BookOpen, Users, FileText, Map, TrendingUp,
  CreditCard, HelpCircle, Shield, ChevronDown, Award,
  ClipboardList, GraduationCap, BarChart3, GitCompare
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useState, useRef, useEffect } from 'react'
import SullyButton from './SullyButton'
import TrialBanner from './TrialBanner'

export default function Layout() {
  const auth = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data: notifCount } = useQuery({
    queryKey: ['notification-count'],
    queryFn: () => api.get('/api/notifications/unread-count').then(res => res.data),
    refetchInterval: 30000,
    enabled: auth.isAuthenticated
  })

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Jobs', href: '/jobs', icon: Briefcase },
    { name: 'Facilities', href: '/facilities', icon: Building2 },
    { name: 'Map', href: '/map', icon: Map },
    { name: 'Trends', href: '/trends', icon: TrendingUp },
    { name: 'Sully', href: '/sully', icon: MessageCircle },
  ]

  const moreNavigation = [
    { name: 'Compare', href: '/compare', icon: GitCompare },
    { name: 'Community', href: '/community', icon: Users },
    { name: 'Learning', href: '/learn', icon: GraduationCap },
    { name: 'News', href: '/news', icon: Newspaper },
    { name: 'Applications', href: '/applications', icon: ClipboardList },
    { name: 'Resume Builder', href: '/resume', icon: FileText },
    { name: 'Scoring Info', href: '/scoring', icon: Award },
    { name: 'Saved Jobs', href: '/saved', icon: Bookmark },
  ]

  const accountNavigation = [
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Billing', href: '/billing', icon: CreditCard },
    { name: 'Support', href: '/support', icon: HelpCircle },
    { name: 'Admin', href: '/admin', icon: Shield },
    { name: 'HR Portal', href: '/hr', icon: Building2 },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Trial Banner */}
      <TrialBanner />

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

              {/* More Dropdown */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    moreMenuOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  More
                  <ChevronDown className={`w-4 h-4 transition-transform ${moreMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {moreMenuOpen && (
                  <div className="absolute top-full right-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                    <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase">Features</div>
                    {moreNavigation.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setMoreMenuOpen(false)}
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
                        onClick={() => setMoreMenuOpen(false)}
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
                <>
                  <Link
                    to="/notifications"
                    className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    <Bell className="w-5 h-5" />
                    {notifCount?.count > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {notifCount.count}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    <User className="w-4 h-4" />
                    Profile
                  </Link>
                  <button
                    onClick={() => auth.signoutRedirect()}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    console.log('Sign In clicked, full auth:', auth)
                    console.log('Auth activeNavigator:', auth.activeNavigator)
                    console.log('Auth isLoading:', auth.isLoading)
                    console.log('Auth error:', auth.error)
                    if (auth.isLoading) {
                      alert('Auth is still loading, please wait...')
                      return
                    }
                    if (auth.error) {
                      alert('Auth error: ' + auth.error.message)
                      return
                    }
                    auth.signinRedirect().catch(err => {
                      console.error('Sign in error:', err)
                      alert('Sign in error: ' + err.message)
                    })
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  {auth.isLoading ? 'Loading...' : 'Sign In'}
                </button>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white max-h-[80vh] overflow-y-auto">
            <div className="px-4 py-3 space-y-1">
              {/* Main Navigation */}
              <div className="text-xs font-semibold text-slate-400 uppercase px-4 pt-2">Main</div>
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                    isActive(item.href)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              ))}

              {/* More Features */}
              <hr className="my-2" />
              <div className="text-xs font-semibold text-slate-400 uppercase px-4 pt-2">Features</div>
              {moreNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                    isActive(item.href)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              ))}

              {/* Account */}
              <hr className="my-2" />
              <div className="text-xs font-semibold text-slate-400 uppercase px-4 pt-2">Account</div>
              {accountNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                    isActive(item.href)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              ))}

              <hr className="my-2" />
              {auth.isAuthenticated ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    auth.signoutRedirect()
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 w-full"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    auth.signinRedirect()
                  }}
                  className="flex items-center gap-3 px-4 py-3 bg-primary-600 text-white rounded-lg text-sm font-medium w-full"
                >
                  <LogIn className="w-5 h-5" />
                  Sign In
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500">
              © 2025 VANurses. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-slate-500">
              <Link to="/privacy" className="hover:text-slate-700">Privacy</Link>
              <Link to="/terms" className="hover:text-slate-700">Terms</Link>
              <Link to="/support" className="hover:text-slate-700">Contact</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Sully AI Floating Chat Button */}
      <SullyButton />
    </div>
  )
}
