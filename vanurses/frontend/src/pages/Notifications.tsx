import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Bell, Check, CheckCheck, Trash2, Briefcase, Building2,
  TrendingUp, DollarSign, Settings, Eye
} from 'lucide-react'
import { api } from '../api/client'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  is_read: boolean
  created_at: string
}

interface Watch {
  id: string
  entity_type: string
  entity_id: string
  entity_name: string
  created_at: string
}

const NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  new_matching_job: Briefcase,
  facility_score_change: TrendingUp,
  similar_job: Briefcase,
  price_change: DollarSign,
  watched_facility_job: Building2
}

export default function Notifications() {
  const queryClient = useQueryClient()
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [activeTab, setActiveTab] = useState<'notifications' | 'watches' | 'settings'>('notifications')

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications', showUnreadOnly],
    queryFn: () => api.get(`/api/notifications?unread_only=${showUnreadOnly}`).then(res => res.data)
  })

  const { data: watchesData } = useQuery({
    queryKey: ['watches'],
    queryFn: () => api.get('/api/notifications/watches').then(res => res.data)
  })

  const { data: preferences } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => api.get('/api/notifications/preferences').then(res => res.data)
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/api/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  })

  const removeWatchMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/notifications/watches/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watches'] })
  })

  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/notifications/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  })

  const notifications: Notification[] = notificationsData?.notifications || []
  const watches: Watch[] = watchesData?.watches || []
  const unreadCount = notificationsData?.unread_count || 0

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'notifications' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <Bell className="w-4 h-4" />
          Notifications
        </button>
        <button
          onClick={() => setActiveTab('watches')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'watches' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <Eye className="w-4 h-4" />
          Watching
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          {/* Filter */}
          <div className="p-4 border-b border-slate-100">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showUnreadOnly}
                onChange={(e) => setShowUnreadOnly(e.target.checked)}
                className="rounded border-slate-300"
              />
              Show unread only
            </label>
          </div>

          {/* List */}
          <div className="divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Bell className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = NOTIFICATION_ICONS[notification.type] || Bell
                return (
                  <div
                    key={notification.id}
                    className={`p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors ${
                      !notification.is_read ? 'bg-primary-50/50' : ''
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      !notification.is_read ? 'bg-primary-100' : 'bg-slate-100'
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        !notification.is_read ? 'text-primary-600' : 'text-slate-500'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.is_read ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-slate-500 mt-0.5">{notification.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{formatDate(notification.created_at)}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      {!notification.is_read && (
                        <button
                          onClick={() => markReadMutation.mutate(notification.id)}
                          className="p-2 hover:bg-slate-100 rounded-lg"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4 text-slate-400" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotificationMutation.mutate(notification.id)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500"
                        title="Delete notification"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Watches Tab */}
      {activeTab === 'watches' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Watched Facilities & Jobs</h2>
            <p className="text-sm text-slate-500">Get notified about updates to these items</p>
          </div>

          <div className="divide-y divide-slate-100">
            {watches.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Eye className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>You're not watching anything yet</p>
                <p className="text-sm mt-1">Click the eye icon on facilities or jobs to watch them</p>
              </div>
            ) : (
              watches.map((watch) => (
                <div key={watch.id} className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    {watch.entity_type === 'facility' ? (
                      <Building2 className="w-5 h-5 text-slate-500" />
                    ) : (
                      <Briefcase className="w-5 h-5 text-slate-500" />
                    )}
                  </div>

                  <div className="flex-1">
                    <Link
                      to={`/${watch.entity_type === 'facility' ? 'facilities' : 'jobs'}/${watch.entity_id}`}
                      className="text-sm font-medium text-slate-900 hover:text-primary-600"
                    >
                      {watch.entity_name}
                    </Link>
                    <p className="text-xs text-slate-400">
                      Watching since {new Date(watch.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    onClick={() => removeWatchMutation.mutate(watch.id)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500"
                    title="Stop watching"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-6">Alert Preferences</h2>

          <div className="space-y-6">
            {/* Email Settings */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">Email Notifications</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    defaultChecked={preferences?.email_enabled}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-600">Enable email notifications</span>
                </label>

                <div className="ml-6">
                  <select
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2"
                    defaultValue={preferences?.email_frequency || 'daily'}
                  >
                    <option value="instant">Instant</option>
                    <option value="daily">Daily digest</option>
                    <option value="weekly">Weekly digest</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Alert Types */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">Notify me about</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input type="checkbox" defaultChecked className="rounded border-slate-300" />
                  <span className="text-sm text-slate-600">New jobs matching my preferences</span>
                </label>
                <label className="flex items-center gap-3">
                  <input type="checkbox" defaultChecked className="rounded border-slate-300" />
                  <span className="text-sm text-slate-600">Score changes for watched facilities</span>
                </label>
                <label className="flex items-center gap-3">
                  <input type="checkbox" defaultChecked className="rounded border-slate-300" />
                  <span className="text-sm text-slate-600">Pay rate changes for watched jobs</span>
                </label>
                <label className="flex items-center gap-3">
                  <input type="checkbox" defaultChecked className="rounded border-slate-300" />
                  <span className="text-sm text-slate-600">New jobs at watched facilities</span>
                </label>
              </div>
            </div>

            <button className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600">
              Save Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
