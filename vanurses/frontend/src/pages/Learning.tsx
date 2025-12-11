import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import {
  GraduationCap, BookOpen, Plus, X,
  ChevronRight, Star, Pencil, Trash2,
  CheckCircle, AlertCircle, ExternalLink
} from 'lucide-react'
import { useSubscription, isAdminUnlocked } from '../hooks/useSubscription'
import BlurOverlay from '../components/BlurOverlay'

interface CEULog {
  id: string
  title: string
  provider: string
  hours: number
  category: string
  completion_date: string
  certificate_url: string | null
}

interface Resource {
  id: string
  title: string
  description: string
  category: string
  url: string
  type: 'article' | 'video' | 'guide' | 'tool'
  reads: number
}

const CEU_CATEGORIES = [
  'Pharmacology', 'Patient Safety', 'Ethics', 'Clinical Skills',
  'Leadership', 'Infection Control', 'Pain Management', 'Other'
]

// Resources are now fetched from API

export default function Learning() {
  const auth = useAuth()
  const { isPaid } = useSubscription()
  // Only show content if authenticated AND paid
  const canAccessFeature = (auth.isAuthenticated && isPaid) || isAdminUnlocked()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'ceu' | 'resources'>('ceu')
  const [showAddCEU, setShowAddCEU] = useState(false)
  const [editingCEU, setEditingCEU] = useState<CEULog | null>(null)
  const [newCEU, setNewCEU] = useState({
    title: '',
    provider: '',
    hours: 0,
    category: '',
    completion_date: ''
  })
  const [resourceCategory, setResourceCategory] = useState('All')

  // Sample CEU data for demo (declared outside the conditional to avoid duplicate)
  const sampleCEUs = [
    { title: 'Pharmacology Update 2024', provider: 'NursingCE.com', hours: 5, category: 'Pharmacology', completion_date: '2024-01-10' },
    { title: 'Patient Safety Best Practices', provider: 'Wild Iris', hours: 3, category: 'Patient Safety', completion_date: '2024-01-05' },
    { title: 'Ethics in Healthcare', provider: 'Nurse.com', hours: 2, category: 'Ethics', completion_date: '2023-12-15' },
    { title: 'Infection Control Protocols', provider: 'CDC', hours: 4, category: 'Infection Control', completion_date: '2023-11-20' },
  ]
  const sampleTotalHours = 14
  const sampleRequiredHours = 30

  // If user is not paid, show blur overlay with sample data
  if (!canAccessFeature) {
    return (
      <BlurOverlay
        title="CEU Learning Center"
        description="Track your continuing education credits and access curated nursing resources. Upgrade to access this premium feature."
        showDemo
        demoKey="learning"
        showPricing
        blurIntensity="light"
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Learning Hub</h1>
              <p className="text-slate-600">CEU tracking and career resources</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <div className="px-6 py-3 text-sm font-medium border-b-2 -mb-px border-primary-600 text-primary-600">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                CEU Tracker
              </div>
            </div>
            <div className="px-6 py-3 text-sm font-medium border-b-2 -mb-px border-transparent text-slate-400">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Resources
              </div>
            </div>
          </div>

          {/* Progress Card */}
          <div className="bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">License Renewal Progress</h2>
                <p className="text-primary-100 text-sm">Virginia requires {sampleRequiredHours} CEU hours per renewal</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{sampleTotalHours}</p>
                <p className="text-primary-100 text-sm">of {sampleRequiredHours} hours</p>
              </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3 mb-2">
              <div className="bg-white rounded-full h-3 transition-all" style={{ width: `${(sampleTotalHours / sampleRequiredHours) * 100}%` }} />
            </div>
            <p className="text-sm text-primary-100">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              {sampleRequiredHours - sampleTotalHours} hours remaining
            </p>
          </div>

          {/* CEU Log */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-900">Your CEU Log</h3>
              <div className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg">
                <Plus className="w-4 h-4" />
                Log CEU
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Course</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Provider</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Category</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Hours</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sampleCEUs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">{log.title}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{log.provider}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">{log.category}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{log.hours}h</td>
                      <td className="px-6 py-4 text-slate-600">{new Date(log.completion_date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Suggested Free CEU Courses */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Suggested Free CEU Courses</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { title: 'Free Nursing CE Courses', hours: 30, provider: 'NursingCE.com' },
                { title: 'Free CEU Courses', hours: 2, provider: 'Wild Iris Medical' },
                { title: 'Virginia Nursing CEUs', hours: 30, provider: 'NurseCE4Less' },
                { title: 'Substance Misuse Training', hours: 8, provider: 'UVA School of Nursing' },
              ].map((course, i) => (
                <div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-700">{course.title}</p>
                      <p className="text-sm text-slate-400">{course.provider}</p>
                    </div>
                    <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs font-medium">{course.hours}h</span>
                  </div>
                  <span className="mt-3 text-sm text-primary-600 flex items-center gap-1">
                    Start Course <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </BlurOverlay>
    )
  }

  const { data: ceuLogs = [] } = useQuery<CEULog[]>({
    queryKey: ['ceu-logs'],
    queryFn: () => api.get('/api/learning/ceus').then(res => res.data)
  })

  const addCEU = useMutation({
    mutationFn: (data: typeof newCEU) => api.post('/api/learning/ceus', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ceu-logs'] })
      setShowAddCEU(false)
      setNewCEU({ title: '', provider: '', hours: 0, category: '', completion_date: '' })
    }
  })

  const updateCEU = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CEULog> }) =>
      api.patch(`/api/learning/ceus/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ceu-logs'] })
      setEditingCEU(null)
    }
  })

  const deleteCEU = useMutation({
    mutationFn: (id: string) => api.delete(`/api/learning/ceus/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ceu-logs'] })
    }
  })

  // Fetch resources from API
  const { data: resources = [] } = useQuery<Resource[]>({
    queryKey: ['learning-resources', resourceCategory],
    queryFn: () => api.get('/api/learning/resources', {
      params: resourceCategory !== 'All' ? { category: resourceCategory } : {}
    }).then(res => res.data)
  })

  const totalHours = ceuLogs.reduce((sum, log) => sum + log.hours, 0)
  const requiredHours = 30 // Virginia RN requirement
  const hoursRemaining = Math.max(0, requiredHours - totalHours)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Learning Hub</h1>
          <p className="text-slate-600">CEU tracking and career resources</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('ceu')}
          className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'ceu'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            CEU Tracker
          </div>
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'resources'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Resources
          </div>
        </button>
      </div>

      {/* CEU Tracker Tab */}
      {activeTab === 'ceu' && (
        <div className="space-y-6">
          {/* Progress Card */}
          <div className="bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">License Renewal Progress</h2>
                <p className="text-primary-100 text-sm">Virginia requires {requiredHours} CEU hours per renewal</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{totalHours}</p>
                <p className="text-primary-100 text-sm">of {requiredHours} hours</p>
              </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3 mb-2">
              <div
                className="bg-white rounded-full h-3 transition-all"
                style={{ width: `${Math.min(100, (totalHours / requiredHours) * 100)}%` }}
              />
            </div>
            {hoursRemaining > 0 ? (
              <p className="text-sm text-primary-100">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                {hoursRemaining} hours remaining
              </p>
            ) : (
              <p className="text-sm text-primary-100">
                <CheckCircle className="w-4 h-4 inline mr-1" />
                Requirements complete!
              </p>
            )}
          </div>

          {/* Add CEU Button */}
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-900">Your CEU Log</h3>
            <button
              onClick={() => setShowAddCEU(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              Log CEU
            </button>
          </div>

          {/* CEU List */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {ceuLogs.length === 0 ? (
              <div className="text-center py-12">
                <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No CEUs logged yet</p>
                <button
                  onClick={() => setShowAddCEU(true)}
                  className="mt-4 text-primary-600 hover:underline"
                >
                  Log your first CEU
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Course</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Provider</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Category</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Hours</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ceuLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">{log.title}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{log.provider}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                          {log.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{log.hours}h</td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(log.completion_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingCEU(log)}
                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this CEU?')) {
                                deleteCEU.mutate(log.id)
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Suggested Courses */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Suggested Free CEU Courses</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  title: 'Free Nursing CE Courses',
                  hours: 30,
                  provider: 'NursingCE.com',
                  url: 'https://www.nursingce.com/'
                },
                {
                  title: 'Free CEU Courses',
                  hours: 2,
                  provider: 'Wild Iris Medical',
                  url: 'https://wildirismedicaleducation.com/nursing-ceu/free-nursing-ceus'
                },
                {
                  title: 'Virginia Nursing CEUs',
                  hours: 30,
                  provider: 'NurseCE4Less',
                  url: 'https://nursece4less.com/nursing-ceus/virginia-nursing-ceu-courses/'
                },
                {
                  title: 'Substance Misuse Training (8hr Free)',
                  hours: 8,
                  provider: 'UVA School of Nursing',
                  url: 'https://nursing.virginia.edu/sonce/'
                },
              ].map((course, i) => (
                <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{course.title}</p>
                      <p className="text-sm text-slate-500">{course.provider}</p>
                    </div>
                    <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs font-medium">
                      {course.hours}h
                    </span>
                  </div>
                  <a
                    href={course.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 text-sm text-primary-600 hover:underline flex items-center gap-1"
                  >
                    Start Course <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Resources Tab */}
      {activeTab === 'resources' && (
        <div className="space-y-6">
          {/* Categories */}
          <div className="flex gap-2 flex-wrap">
            {['All', 'Career', 'Education', 'Licensing', 'Clinical'].map(cat => (
              <button
                key={cat}
                onClick={() => setResourceCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  resourceCategory === cat
                    ? 'bg-primary-600 text-white'
                    : 'bg-white border border-slate-200 hover:border-primary-500 hover:text-primary-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Resource Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {resources.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-white rounded-xl border border-slate-200">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No resources available in this category</p>
              </div>
            ) : (
              resources.map((resource: any) => (
                <a
                  key={resource.id}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow block"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      resource.is_free ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {resource.is_free ? 'Free' : 'Paid'}
                    </span>
                    <span className="text-xs text-slate-400">{resource.provider}</span>
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">{resource.title}</h3>
                  <p className="text-sm text-slate-600 line-clamp-2">{resource.description}</p>
                  <div className="mt-3 flex items-center gap-1 text-primary-600 text-sm">
                    View Resource <ExternalLink className="w-3 h-3" />
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add CEU Modal */}
      {showAddCEU && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowAddCEU(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Log CEU Hours</h2>
              <button onClick={() => setShowAddCEU(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Course Title</label>
                <input
                  type="text"
                  value={newCEU.title}
                  onChange={e => setNewCEU({ ...newCEU, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g., Pharmacology Update"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
                <input
                  type="text"
                  value={newCEU.provider}
                  onChange={e => setNewCEU({ ...newCEU, provider: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g., Nurse.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newCEU.hours}
                    onChange={e => setNewCEU({ ...newCEU, hours: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Completion Date</label>
                  <input
                    type="date"
                    value={newCEU.completion_date}
                    onChange={e => setNewCEU({ ...newCEU, completion_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={newCEU.category}
                  onChange={e => setNewCEU({ ...newCEU, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">Select category</option>
                  {CEU_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddCEU(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => addCEU.mutate(newCEU)}
                  disabled={!newCEU.title || !newCEU.hours || !newCEU.category}
                  className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit CEU Modal */}
      {editingCEU && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setEditingCEU(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Edit CEU</h2>
              <button onClick={() => setEditingCEU(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Course Title</label>
                <input
                  type="text"
                  value={editingCEU.title}
                  onChange={e => setEditingCEU({ ...editingCEU, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
                <input
                  type="text"
                  value={editingCEU.provider}
                  onChange={e => setEditingCEU({ ...editingCEU, provider: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingCEU.hours}
                    onChange={e => setEditingCEU({ ...editingCEU, hours: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Completion Date</label>
                  <input
                    type="date"
                    value={editingCEU.completion_date?.split('T')[0] || ''}
                    onChange={e => setEditingCEU({ ...editingCEU, completion_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={editingCEU.category}
                  onChange={e => setEditingCEU({ ...editingCEU, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">Select category</option>
                  {CEU_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditingCEU(null)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateCEU.mutate({
                    id: editingCEU.id,
                    data: {
                      title: editingCEU.title,
                      provider: editingCEU.provider,
                      hours: editingCEU.hours,
                      category: editingCEU.category,
                      completion_date: editingCEU.completion_date
                    }
                  })}
                  disabled={!editingCEU.title || !editingCEU.hours || !editingCEU.category}
                  className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
