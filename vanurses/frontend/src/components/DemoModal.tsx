import { X, Play, BarChart3, GitCompare, BookOpen, Briefcase, User, LayoutDashboard, FileText } from 'lucide-react'

interface DemoModalProps {
  /** Key to select which demo content to show */
  demoKey: 'compare' | 'dashboard' | 'trends' | 'learning' | 'applications' | 'profile' | 'resume'
  /** Close handler */
  onClose: () => void
}

const DEMO_CONTENT: Record<
  string,
  {
    title: string
    icon: typeof BarChart3
    description: string
    features: string[]
    videoUrl?: string
    gifPath?: string
  }
> = {
  compare: {
    title: 'Facility Comparison',
    icon: GitCompare,
    description:
      'Compare multiple healthcare facilities side-by-side to find your perfect workplace.',
    features: [
      'Compare up to 5 facilities at once',
      'See detailed OFS scores for all 10 indices',
      'View salary ranges, benefits, and culture ratings',
      'Export comparison reports as PDF',
      'Save comparisons for later reference',
    ],
    videoUrl: '/media/demos/compare.webm',
  },
  dashboard: {
    title: 'Your Personal Dashboard',
    icon: LayoutDashboard,
    description:
      'Get a personalized overview of top facilities, your applications, and recent opportunities.',
    features: [
      'Top-rated facilities in your area',
      'Track all your job applications',
      'See recent jobs matching your preferences',
      'Quick access to Sully AI assistant',
      'Personalized recommendations',
    ],
    gifPath: '/media/demos/dashboard-demo.gif',
  },
  trends: {
    title: 'Market Trends & Analytics',
    icon: BarChart3,
    description:
      'Stay ahead with real-time insights into the Virginia nursing job market.',
    features: [
      'Salary trends by specialty and region',
      'Job posting volume over time',
      'Facility rating distributions',
      'Hiring hotspots and growth areas',
      'Custom date range analysis',
    ],
    gifPath: '/media/demos/trends-demo.gif',
  },
  learning: {
    title: 'CEU Learning Center',
    icon: BookOpen,
    description:
      'Access curated continuing education resources and track your professional development.',
    features: [
      'Free and paid CEU courses',
      'Track completion and certifications',
      'Resources by specialty',
      'Virginia Board of Nursing approved',
      'Integration with your profile',
    ],
    gifPath: '/media/demos/learning-demo.gif',
  },
  applications: {
    title: 'Application Tracker',
    icon: Briefcase,
    description:
      'Keep all your job applications organized in one place with status tracking.',
    features: [
      'Track application status',
      'Set follow-up reminders',
      'Store notes and documents',
      'View application history',
      'Get interview prep tips',
    ],
    videoUrl: '/media/demos/apps.webm',
  },
  profile: {
    title: 'Personalized Preferences',
    icon: User,
    description:
      'Customize your experience with preference settings that match you with the best opportunities.',
    features: [
      'Set preferred locations and commute',
      'Specify specialty and experience level',
      'Define salary expectations',
      'Choose work schedule preferences',
      'Enable job alerts and notifications',
    ],
    gifPath: '/media/demos/profile-demo.gif',
  },
  resume: {
    title: 'AI Resume Builder',
    icon: FileText,
    description:
      'Create professional nursing resumes tailored to specific job postings with AI assistance.',
    features: [
      'Pre-built templates for healthcare professionals',
      'AI-powered summary and bullet point suggestions',
      'Automatic skills extraction from your profile',
      'Export to PDF with professional formatting',
      'Tailored versions for specific job postings',
    ],
    gifPath: '/media/demos/resume-demo.gif',
  },
}

export default function DemoModal({ demoKey, onClose }: DemoModalProps) {
  const content = DEMO_CONTENT[demoKey]
  const Icon = content.icon

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center">
              <Icon className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">
              {content.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-slate-600 mb-6">{content.description}</p>

          {/* Video/GIF Preview */}
          <div className="bg-slate-100 rounded-xl aspect-video flex items-center justify-center mb-6 overflow-hidden">
            {content.videoUrl ? (
              <video
                src={content.videoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to placeholder if video not found
                  const target = e.target as HTMLVideoElement
                  target.style.display = 'none'
                  target.parentElement!.innerHTML = `
                    <div class="flex flex-col items-center gap-3 text-slate-400">
                      <div class="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span class="text-sm font-medium">Demo coming soon</span>
                    </div>
                  `
                }}
              />
            ) : content.gifPath ? (
              <img
                src={content.gifPath}
                alt={`${content.title} demo`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to placeholder if image not found
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  target.parentElement!.innerHTML = `
                    <div class="flex flex-col items-center gap-3 text-slate-400">
                      <div class="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span class="text-sm font-medium">Demo coming soon</span>
                    </div>
                  `
                }}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center">
                  <Play className="w-8 h-8" />
                </div>
                <span className="text-sm font-medium">Demo coming soon</span>
              </div>
            )}
          </div>

          {/* Features List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
              What you get:
            </h3>
            <ul className="space-y-2">
              {content.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3 text-slate-600">
                  <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors font-medium"
          >
            Maybe Later
          </button>
          <a
            href="/billing"
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-center"
          >
            Upgrade to Access
          </a>
        </div>
      </div>
    </div>
  )
}
