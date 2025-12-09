import { Link } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, Building2, Star, ArrowRight, CheckCircle, MessageCircle, Sparkles, LogIn } from 'lucide-react'
import { api } from '../api/client'

export default function Landing() {
  const auth = useAuth()

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/api/stats').then(res => res.data.data)
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold">VA</span>
              </div>
              <span className="text-2xl font-bold text-white">VANurses</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/jobs" className="text-white/80 hover:text-white font-medium">
                Jobs
              </Link>
              <Link to="/facilities" className="text-white/80 hover:text-white font-medium">
                Facilities
              </Link>
              {auth.isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="bg-white text-slate-900 px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-100 transition-colors"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => auth.signinRedirect()}
                    className="flex items-center gap-2 text-white/80 hover:text-white font-medium"
                  >
                    <LogIn className="w-4 h-4" />
                    Log In
                  </button>
                  <button
                    onClick={() => {
                      console.log('Get Started clicked, auth:', { isLoading: auth.isLoading, error: auth.error })
                      auth.signinRedirect().catch(err => {
                        console.error('Sign in error:', err)
                        alert('Sign in error: ' + err.message)
                      })
                    }}
                    className="bg-white text-slate-900 px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-100 transition-colors"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Find Your Perfect
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400">
              {' '}Nursing Job{' '}
            </span>
            in Virginia
          </h1>
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            Browse {stats?.total_jobs?.toLocaleString() || '2,700+'} nursing positions across Virginia.
            Get facility ratings, salary data, and personalized recommendations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/jobs"
              className="inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              <Briefcase className="w-5 h-5" />
              Browse Jobs
            </Link>
            <Link
              to="/facilities"
              className="inline-flex items-center justify-center gap-2 bg-white/10 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-white/20 transition-colors backdrop-blur"
            >
              <Building2 className="w-5 h-5" />
              View Facilities
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4 bg-white/5 backdrop-blur">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">
                {stats?.total_jobs?.toLocaleString() || '2,700+'}
              </div>
              <div className="text-slate-400">Active Jobs</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">
                {stats?.total_facilities?.toLocaleString() || '150+'}
              </div>
              <div className="text-slate-400">Facilities Ranked</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">7</div>
              <div className="text-slate-400">Virginia Regions</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">9</div>
              <div className="text-slate-400">Scoring Indexes</div>
            </div>
          </div>
        </div>
      </section>

      {/* Sully AI Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary-900/50 to-accent-900/50 backdrop-blur">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-primary-500/20 text-primary-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                AI-Powered
              </div>
              <h2 className="text-4xl font-bold text-white mb-6">
                Meet Sully, Your Personal Nursing Career Advisor
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Get instant answers about facilities, salary expectations, interview tips,
                and personalized career guidance. Sully knows Virginia's healthcare landscape
                inside and out.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>Ask about any Virginia hospital or healthcare facility</span>
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>Get salary comparisons and negotiation tips</span>
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>Personalized job recommendations based on your preferences</span>
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>Available 24/7, in multiple conversational styles</span>
                </li>
              </ul>
              {!auth.isAuthenticated && (
                <button
                  onClick={() => auth.signinRedirect()}
                  className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  Try Sully Free
                </button>
              )}
            </div>
            <div className="relative">
              {/* Mock Chat Preview */}
              <div className="bg-slate-800/80 backdrop-blur border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">Sully</div>
                    <div className="text-xs text-emerald-400">Online</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-slate-700/50 rounded-2xl rounded-tl-none p-4 max-w-[85%]">
                    <p className="text-slate-200 text-sm">
                      Hey! I'm Sully, your nursing career assistant. I can help you find the perfect job,
                      compare facilities, or answer any questions about Virginia's healthcare landscape.
                      What would you like to know?
                    </p>
                  </div>
                  <div className="bg-primary-600 rounded-2xl rounded-tr-none p-4 max-w-[85%] ml-auto">
                    <p className="text-white text-sm">
                      What are the best hospitals in Northern Virginia for ICU nurses?
                    </p>
                  </div>
                  <div className="bg-slate-700/50 rounded-2xl rounded-tl-none p-4 max-w-[85%]">
                    <p className="text-slate-200 text-sm">
                      Great question! Based on our OFS scores, Inova Fairfax ranks highest for ICU with an A rating.
                      They have great nurse-to-patient ratios and strong Magnet status...
                    </p>
                  </div>
                </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-primary-500/20 rounded-full blur-xl" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-accent-500/20 rounded-full blur-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Why Nurses Choose VANurses
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/5 backdrop-blur rounded-2xl p-8 border border-white/10">
              <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center mb-6">
                <Star className="w-6 h-6 text-primary-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Facility Ratings</h3>
              <p className="text-slate-400">
                Our 9-index OFS scoring system rates facilities on employee satisfaction,
                patient care, resources, and more.
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-2xl p-8 border border-white/10">
              <div className="w-12 h-12 bg-accent-500/20 rounded-xl flex items-center justify-center mb-6">
                <Briefcase className="w-6 h-6 text-accent-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Job Matching</h3>
              <p className="text-slate-400">
                Tell us your preferences and we'll recommend jobs that match your
                specialty, shift preferences, and location.
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-2xl p-8 border border-white/10">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-6">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Verified Data</h3>
              <p className="text-slate-400">
                Jobs scraped directly from hospital career portals. Salary data,
                benefits, and requirements verified.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            Ready to Find Your Next Role?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Create a free account to save jobs, set up alerts, and get personalized recommendations.
          </p>
          {!auth.isAuthenticated && (
            <button
              onClick={() => auth.signinRedirect()}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-600 to-accent-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Create Free Account
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-400 text-sm">
            © 2025 VANurses. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-slate-400">
            <a href="#" className="hover:text-white">Privacy</a>
            <a href="#" className="hover:text-white">Terms</a>
            <a href="#" className="hover:text-white">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
