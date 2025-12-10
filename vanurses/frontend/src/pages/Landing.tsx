import { Link } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { useQuery } from '@tanstack/react-query'
import { isAdminUnlocked } from '../hooks/useSubscription'
import {
  Briefcase, Building2, Star, ArrowRight, CheckCircle, MessageCircle,
  Sparkles, LogIn, MapPin, Bell, FileText, GitCompare, TrendingUp, Users,
  Newspaper, Heart, Search, Award, Shield, Activity, Clock, DollarSign, Smile,
  ClipboardList, Target
} from 'lucide-react'
import { api } from '../api/client'
import SullyButton from '../components/SullyButton'

export default function Landing() {
  const auth = useAuth()

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/api/stats').then(res => res.data.data)
  })

  const { data: featuredJobs } = useQuery({
    queryKey: ['featured-jobs'],
    queryFn: () => api.get('/api/jobs/recent-diverse?limit=6').then(res => res.data.data)
  })

  const { data: topFacilities } = useQuery({
    queryKey: ['top-facilities'],
    queryFn: () => api.get('/api/facilities?limit=4&min_grade=A').then(res => res.data.data)
  })

  const gradeColors: Record<string, string> = {
    'A': 'bg-emerald-500',
    'B': 'bg-blue-500',
    'C': 'bg-yellow-500',
    'D': 'bg-orange-500',
    'F': 'bg-red-500',
  }

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
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary-500/20 text-primary-300 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-primary-500/30">
            <Award className="w-4 h-4" />
            Virginia's Most Comprehensive Nursing Resource
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Find Your Perfect
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400">
              {' '}Nursing Job{' '}
            </span>
            in Virginia
          </h1>
          <p className="text-xl text-slate-300 mb-4 max-w-2xl mx-auto">
            <span className="text-white font-semibold">{stats?.total_jobs?.toLocaleString() || '2,700+'} jobs</span> across <span className="text-white font-semibold">{stats?.total_facilities || '387'} facilities</span> with <span className="text-white font-semibold">13 quality indices</span>.
            No other platform gives you this level of insight.
          </p>
          <p className="text-slate-400 mb-6 max-w-xl mx-auto">
            Whether you're a new grad, looking for better opportunities, researching facilities for a loved one,
            or exploring a nursing career - we have you covered.
          </p>

          {/* Job Type Badges */}
          {stats?.jobs_by_nursing_type && stats.jobs_by_nursing_type.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {stats.jobs_by_nursing_type.slice(0, 6).map((item: { type: string; count: number }) => (
                <Link
                  key={item.type}
                  to={`/jobs?nursing_type=${encodeURIComponent(item.type)}`}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-primary-400/50 rounded-full text-white text-sm font-medium transition-all"
                >
                  {item.type.toUpperCase()} <span className="text-primary-300">{item.count.toLocaleString()}</span>
                </Link>
              ))}
            </div>
          )}

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
              <div className="text-4xl font-bold text-white mb-2">13</div>
              <div className="text-slate-400">Scoring Indexes</div>
            </div>
          </div>
        </div>
      </section>

      {/* Free Benefits Section */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Free with Your Account</h2>
            <p className="text-xl text-slate-300">Start exploring Virginia's nursing opportunities today</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 backdrop-blur rounded-xl p-6 border border-emerald-500/30 text-center">
              <div className="w-14 h-14 bg-emerald-500/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7 text-emerald-300" />
              </div>
              <h3 className="font-semibold text-white mb-2">Browse All Jobs</h3>
              <p className="text-sm text-slate-400">
                View {stats?.total_jobs?.toLocaleString() || '2,700+'} nursing jobs across Virginia
              </p>
            </div>
            <div className="bg-gradient-to-br from-primary-600/20 to-primary-800/20 backdrop-blur rounded-xl p-6 border border-primary-500/30 text-center">
              <div className="w-14 h-14 bg-primary-500/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-primary-300" />
              </div>
              <h3 className="font-semibold text-white mb-2">Nurse Community</h3>
              <p className="text-sm text-slate-400">
                Connect with Virginia nurses, share experiences
              </p>
            </div>
            <div className="bg-gradient-to-br from-accent-600/20 to-accent-800/20 backdrop-blur rounded-xl p-6 border border-accent-500/30 text-center">
              <div className="w-14 h-14 bg-accent-500/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Newspaper className="w-7 h-7 text-accent-300" />
              </div>
              <h3 className="font-semibold text-white mb-2">Healthcare News</h3>
              <p className="text-sm text-slate-400">
                Stay updated on Virginia healthcare trends
              </p>
            </div>
            <div className="bg-gradient-to-br from-rose-600/20 to-rose-800/20 backdrop-blur rounded-xl p-6 border border-rose-500/30 text-center">
              <div className="w-14 h-14 bg-rose-500/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Heart className="w-7 h-7 text-rose-300" />
              </div>
              <h3 className="font-semibold text-white mb-2">Save 1 Job</h3>
              <p className="text-sm text-slate-400">
                Save your top choice for easy access
              </p>
            </div>
          </div>
          {(!auth.isAuthenticated && !isAdminUnlocked()) && (
            <div className="text-center mt-10">
              <button
                onClick={() => auth.signinRedirect()}
                className="inline-flex items-center gap-2 bg-white/10 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-white/20 transition-colors backdrop-blur border border-white/20"
              >
                Create Free Account
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Family Care Research Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-rose-900/30 via-slate-900 to-rose-900/20">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-rose-500/20 text-rose-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Heart className="w-4 h-4" />
                For Families
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Researching Care for a Loved One?
              </h2>
              <p className="text-lg text-slate-300 mb-8">
                Finding the right nursing home or hospital matters. Our comprehensive facility scores help families make
                <span className="text-rose-300 font-semibold"> informed decisions about care quality</span>.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-white">289 nursing homes</strong> rated with CMS Five-Star data</span>
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-white">98 hospitals</strong> graded by Leapfrog Safety standards</span>
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>Compare facilities <strong className="text-white">side-by-side</strong></span>
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>See what really matters: <strong className="text-white">safety, staffing, patient experience</strong></span>
                </li>
              </ul>
              <Link
                to="/facilities"
                className="inline-flex items-center gap-2 bg-rose-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-rose-700 transition-colors"
              >
                <Heart className="w-5 h-5" />
                Browse Facilities
              </Link>
            </div>
            <div className="hidden md:block">
              <div className="bg-slate-800/60 backdrop-blur border border-rose-500/20 rounded-2xl p-6">
                <div className="mb-6">
                  <p className="text-sm text-slate-400 mb-2">Searching Virginia Facilities</p>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-rose-500/20 text-rose-300 rounded-full text-xs">Nursing Homes</span>
                    <span className="px-3 py-1 bg-sky-500/20 text-sky-300 rounded-full text-xs">Hospitals</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div>
                      <p className="text-sm text-white font-medium">Sunrise Senior Living</p>
                      <p className="text-xs text-slate-400">Norfolk - Nursing Home</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex text-amber-400 text-xs">★★★★★</div>
                      <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded">A</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div>
                      <p className="text-sm text-white font-medium">Sentara Norfolk General</p>
                      <p className="text-xs text-slate-400">Norfolk - Hospital</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">C</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div>
                      <p className="text-sm text-white font-medium">Inova Fairfax Hospital</p>
                      <p className="text-xs text-slate-400">Falls Church - Hospital</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded">A</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-700">
                  <div className="flex items-center justify-center gap-2">
                    <Shield className="w-5 h-5 text-rose-400" />
                    <span className="text-sm text-slate-300">Know before you choose</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Personalized Onboarding Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary-900/40 to-slate-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-accent-500/20 text-accent-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Target className="w-4 h-4" />
                Personalized Results
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Complete Your Profile, Unlock Tailored Matches
              </h2>
              <p className="text-lg text-slate-300 mb-8">
                Our quick onboarding process helps us understand your preferences. Tell us your specialty,
                ideal commute, preferred shifts, and salary expectations — and we'll show you jobs and
                facilities that match <span className="text-accent-300 font-semibold">exactly what you're looking for</span>.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>Get a personalized <strong className="text-white">Match Score</strong> for every job</span>
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>See facilities ranked by <strong className="text-white">what matters to you</strong></span>
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>Get alerts when <strong className="text-white">perfect matches</strong> are posted</span>
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>Takes only <strong className="text-white">2 minutes</strong> to complete</span>
                </li>
              </ul>
              {(!auth.isAuthenticated && !isAdminUnlocked()) && (
                <button
                  onClick={() => auth.signinRedirect()}
                  className="inline-flex items-center gap-2 bg-accent-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-accent-700 transition-colors"
                >
                  <ClipboardList className="w-5 h-5" />
                  Start Your Profile
                </button>
              )}
            </div>
            <div className="hidden md:block">
              <div className="bg-slate-800/60 backdrop-blur border border-white/10 rounded-2xl p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                    <Briefcase className="w-5 h-5 text-primary-400" />
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">What's your specialty?</p>
                      <p className="text-xs text-slate-400">ICU, Med/Surg, ER, L&D, OR...</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                    <MapPin className="w-5 h-5 text-accent-400" />
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">Preferred location?</p>
                      <p className="text-xs text-slate-400">Northern VA, Hampton Roads...</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">Shift preference?</p>
                      <p className="text-xs text-slate-400">Days, Nights, Flexible...</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">Salary expectations?</p>
                      <p className="text-xs text-slate-400">Your minimum requirements</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-700">
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5 text-accent-400" />
                    <span className="text-sm text-slate-300">Get personalized job matches instantly!</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Latest Jobs Preview */}
      {featuredJobs && featuredJobs.length > 0 && (
        <section className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white">Latest Opportunities</h2>
              <Link
                to="/jobs"
                className="text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1"
              >
                View All Jobs <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredJobs.slice(0, 6).map((job: any) => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-5 hover:bg-white/10 hover:border-white/20 transition-all group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate group-hover:text-primary-300 transition-colors">
                        {job.title}
                      </h3>
                      <p className="text-sm text-slate-400 truncate">{job.facility_name}</p>
                    </div>
                    {job.facility_ofs_grade && (
                      <span className={`${gradeColors[job.facility_ofs_grade] || 'bg-slate-500'} text-white text-xs font-bold px-2 py-1 rounded ml-2`}>
                        {job.facility_ofs_grade}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <MapPin className="w-3 h-3" />
                    <span>{job.city ? `${job.city}, VA` : 'Virginia'}</span>
                    {job.specialty && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="bg-slate-700/50 px-2 py-0.5 rounded">{job.specialty}</span>
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

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
              {(!auth.isAuthenticated && !isAdminUnlocked()) && (
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

      {/* Top-Rated Facilities */}
      {topFacilities && topFacilities.length > 0 && (
        <section className="py-16 px-4 bg-white/5 backdrop-blur">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Top-Rated Facilities</h2>
                <p className="text-slate-400">Highest Facility Scores across Virginia</p>
              </div>
              <Link
                to="/facilities"
                className="text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {topFacilities.slice(0, 4).map((facility: any) => (
                <Link
                  key={facility.id}
                  to={`/facilities/${facility.id}`}
                  className="bg-slate-800/50 border border-white/10 rounded-xl p-5 hover:bg-slate-800/70 hover:border-emerald-500/30 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-sm leading-tight group-hover:text-emerald-300 transition-colors">
                        {facility.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {facility.city}
                      </p>
                    </div>
                    <div className="flex flex-col items-center ml-3">
                      <span className="bg-emerald-500 text-white text-lg font-bold w-10 h-10 rounded-lg flex items-center justify-center">
                        {facility.score?.ofs_grade || 'A'}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1">Score</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{facility.region}</span>
                    {facility.job_count > 0 && (
                      <span className="text-primary-400">{facility.job_count} jobs</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      <section className="py-16 px-4 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">What Nurses Are Saying</h2>
          <div className="relative">
            <div className="flex animate-scroll gap-6">
              {[
                { text: "I sure wish I had this when I started my nursing career, how the times have changed!", author: "Brandy A.", role: "RN, 15 years" },
                { text: "Finally, a site that actually shows you what you're getting into before you apply. The facility scores are a game-changer.", author: "Marcus T.", role: "ICU Nurse, Richmond" },
                { text: "Used VANurses to find my current job. The salary transparency saved me from lowball offers.", author: "Jennifer L.", role: "ER Nurse, Norfolk" },
                { text: "As a new grad, comparing facilities was overwhelming. The scoring system made it so much easier.", author: "David K.", role: "New Grad RN" },
                { text: "Sully helped me prep for my interview and I got the job! Love the AI assistant.", author: "Tamika R.", role: "L&D Nurse" },
                { text: "I recommend VANurses to every nurse I precept. Such a valuable resource.", author: "Patricia M.", role: "Charge Nurse, NOVA" },
                { text: "I sure wish I had this when I started my nursing career, how the times have changed!", author: "Brandy A.", role: "RN, 15 years" },
                { text: "Finally, a site that actually shows you what you're getting into before you apply. The facility scores are a game-changer.", author: "Marcus T.", role: "ICU Nurse, Richmond" },
              ].map((testimonial, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-80 bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6"
                >
                  <p className="text-slate-300 text-sm mb-4 italic">"{testimonial.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {testimonial.author.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{testimonial.author}</p>
                      <p className="text-slate-500 text-xs">{testimonial.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <style>{`
          @keyframes scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-scroll {
            animation: scroll 30s linear infinite;
          }
          .animate-scroll:hover {
            animation-play-state: paused;
          }
        `}</style>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Why Nurses Choose VANurses
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Link to="/scoring" className="bg-white/5 backdrop-blur rounded-2xl p-8 border border-white/10 hover:border-primary-500/50 hover:bg-white/10 transition-all block group">
              <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center mb-6">
                <Star className="w-6 h-6 text-primary-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3 group-hover:text-primary-300 transition-colors">Facility Ratings</h3>
              <p className="text-slate-400 mb-4">
                Our 13-index Facility Score system rates facilities on employee satisfaction,
                patient care, resources, and more.
              </p>
              <span className="text-primary-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                Learn how we score facilities
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
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
                Jobs gathered directly from hospital career portals. Salary data,
                benefits, and requirements verified.
              </p>
              <p className="text-xs text-slate-500 mt-3 italic">
                Built by a nurse, for nurses like you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Facility Scoring System */}
      <section className="py-20 px-4 bg-gradient-to-br from-emerald-900/30 via-slate-900 to-primary-900/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Award className="w-4 h-4" />
              Exclusive Feature
            </div>
            <h2 className="text-4xl font-bold text-white mb-4">
              Our 13-Index Facility Scoring System
            </h2>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              Know exactly what you're getting into before you apply. Our comprehensive scoring system
              analyzes real data to give you the full picture of every Virginia healthcare facility.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 text-center hover:border-emerald-500/30 transition-colors">
              <Shield className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <h4 className="font-semibold text-white text-sm mb-1">PCI</h4>
              <p className="text-xs text-slate-400">Patient Care Index</p>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 text-center hover:border-emerald-500/30 transition-colors">
              <Smile className="w-8 h-8 text-primary-400 mx-auto mb-2" />
              <h4 className="font-semibold text-white text-sm mb-1">ALI</h4>
              <p className="text-xs text-slate-400">Administrative Leadership</p>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 text-center hover:border-emerald-500/30 transition-colors">
              <Star className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <h4 className="font-semibold text-white text-sm mb-1">CSI</h4>
              <p className="text-xs text-slate-400">Clinical Standards</p>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 text-center hover:border-emerald-500/30 transition-colors">
              <DollarSign className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <h4 className="font-semibold text-white text-sm mb-1">CCI</h4>
              <p className="text-xs text-slate-400">Compensation & Benefits</p>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 text-center hover:border-emerald-500/30 transition-colors">
              <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <h4 className="font-semibold text-white text-sm mb-1">LSSI</h4>
              <p className="text-xs text-slate-400">Life-Shift Scheduling</p>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 text-center hover:border-emerald-500/30 transition-colors">
              <Activity className="w-8 h-8 text-rose-400 mx-auto mb-2" />
              <h4 className="font-semibold text-white text-sm mb-1">QLI</h4>
              <p className="text-xs text-slate-400">Quality of Life</p>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 text-center hover:border-emerald-500/30 transition-colors">
              <TrendingUp className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <h4 className="font-semibold text-white text-sm mb-1">PEI</h4>
              <p className="text-xs text-slate-400">Professional Education</p>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 text-center hover:border-emerald-500/30 transition-colors">
              <Building2 className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <h4 className="font-semibold text-white text-sm mb-1">FSI</h4>
              <p className="text-xs text-slate-400">Facility & Safety</p>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 text-center hover:border-emerald-500/30 transition-colors">
              <Heart className="w-8 h-8 text-pink-400 mx-auto mb-2" />
              <h4 className="font-semibold text-white text-sm mb-1">ERI</h4>
              <p className="text-xs text-slate-400">Employee Retention</p>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 text-center hover:border-emerald-500/30 transition-colors">
              <CheckCircle className="w-8 h-8 text-teal-400 mx-auto mb-2" />
              <h4 className="font-semibold text-white text-sm mb-1">JTI</h4>
              <p className="text-xs text-slate-400">Job Transparency</p>
            </div>
            <div className="bg-gradient-to-br from-sky-600/30 to-primary-600/30 backdrop-blur border border-sky-500/50 rounded-xl p-4 text-center hover:border-sky-400 transition-colors relative">
              <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-sky-500 text-white text-[10px] font-bold rounded-full">NEW</span>
              <TrendingUp className="w-8 h-8 text-sky-400 mx-auto mb-2" />
              <h4 className="font-semibold text-white text-sm mb-1">OII</h4>
              <p className="text-xs text-slate-400">Opportunity Insights</p>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur border border-emerald-500/30 rounded-2xl p-8 text-center">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex -space-x-2">
                <span className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-white text-lg font-bold border-2 border-slate-900">A</span>
                <span className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-lg font-bold border-2 border-slate-900">B</span>
                <span className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center text-white text-lg font-bold border-2 border-slate-900">C</span>
              </div>
              <ArrowRight className="w-6 h-6 text-slate-400" />
              <span className="text-3xl font-bold text-white">Overall Facility Score</span>
            </div>
            <p className="text-slate-300 max-w-2xl mx-auto mb-8">
              All 13 indexes combine into a single A-F grade so you can quickly compare facilities.
              Create an account to unlock full breakdowns of all indexes for any facility.
            </p>
            <Link
              to="/scoring"
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              <Award className="w-5 h-5" />
              Learn How We Score Facilities
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Three-Sided Marketplace */}
      <section className="py-20 px-4 bg-white/5 backdrop-blur">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              One Platform, Three Perspectives
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              VANurses connects the entire Virginia healthcare ecosystem
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {/* For Nurses */}
            <div className="bg-gradient-to-br from-primary-600/20 to-primary-800/20 backdrop-blur rounded-2xl p-8 border border-primary-500/30 hover:border-primary-400/50 transition-colors">
              <div className="w-14 h-14 bg-primary-500/30 rounded-xl flex items-center justify-center mb-6">
                <Briefcase className="w-7 h-7 text-primary-300" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">For Nurses</h3>
              <p className="text-slate-300 mb-6">
                Find your perfect job with facility ratings, salary data, and personalized AI recommendations.
              </p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary-400" />
                  Browse {stats?.total_jobs?.toLocaleString() || '2,700+'} jobs
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary-400" />
                  Compare facility ratings
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary-400" />
                  Get AI career guidance
                </li>
              </ul>
            </div>

            {/* For HR */}
            <div className="bg-gradient-to-br from-accent-600/20 to-accent-800/20 backdrop-blur rounded-2xl p-8 border border-accent-500/30 hover:border-accent-400/50 transition-colors">
              <div className="w-14 h-14 bg-accent-500/30 rounded-xl flex items-center justify-center mb-6">
                <Building2 className="w-7 h-7 text-accent-300" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">For HR Teams</h3>
              <p className="text-slate-300 mb-6">
                Connect with qualified nurses actively seeking opportunities in Virginia.
              </p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent-400" />
                  Post jobs for free
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent-400" />
                  Access talent pipeline
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent-400" />
                  Analytics dashboard
                </li>
              </ul>
            </div>

            {/* For Hospitals */}
            <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 backdrop-blur rounded-2xl p-8 border border-emerald-500/30 hover:border-emerald-400/50 transition-colors">
              <div className="w-14 h-14 bg-emerald-500/30 rounded-xl flex items-center justify-center mb-6">
                <Star className="w-7 h-7 text-emerald-300" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">For Hospitals</h3>
              <p className="text-slate-300 mb-6">
                Understand and improve your reputation with data-driven insights.
              </p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  View your Facility Scores
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Benchmark vs competitors
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Actionable improvement tips
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pro Features Teaser */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Unlock Pro Features</h2>
            <p className="text-xl text-slate-300">Get more from your job search with premium tools</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 hover:border-primary-500/30 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-primary-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Personalized Job Scoring</h3>
                  <p className="text-sm text-slate-400">Jobs ranked based on YOUR preferences - specialty, commute, pay, and more.</p>
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 hover:border-primary-500/30 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-accent-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bell className="w-6 h-6 text-accent-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Trend Alerts</h3>
                  <p className="text-sm text-slate-400">Get notified instantly when new jobs match your criteria.</p>
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 hover:border-primary-500/30 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <GitCompare className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Compare Up to 5 Facilities</h3>
                  <p className="text-sm text-slate-400">Side-by-side comparison of all 10 scoring indexes.</p>
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 hover:border-primary-500/30 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Resume Builder</h3>
                  <p className="text-sm text-slate-400">Generate tailored nursing resumes optimized for ATS systems.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center mt-10">
            <Link
              to="/jobs"
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              Start Exploring
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* HR Portal Benefits */}
      <section className="py-16 px-4 bg-gradient-to-r from-accent-900/30 to-primary-900/30 backdrop-blur">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-accent-500/20 text-accent-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Users className="w-4 h-4" />
                For Healthcare Recruiters
              </div>
              <h2 className="text-3xl font-bold text-white mb-6">
                Find Qualified Nursing Talent
              </h2>
              <p className="text-lg text-slate-300 mb-8">
                Connect with nurses actively seeking opportunities in Virginia.
                Post jobs, track applications, and improve your facility's reputation.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-accent-400 flex-shrink-0" />
                  <span>Post unlimited job listings</span>
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-accent-400 flex-shrink-0" />
                  <span>Access qualified nurse talent pool</span>
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-accent-400 flex-shrink-0" />
                  <span>Analytics dashboard with applicant tracking</span>
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-accent-400 flex-shrink-0" />
                  <span>Facility reputation management tools</span>
                </li>
              </ul>
              <Link
                to="/support"
                className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
              >
                Contact Us for HR Access
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="hidden md:block">
              <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
                <div className="text-center mb-6">
                  <div className="text-4xl font-bold text-white mb-2">{stats?.total_jobs?.toLocaleString() || '2,700+'}</div>
                  <div className="text-slate-400">Active Job Listings</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-accent-400">150+</div>
                    <div className="text-xs text-slate-400">Facilities</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-primary-400">7</div>
                    <div className="text-xs text-slate-400">VA Regions</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-400">1,000+</div>
                    <div className="text-xs text-slate-400">Nurses Monthly</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">24/7</div>
                    <div className="text-xs text-slate-400">AI Support</div>
                  </div>
                </div>
              </div>
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
          {(!auth.isAuthenticated && !isAdminUnlocked()) && (
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

      {/* Sully Chat Button */}
      <SullyButton />
    </div>
  )
}
