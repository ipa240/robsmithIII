import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { api } from '../api/client'
import { Link } from 'react-router-dom'
import {
  Briefcase, Building2, Calendar, ChevronRight, Clock, GripVertical,
  List, Grid3X3, Plus, MessageSquare, Trash2, Edit2, X, Check,
  Send, Phone, FileText, MapPin, DollarSign
} from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription'
import BlurOverlay from '../components/BlurOverlay'

interface Application {
  id: string
  job_id: string
  job_title: string
  facility_name: string
  facility_city: string
  status: 'clicked' | 'applied' | 'screening' | 'interviewing' | 'offer' | 'accepted' | 'rejected' | 'withdrawn'
  applied_at: string
  notes: string
  next_step: string
  next_step_date: string | null
  events: ApplicationEvent[]
}

interface ApplicationEvent {
  id: string
  event_type: string
  event_data: Record<string, unknown>
  created_at: string
}

const STATUS_CONFIG = {
  clicked: { label: 'Clicked Apply', color: 'bg-sky-100 text-sky-700', bgColor: 'bg-sky-50' },
  applied: { label: 'Applied', color: 'bg-blue-100 text-blue-700', bgColor: 'bg-blue-50' },
  screening: { label: 'Screening', color: 'bg-purple-100 text-purple-700', bgColor: 'bg-purple-50' },
  interviewing: { label: 'Interviewing', color: 'bg-amber-100 text-amber-700', bgColor: 'bg-amber-50' },
  offer: { label: 'Offer', color: 'bg-green-100 text-green-700', bgColor: 'bg-green-50' },
  accepted: { label: 'Accepted', color: 'bg-emerald-100 text-emerald-700', bgColor: 'bg-emerald-50' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', bgColor: 'bg-red-50' },
  withdrawn: { label: 'Withdrawn', color: 'bg-slate-100 text-slate-700', bgColor: 'bg-slate-50' },
}

const KANBAN_COLUMNS = ['clicked', 'applied', 'screening', 'interviewing', 'offer'] as const

export default function Applications() {
  const auth = useAuth()
  const { isPaid } = useSubscription()
  // Only show content if authenticated AND paid
  const canAccessFeature = auth.isAuthenticated && isPaid
  const queryClient = useQueryClient()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [showAddNote, setShowAddNote] = useState(false)
  const [newNote, setNewNote] = useState('')

  // If user is not paid, show blur overlay
  if (!canAccessFeature) {
    return (
      <BlurOverlay
        title="Application Tracker"
        description="Track your job applications from click to offer. Upgrade to access this premium feature."
        showDemo
        demoKey="applications"
        showPricing
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-8 w-48 bg-slate-200 rounded mb-2" />
              <div className="h-5 w-64 bg-slate-100 rounded" />
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-24 bg-slate-100 rounded" />
              <div className="h-10 w-24 bg-slate-100 rounded" />
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {['Clicked', 'Applied', 'Screening', 'Interviewing', 'Offer'].map((status) => (
              <div key={status} className="bg-slate-50 rounded-xl p-3">
                <div className="h-6 w-20 bg-slate-200 rounded mb-3" />
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="h-5 w-32 bg-slate-200 rounded mb-2" />
                      <div className="h-4 w-24 bg-slate-100 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </BlurOverlay>
    )
  }
  const [editingNextStep, setEditingNextStep] = useState(false)
  const [nextStepData, setNextStepData] = useState({ step: '', date: '' })

  // Drag and drop state for visual feedback
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const { data: applications = [], isLoading } = useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: () => api.get('/api/applications').then(res => res.data)
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/applications/${id}`, { status }),
    // Optimistic update for smooth drag & drop
    onMutate: async ({ id, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['applications'] })
      // Snapshot the previous value
      const previousApps = queryClient.getQueryData<Application[]>(['applications'])
      // Optimistically update to the new value
      queryClient.setQueryData<Application[]>(['applications'], (old) =>
        old?.map((app) => (app.id === id ? { ...app, status: status as Application['status'] } : app)) || []
      )
      // Return context with snapshot
      return { previousApps }
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousApps) {
        queryClient.setQueryData(['applications'], context.previousApps)
      }
      setUpdateError('Failed to update status. Please try again.')
      setTimeout(() => setUpdateError(null), 3000)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
    }
  })

  const addNote = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.post(`/api/applications/${id}/notes`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      setNewNote('')
      setShowAddNote(false)
    }
  })

  const updateNextStep = useMutation({
    mutationFn: ({ id, next_step, next_step_date }: { id: string; next_step: string; next_step_date: string | null }) =>
      api.patch(`/api/applications/${id}`, { next_step, next_step_date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      setEditingNextStep(false)
    }
  })

  const deleteApplication = useMutation({
    mutationFn: (id: string) => api.delete(`/api/applications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      setSelectedApp(null)
    }
  })

  const handleDragStart = (e: React.DragEvent, app: Application) => {
    e.dataTransfer.setData('application/json', JSON.stringify(app))
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(app.id)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDropTarget(null)
  }

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault()
    setDropTarget(null)
    try {
      const app = JSON.parse(e.dataTransfer.getData('application/json')) as Application
      if (app.status !== status) {
        updateStatus.mutate({ id: app.id, status })
      }
    } catch (err) {
      console.error('Failed to parse drag data:', err)
    }
    setDraggingId(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (status: string) => {
    setDropTarget(status)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the column entirely (not entering a child element)
    if (e.relatedTarget && !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDropTarget(null)
    }
  }

  const getColumnApps = (status: string) =>
    applications.filter(app => app.status === status)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Applications</h1>
          <p className="text-slate-600">Track your job applications</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setView('kanban')}
              className={`p-2 rounded ${view === 'kanban' ? 'bg-white shadow' : ''}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded ${view === 'list' ? 'bg-white shadow' : ''}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <Link
            to="/jobs"
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            Find Jobs
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Applications</p>
          <p className="text-2xl font-bold text-slate-900">{applications.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">In Progress</p>
          <p className="text-2xl font-bold text-amber-600">
            {applications.filter(a => ['applied', 'screening', 'interviewing'].includes(a.status)).length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Offers</p>
          <p className="text-2xl font-bold text-green-600">
            {applications.filter(a => a.status === 'offer').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Response Rate</p>
          <p className="text-2xl font-bold text-primary-600">
            {applications.length > 0
              ? Math.round((applications.filter(a => !['applied', 'rejected'].includes(a.status)).length / applications.length) * 100)
              : 0}%
          </p>
        </div>
      </div>

      {/* Error Toast */}
      {updateError && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <X className="w-4 h-4" />
          {updateError}
        </div>
      )}

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="grid grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map(status => (
            <div
              key={status}
              className={`rounded-xl p-4 min-h-[400px] transition-all duration-200 ${STATUS_CONFIG[status].bgColor} ${
                dropTarget === status ? 'ring-2 ring-primary-500 ring-offset-2 bg-primary-50' : ''
              }`}
              onDrop={e => handleDrop(e, status)}
              onDragOver={handleDragOver}
              onDragEnter={() => handleDragEnter(status)}
              onDragLeave={handleDragLeave}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">
                  {STATUS_CONFIG[status].label}
                </h3>
                <span className="px-2 py-0.5 bg-white rounded-full text-xs font-medium">
                  {getColumnApps(status).length}
                </span>
              </div>
              <div className="space-y-3">
                {getColumnApps(status).map(app => (
                  <div
                    key={app.id}
                    draggable
                    onDragStart={e => handleDragStart(e, app)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedApp(app)}
                    className={`bg-white rounded-lg p-4 shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-all duration-200 ${
                      draggingId === app.id ? 'opacity-50 scale-95 ring-2 ring-primary-400' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <GripVertical className="w-4 h-4 text-slate-300 mt-0.5 cursor-grab active:cursor-grabbing" />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 text-sm">{app.job_title}</p>
                        <p className="text-xs text-slate-500">{app.facility_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      {new Date(app.applied_at).toLocaleDateString()}
                    </div>
                    {app.next_step && (
                      <div className="mt-2 px-2 py-1 bg-amber-50 rounded text-xs text-amber-700">
                        Next: {app.next_step}
                      </div>
                    )}
                  </div>
                ))}
                {/* Drop indicator when column is empty and being dragged over */}
                {getColumnApps(status).length === 0 && dropTarget === status && (
                  <div className="border-2 border-dashed border-primary-400 rounded-lg p-4 text-center text-primary-600 text-sm">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Job</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Facility</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Applied</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Next Step</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {applications.map(app => (
                <tr key={app.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{app.job_title}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600">{app.facility_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[app.status].color}`}>
                      {STATUS_CONFIG[app.status].label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(app.applied_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {app.next_step || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedApp(app)}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {applications.length === 0 && (
            <div className="text-center py-12">
              <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No applications yet</p>
              <Link to="/jobs" className="text-primary-600 hover:underline mt-2 inline-block">
                Browse jobs
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Completed Applications */}
      {applications.filter(a => ['accepted', 'rejected', 'withdrawn'].includes(a.status)).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Completed Applications</h3>
          <div className="space-y-3">
            {applications
              .filter(a => ['accepted', 'rejected', 'withdrawn'].includes(a.status))
              .map(app => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900">{app.job_title}</p>
                    <p className="text-sm text-slate-500">{app.facility_name}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[app.status].color}`}>
                    {STATUS_CONFIG[app.status].label}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Application Detail Slide-over */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/30" onClick={() => setSelectedApp(null)} />
          <div className="ml-auto w-full max-w-lg bg-white h-full shadow-xl overflow-y-auto relative">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
              <h2 className="font-semibold text-lg text-slate-900">Application Details</h2>
              <button onClick={() => setSelectedApp(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Job Info */}
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedApp.job_title}</h3>
                <div className="flex items-center gap-2 text-slate-600 mt-1">
                  <Building2 className="w-4 h-4" />
                  <span>{selectedApp.facility_name}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500 mt-1">
                  <MapPin className="w-4 h-4" />
                  <span>{selectedApp.facility_city}</span>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={selectedApp.status}
                  onChange={e => updateStatus.mutate({ id: selectedApp.id, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>

              {/* Timeline */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-slate-700">Timeline</label>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center">
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Applied</p>
                      <p className="text-xs text-slate-500">
                        {new Date(selectedApp.applied_at).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  {selectedApp.events?.map(event => (
                    <div key={event.id} className="flex gap-3">
                      <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{event.event_type}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(event.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Step */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Next Step</label>
                  {!editingNextStep && (
                    <button
                      onClick={() => {
                        setNextStepData({
                          step: selectedApp.next_step || '',
                          date: selectedApp.next_step_date || ''
                        })
                        setEditingNextStep(true)
                      }}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {editingNextStep ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="e.g., Phone interview with HR"
                      value={nextStepData.step}
                      onChange={e => setNextStepData({ ...nextStepData, step: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <input
                      type="datetime-local"
                      value={nextStepData.date}
                      onChange={e => setNextStepData({ ...nextStepData, date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateNextStep.mutate({
                          id: selectedApp.id,
                          next_step: nextStepData.step,
                          next_step_date: nextStepData.date || null
                        })}
                        className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingNextStep(false)}
                        className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    {selectedApp.next_step ? (
                      <>
                        <p className="text-slate-900">{selectedApp.next_step}</p>
                        {selectedApp.next_step_date && (
                          <p className="text-sm text-slate-500 mt-1">
                            {new Date(selectedApp.next_step_date).toLocaleString()}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-slate-400">No next step set</p>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Notes</label>
                  <button
                    onClick={() => setShowAddNote(!showAddNote)}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {showAddNote && (
                  <div className="mb-3 space-y-2">
                    <textarea
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => addNote.mutate({ id: selectedApp.id, note: newNote })}
                        className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm"
                      >
                        Add Note
                      </button>
                      <button
                        onClick={() => {
                          setShowAddNote(false)
                          setNewNote('')
                        }}
                        className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <div className="p-3 bg-slate-50 rounded-lg">
                  {selectedApp.notes ? (
                    <p className="text-slate-600 whitespace-pre-wrap">{selectedApp.notes}</p>
                  ) : (
                    <p className="text-slate-400">No notes yet</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <Link
                  to={`/jobs/${selectedApp.job_id}`}
                  className="flex-1 py-2 text-center border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  View Job
                </Link>
                <button
                  onClick={() => {
                    if (confirm('Delete this application?')) {
                      deleteApplication.mutate(selectedApp.id)
                    }
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
