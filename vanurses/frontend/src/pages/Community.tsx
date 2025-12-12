import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { isAdminUnlocked } from '../hooks/useSubscription'
import { api } from '../api/client'
import { Link } from 'react-router-dom'
import {
  MessageSquare, Users, TrendingUp, Plus, ThumbsUp, Eye, Clock,
  ChevronRight, Pin, Lock, User, Send, Flag, X, ArrowUp, ArrowDown,
  Edit2, Trash2, MoreVertical, Lightbulb, Loader2, Sparkles
} from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  post_count: number
}

interface Post {
  id: string
  category_id: string
  category_name: string
  author_name: string
  author_id: string
  title: string
  content: string
  is_anonymous: boolean
  is_pinned: boolean
  is_locked: boolean
  upvotes: number
  reply_count: number
  view_count: number
  created_at: string
  user_voted: 'up' | 'down' | null
}

interface Reply {
  id: string
  post_id: string
  author_name: string
  author_id: string
  content: string
  is_anonymous: boolean
  upvotes: number
  created_at: string
  parent_reply_id: string | null
  user_voted: 'up' | 'down' | null
}

const ICON_OPTIONS = [
  'MessageSquare', 'Heart', 'Briefcase', 'GraduationCap', 'Plane',
  'Building2', 'MapPin', 'Star', 'Users', 'Award', 'BookOpen', 'Coffee'
]

