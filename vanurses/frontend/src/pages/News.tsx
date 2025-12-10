import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useSubscription, isAdminUnlocked } from '../hooks/useSubscription'
import {
  Newspaper, TrendingUp, Clock, ExternalLink, Bookmark, Share2,
  Filter, ChevronRight, Star, MapPin, Crown, Lock
} from 'lucide-react'

interface Article {
  id: string
  title: string
  summary: string
  source: string
  source_url: string
  image_url: string | null
  category: string
  tags: string[]
  published_at: string
}

const SAMPLE_ARTICLES: Article[] = [
  {
    id: '1',
    title: "Virginia Hospitals See 15% Increase in Nursing Staff",
    summary: "Following aggressive recruitment efforts and improved compensation packages, Virginia healthcare facilities report significant gains in nursing staff levels across the state.",
    source: "Healthcare Dive",
    source_url: "https://www.healthcaredive.com/news/nursing-staffing-shortage/",
    image_url: null,
    category: "virginia",
    tags: ["staffing", "virginia", "recruitment"],
    published_at: "2025-12-07T10:00:00Z"
  },
  {
    id: '2',
    title: "New NCLEX Pass Rates Show Promising Trends for 2025",
    summary: "The latest NCLEX pass rate data indicates a 3% improvement nationwide, with Virginia nursing programs among the top performers.",
    source: "American Nurse Journal",
    source_url: "https://www.myamericannurse.com/",
    image_url: null,
    category: "nursing",
    tags: ["nclex", "education", "licensing"],
    published_at: "2025-12-06T14:30:00Z"
  },
  {
    id: '3',
    title: "CMS Announces Updates to Hospital Rating System",
    summary: "The Centers for Medicare & Medicaid Services has released updates to the hospital star rating methodology, with greater emphasis on nurse staffing levels.",
    source: "Modern Healthcare",
    source_url: "https://www.modernhealthcare.com/",
    image_url: null,
    category: "hospitals",
    tags: ["cms", "ratings", "policy"],
    published_at: "2025-12-05T09:15:00Z"
  },
  {
    id: '4',
    title: "Travel Nurse Demand Stabilizes After Pandemic Surge",
    summary: "Industry analysts report that travel nursing rates and demand have reached a new equilibrium, with rates settling at approximately 30% above pre-pandemic levels.",
    source: "Becker's Hospital Review",
    source_url: "https://www.beckershospitalreview.com/nursing/",
    image_url: null,
    category: "nursing",
    tags: ["travel nursing", "compensation", "industry"],
    published_at: "2025-12-04T16:45:00Z"
  },
  {
    id: '5',
    title: "Virginia Board of Nursing Updates License Renewal Requirements",
    summary: "Starting in 2026, Virginia nurses will have new CEU requirements including mandatory cultural competency and telehealth training.",
    source: "Virginia Board of Nursing",
    source_url: "https://www.dhp.virginia.gov/nursing/",
    image_url: null,
    category: "virginia",
    tags: ["licensing", "ceu", "virginia", "policy"],
    published_at: "2025-12-03T11:00:00Z"
  },
  {
    id: '6',
    title: "Study: Nurse-to-Patient Ratios Directly Impact Mortality Rates",
    summary: "New research published in JAMA reinforces the critical importance of adequate nurse staffing, showing a 7% decrease in mortality for each additional nurse per shift.",
    source: "JAMA Network",
    source_url: "https://jamanetwork.com/journals/jama",
    image_url: null,
    category: "research",
    tags: ["research", "staffing", "patient care"],
    published_at: "2025-12-02T08:00:00Z"
  },
  {
    id: '7',
    title: "AI Tools Show Promise in Reducing Nursing Documentation Time",
    summary: "Pilot programs at major health systems demonstrate that AI-assisted charting can reduce documentation time by up to 40%, allowing nurses to spend more time with patients.",
    source: "Health IT News",
    source_url: "https://www.healthcareitnews.com/",
    image_url: null,
    category: "hospitals",
    tags: ["technology", "ai", "documentation"],
    published_at: "2025-12-01T13:20:00Z"
  },
  {
    id: '8',
    title: "Virginia Expands Nurse Practitioner Scope of Practice",
    summary: "The Virginia legislature has passed new legislation allowing NPs greater autonomy in prescribing and practice, effective January 2026.",
    source: "Virginia Mercury",
    source_url: "https://virginiamercury.com/category/health/",
    image_url: null,
    category: "legislation",
    tags: ["nurse practitioner", "legislation", "virginia", "scope of practice"],
    published_at: "2025-11-30T10:30:00Z"
  },
]