export default function Community() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [showNewPost, setShowNewPost] = useState(false)
  const [newPost, setNewPost] = useState({ title: '', content: '', is_anonymous: false, category_id: '' })
  const [newReply, setNewReply] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [editPost, setEditPost] = useState({ title: '', content: '' })
  const [showPostMenu, setShowPostMenu] = useState<string | null>(null)
  const [showSuggestCategory, setShowSuggestCategory] = useState(false)
  const [newCategory, setNewCategory] = useState({ name: '', description: '', icon: 'MessageSquare' })

  // Fetch current user info to determine post ownership
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => api.get('/api/me').then(res => res.data.data),
    enabled: auth.isAuthenticated
  })

  // Fetch categories from API
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['community-categories'],
    queryFn: () => api.get('/api/community/categories').then(res => res.data)
  })

  const { data: posts = [] } = useQuery<Post[]>({
    queryKey: ['community-posts', selectedCategory],
    queryFn: () => api.get(`/api/community/posts${selectedCategory ? `?category=${selectedCategory}` : ''}`).then(res => res.data)
  })

  const { data: trending = [] } = useQuery<Post[]>({
    queryKey: ['community-trending'],
    queryFn: () => api.get('/api/community/posts/trending').then(res => res.data)
  })

  const { data: replies = [] } = useQuery<Reply[]>({
    queryKey: ['post-replies', selectedPost?.id],
    queryFn: () => api.get(`/api/community/posts/${selectedPost?.id}/replies`).then(res => res.data),
    enabled: !!selectedPost
  })

  const createPost = useMutation({
    mutationFn: (data: typeof newPost) => api.post('/api/community/posts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      queryClient.invalidateQueries({ queryKey: ['community-categories'] })
      setShowNewPost(false)
      setNewPost({ title: '', content: '', is_anonymous: false, category_id: '' })
    },
    onError: (error: any) => {
      console.error('Post creation error:', error)
      alert(error.response?.data?.detail || 'Failed to create post. Please try again.')
    }
  })

  const createReply = useMutation({
    mutationFn: (data: { post_id: string; content: string; is_anonymous: boolean; parent_reply_id?: string }) =>
      api.post(`/api/community/posts/${data.post_id}/replies`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-replies'] })
      setNewReply('')
      setReplyingTo(null)
    }
  })

  const vote = useMutation({
    mutationFn: (data: { type: 'post' | 'reply'; id: string; direction: 'up' | 'down' }) =>
      api.post(`/api/community/${data.type}s/${data.id}/vote`, { direction: data.direction }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      queryClient.invalidateQueries({ queryKey: ['post-replies'] })
    }
  })

  const updatePost = useMutation({
    mutationFn: (data: { id: string; title: string; content: string }) =>
      api.put(`/api/community/posts/${data.id}`, { title: data.title, content: data.content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      setEditingPost(null)
      setSelectedPost(null)
    }
  })

  const deletePost = useMutation({
    mutationFn: (id: string) => api.delete(`/api/community/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      setSelectedPost(null)
    }
  })

  const deleteReply = useMutation({
    mutationFn: (id: string) => api.delete(`/api/community/replies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-replies'] })
    }
  })

  const suggestCategory = useMutation({
    mutationFn: (data: typeof newCategory) => api.post('/api/community/categories/suggest', data),
    onSuccess: () => {
      setShowSuggestCategory(false)
      setNewCategory({ name: '', description: '', icon: 'MessageSquare' })
      // Show success message
      alert('Category suggestion submitted! It will appear once approved by an admin.')
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Failed to submit category suggestion')
    }
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  // Show demo/signup prompt for non-authenticated users
  if (!auth.isAuthenticated && !isAdminUnlocked()) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Community</h1>
          <p className="text-slate-600">Connect with nurses across Virginia</p>
        </div>

        {/* Free Account CTA */}
        <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-xl p-8 text-white">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Users className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">Join the Virginia Nurses Community</h2>
              <p className="text-primary-100 mb-4 max-w-2xl">
                Connect with fellow nurses, share experiences, ask questions, and get advice from the community.
                <strong className="text-white"> 100% free with your account!</strong>
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => auth.signinRedirect()}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50"
                >
                  <Sparkles className="w-5 h-5" />
                  Create Free Account
                </button>
                <button
                  onClick={() => auth.signinRedirect()}
                  className="inline-flex items-center gap-2 px-6 py-3 border-2 border-white/50 text-white rounded-lg font-medium hover:bg-white/10"
                >
                  Already have an account? Log In
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Demo Preview - Blurred */}
        <div className="relative">
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 rounded-xl flex items-center justify-center">
            <div className="text-center p-8">
              <Lock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Community Preview</h3>
              <p className="text-slate-600 mb-4 max-w-md">
                Create a free account to join discussions, share advice, and connect with Virginia nurses.
              </p>
              <button
                onClick={() => auth.signinRedirect()}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Sign Up Free
              </button>
            </div>
          </div>

          {/* Demo Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6 opacity-50">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">2,847</p>
                  <p className="text-sm text-slate-500">Members</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-accent-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">1,234</p>
                  <p className="text-sm text-slate-500">Discussions</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">+127</p>
                  <p className="text-sm text-slate-500">This Week</p>
                </div>
              </div>
            </div>
          </div>

          {/* Demo Categories */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 opacity-50">
            <h3 className="font-semibold text-slate-900 mb-3">Popular Topics</h3>
            <div className="space-y-2">
              {['Career Advice', 'Salary Discussions', 'Work-Life Balance', 'Job Hunting Tips', 'Specialty Talk'].map(topic => (
                <div key={topic} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">{topic}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Community</h1>
          <p className="text-slate-600">Connect with nurses across Virginia</p>
        </div>
        <button
          onClick={() => {
            // Pre-fill category if one is selected
            const selectedCat = categories.find(c => c.slug === selectedCategory)
            setNewPost({
              title: '',
              content: '',
              is_anonymous: false,
              category_id: selectedCat?.id || ''
            })
            setShowNewPost(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          New Post
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">2,847</p>
              <p className="text-sm text-slate-500">Members</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-accent-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{posts.length}</p>
              <p className="text-sm text-slate-500">Discussions</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">+127</p>
              <p className="text-sm text-slate-500">This Week</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Categories</h3>
              <button
                onClick={() => setShowSuggestCategory(true)}
                className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                title="Suggest a category"
              >
                <Lightbulb className="w-4 h-4" />
              </button>
            </div>
            {categoriesLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                    selectedCategory === null ? 'bg-primary-50 text-primary-700' : 'hover:bg-slate-50'
                  }`}
                >
                  All Discussions
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.slug)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between ${
                      selectedCategory === cat.slug ? 'bg-primary-50 text-primary-700' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className="text-slate-400">{cat.post_count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Trending */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Trending</h3>
            <div className="space-y-3">
              {trending.slice(0, 5).map((post, i) => (
                <button
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="w-full text-left group"
                >
                  <div className="flex gap-2">
                    <span className="text-slate-400 font-medium">{i + 1}.</span>
                    <p className="text-sm text-slate-700 group-hover:text-primary-600 line-clamp-2">
                      {post.title}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Community Guidelines */}
          <div className="bg-slate-50 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 mb-2">Community Guidelines</h3>
            <ul className="text-xs text-slate-600 space-y-1">
              <li>- Be respectful and professional</li>
              <li>- No HIPAA violations</li>
              <li>- No spam or self-promotion</li>
              <li>- Report inappropriate content</li>
            </ul>
          </div>
        </div>

        {/* Posts List */}
        <div className="lg:col-span-3">
          {selectedPost ? (
            /* Post Detail View */
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="p-4 border-b border-slate-200">
                <button
                  onClick={() => setSelectedPost(null)}
                  className="text-sm text-slate-500 hover:text-slate-700 mb-3"
                >
                  Back to discussions
                </button>
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => vote.mutate({ type: 'post', id: selectedPost.id, direction: 'up' })}
                      className={`p-1 rounded ${selectedPost.user_voted === 'up' ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <ArrowUp className="w-5 h-5" />
                    </button>
                    <span className="font-medium text-slate-900">{selectedPost.upvotes}</span>
                    <button
                      onClick={() => vote.mutate({ type: 'post', id: selectedPost.id, direction: 'down' })}
                      className={`p-1 rounded ${selectedPost.user_voted === 'down' ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <ArrowDown className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {selectedPost.is_pinned && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                          <Pin className="w-3 h-3 inline mr-1" />Pinned
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                        {selectedPost.category_name}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">{selectedPost.title}</h2>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {selectedPost.is_anonymous ? 'Anonymous' : selectedPost.author_name}
                        </span>
                        <span>{formatDate(selectedPost.created_at)}</span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {selectedPost.view_count}
                        </span>
                      </div>
                      {/* Edit/Delete buttons - only show for post owner */}
                      {currentUser?.id === selectedPost.author_id && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditPost({ title: selectedPost.title, content: selectedPost.content })
                              setEditingPost(selectedPost)
                            }}
                            className="p-2 text-slate-400 hover:text-primary-600 hover:bg-slate-100 rounded-lg"
                            title="Edit post"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('Are you sure you want to delete this post?')) {
                                deletePost.mutate(selectedPost.id)
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete post"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="prose prose-slate max-w-none">
                      <p className="whitespace-pre-wrap">{selectedPost.content}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Replies */}
              <div className="p-4">
                <h3 className="font-semibold text-slate-900 mb-4">
                  {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
                </h3>

                {!selectedPost.is_locked && (
                  <div className="mb-6">
                    <textarea
                      value={newReply}
                      onChange={e => setNewReply(e.target.value)}
                      placeholder="Write a reply..."
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg resize-none"
                      rows={3}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" className="rounded" />
                        Post anonymously
                      </label>
                      <button
                        onClick={() => createReply.mutate({
                          post_id: selectedPost.id,
                          content: newReply,
                          is_anonymous: false
                        })}
                        disabled={!newReply.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                        Reply
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {replies.map(reply => (
                    <div key={reply.id} className="flex gap-3 p-4 bg-slate-50 rounded-lg">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => vote.mutate({ type: 'reply', id: reply.id, direction: 'up' })}
                          className={`p-0.5 rounded ${reply.user_voted === 'up' ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-medium text-slate-700">{reply.upvotes}</span>
                        <button
                          onClick={() => vote.mutate({ type: 'reply', id: reply.id, direction: 'down' })}
                          className={`p-0.5 rounded ${reply.user_voted === 'down' ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">
                              {reply.is_anonymous ? 'Anonymous' : reply.author_name}
                            </span>
                            <span className="text-xs text-slate-500">{formatDate(reply.created_at)}</span>
                          </div>
                          {currentUser?.id === reply.author_id && (
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this reply?')) {
                                  deleteReply.mutate(reply.id)
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Delete reply"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap">{reply.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Posts List View */
            <div className="space-y-4">
              {posts.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                  <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No posts in this category yet</p>
                  <button
                    onClick={() => setShowNewPost(true)}
                    className="mt-4 text-primary-600 hover:underline"
                  >
                    Be the first to post!
                  </button>
                </div>
              ) : (
                posts.map(post => (
                  <div
                    key={post.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedPost(post)}
                  >
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            vote.mutate({ type: 'post', id: post.id, direction: 'up' })
                          }}
                          className={`p-1 rounded ${post.user_voted === 'up' ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-medium text-slate-700">{post.upvotes}</span>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            vote.mutate({ type: 'post', id: post.id, direction: 'down' })
                          }}
                          className={`p-1 rounded ${post.user_voted === 'down' ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {post.is_pinned && (
                            <Pin className="w-3 h-3 text-amber-500" />
                          )}
                          {post.is_locked && (
                            <Lock className="w-3 h-3 text-slate-400" />
                          )}
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                            {post.category_name}
                          </span>
                        </div>
                        <h3 className="font-semibold text-slate-900 mb-1 line-clamp-1">{post.title}</h3>
                        <p className="text-sm text-slate-600 line-clamp-2 mb-2">{post.content}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>{post.is_anonymous ? 'Anonymous' : post.author_name}</span>
                          <span>{formatDate(post.created_at)}</span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {post.reply_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {post.view_count}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Post Modal */}
      {showNewPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowNewPost(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">New Post</h2>
              <button onClick={() => setShowNewPost(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={newPost.category_id}
                  onChange={e => setNewPost({ ...newPost, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">Select a category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                  placeholder="What's on your mind?"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
                <textarea
                  value={newPost.content}
                  onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                  placeholder="Share your thoughts..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                  rows={5}
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newPost.is_anonymous}
                  onChange={e => setNewPost({ ...newPost, is_anonymous: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-slate-600">Post anonymously</span>
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowNewPost(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                  disabled={createPost.isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={() => createPost.mutate(newPost)}
                  disabled={!newPost.title.trim() || !newPost.category_id || createPost.isPending}
                  className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createPost.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    'Post'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Post Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setEditingPost(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Edit Post</h2>
              <button onClick={() => setEditingPost(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  value={editPost.title}
                  onChange={e => setEditPost({ ...editPost, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
                <textarea
                  value={editPost.content}
                  onChange={e => setEditPost({ ...editPost, content: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                  rows={5}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditingPost(null)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updatePost.mutate({ id: editingPost.id, ...editPost })}
                  disabled={!editPost.title.trim() || !editPost.content.trim()}
                  className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suggest Category Modal */}
      {showSuggestCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowSuggestCategory(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Suggest a Category</h2>
              <button onClick={() => setShowSuggestCategory(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Have an idea for a new discussion category? Submit your suggestion and an admin will review it.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category Name</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="e.g., Night Shift Nurses"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={newCategory.description}
                  onChange={e => setNewCategory({ ...newCategory, description: e.target.value })}
                  placeholder="What topics would this category cover?"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Icon</label>
                <select
                  value={newCategory.icon}
                  onChange={e => setNewCategory({ ...newCategory, icon: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {ICON_OPTIONS.map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowSuggestCategory(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => suggestCategory.mutate(newCategory)}
                  disabled={!newCategory.name.trim() || suggestCategory.isPending}
                  className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {suggestCategory.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Suggestion'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