const CATEGORIES = [
  { id: 'all', name: 'All News', icon: Newspaper },
  { id: 'virginia', name: 'Virginia', icon: MapPin },
  { id: 'nursing', name: 'Nursing', icon: Star },
  { id: 'hospitals', name: 'Hospitals', icon: Star },
  { id: 'legislation', name: 'Legislation', icon: Star },
  { id: 'research', name: 'Research', icon: Star },
]

export default function News() {
  const auth = useAuth()
  const { isPaid } = useSubscription()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: articles = SAMPLE_ARTICLES } = useQuery<Article[]>({
    queryKey: ['news', selectedCategory],
    queryFn: () => api.get(`/api/news${selectedCategory !== 'all' ? `?category=${selectedCategory}` : ''}`).then(res => res.data),
    placeholderData: SAMPLE_ARTICLES
  })

  const { data: trending = SAMPLE_ARTICLES.slice(0, 3) } = useQuery<Article[]>({
    queryKey: ['news-trending'],
    queryFn: () => api.get('/api/news/trending').then(res => res.data),
    placeholderData: SAMPLE_ARTICLES.slice(0, 3)
  })

  const filteredArticles = articles.filter(article => {
    if (selectedCategory !== 'all' && article.category !== selectedCategory) return false
    if (searchQuery && !article.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffHours < 48) return 'Yesterday'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      virginia: 'bg-blue-100 text-blue-700',
      nursing: 'bg-green-100 text-green-700',
      hospitals: 'bg-purple-100 text-purple-700',
      legislation: 'bg-amber-100 text-amber-700',
      research: 'bg-rose-100 text-rose-700',
    }
    return colors[category] || 'bg-slate-100 text-slate-700'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Healthcare News</h1>
          <p className="text-slate-600">Stay updated with the latest in nursing and healthcare</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          {/* Categories */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Categories</h3>
            <div className="space-y-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                    selectedCategory === cat.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <cat.icon className="w-4 h-4" />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Trending */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary-600" />
              <h3 className="font-semibold text-slate-900">Trending</h3>
            </div>
            <div className="space-y-3">
              {trending.map((article, i) => (
                <a
                  key={article.id}
                  href={article.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className="flex gap-2">
                    <span className="text-slate-400 font-bold">{i + 1}</span>
                    <p className="text-sm text-slate-700 group-hover:text-primary-600 line-clamp-2">
                      {article.title}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Newsletter - Requires $9+ subscription */}
          <div className="bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4" />
              <h3 className="font-semibold">Weekly Digest</h3>
            </div>
            <p className="text-sm text-primary-100 mb-3">
              Get the top nursing news delivered to your inbox every Sunday.
            </p>
            {(auth.isAuthenticated && isPaid) || isAdminUnlocked() ? (
              <>
                <input
                  type="email"
                  placeholder="Your email"
                  className="w-full px-3 py-2 rounded-lg bg-white/20 placeholder-primary-200 text-white text-sm mb-2"
                />
                <button className="w-full py-2 bg-white text-primary-600 rounded-lg text-sm font-medium hover:bg-primary-50">
                  Subscribe
                </button>
              </>
            ) : (
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <Lock className="w-5 h-5 mx-auto mb-2 text-white/80" />
                <p className="text-xs text-primary-100 mb-2">
                  Available for Pro subscribers ($9/mo)
                </p>
                <Link
                  to="/billing"
                  className="block w-full py-2 bg-white text-primary-600 rounded-lg text-sm font-medium hover:bg-primary-50"
                >
                  Upgrade to Pro
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Featured Article */}
          {filteredArticles[0] && (
            <a
              href={filteredArticles[0].source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(filteredArticles[0].category)}`}>
                    {filteredArticles[0].category}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(filteredArticles[0].published_at)}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2 hover:text-primary-600">
                  {filteredArticles[0].title}
                </h2>
                <p className="text-slate-600 mb-4">{filteredArticles[0].summary}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{filteredArticles[0].source}</span>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                      <Bookmark className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <ExternalLink className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>
            </a>
          )}

          {/* Article List */}
          <div className="space-y-4">
            {filteredArticles.slice(1).map(article => (
              <a
                key={article.id}
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(article.category)}`}>
                        {article.category}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(article.published_at)}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-1 hover:text-primary-600">
                      {article.title}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-2">{article.summary}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-slate-500">{article.source}</span>
                      <div className="flex items-center gap-2">
                        {article.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-xs text-slate-400">#{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                </div>
              </a>
            ))}
          </div>

          {filteredArticles.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Newspaper className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No articles found</p>
            </div>
          )}

          {/* Load More */}
          {filteredArticles.length > 0 && (
            <div className="text-center pt-4">
              <button className="px-6 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
                Load More Articles
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
