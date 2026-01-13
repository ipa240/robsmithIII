import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { isAdminUnlocked } from '../hooks/useSubscription'
import { api, setAuthToken } from '../api/client'
import {
  MessageSquare, Users, Plus, ThumbsUp, Eye, Clock,
  ChevronRight, Pin, Lock, User, Send, X, ArrowUp, ArrowDown,
  Edit2, Trash2, Lightbulb, Loader2, Sparkles
} from 'lucide-react'
import { SEO } from '../components/SEO'

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

  // Set auth token for API calls
  useEffect(() => {
    if (auth.user?.access_token) {
      setAuthToken(auth.user.access_token)
    }
  }, [auth.user?.access_token])
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [showNewPost, setShowNewPost] = useState(false)
  const [newPost, setNewPost] = useState({ title: '', content: '', is_anonymous: false, category_id: '' })
  const [newReply, setNewReply] = useState('')
  const [isReplyAnonymous, setIsReplyAnonymous] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [editPost, setEditPost] = useState({ title: '', content: '' })
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
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['community-posts'] })
      await queryClient.cancelQueries({ queryKey: ['community-categories'] })

      // Snapshot previous values
      const previousPosts = queryClient.getQueryData<Post[]>(['community-posts', selectedCategory])
      const previousCategories = queryClient.getQueryData<Category[]>(['community-categories'])

      // Find category info for optimistic update
      const selectedCat = categories.find(c => c.id === data.category_id)

      // Optimistically add new post
      const optimisticPost: Post = {
        id: `temp-${Date.now()}`,
        category_id: data.category_id,
        category_name: selectedCat?.name || '',
        author_name: currentUser?.display_name || 'You',
        author_id: currentUser?.id || '',
        title: data.title,
        content: data.content,
        is_anonymous: data.is_anonymous,
        is_pinned: false,
        is_locked: false,
        upvotes: 0,
        reply_count: 0,
        view_count: 0,
        created_at: new Date().toISOString(),
        user_voted: null
      }

      queryClient.setQueryData<Post[]>(['community-posts', selectedCategory], (old = []) => [optimisticPost, ...old])

      // Update category post count
      if (previousCategories) {
        queryClient.setQueryData<Category[]>(['community-categories'],
          previousCategories.map(c => c.id === data.category_id ? { ...c, post_count: c.post_count + 1 } : c)
        )
      }

      // Close modal immediately
      setShowNewPost(false)
      setNewPost({ title: '', content: '', is_anonymous: false, category_id: '' })

      return { previousPosts, previousCategories }
    },
    onError: (error: any, _variables, context) => {
      // Roll back on error
      if (context?.previousPosts) {
        queryClient.setQueryData(['community-posts', selectedCategory], context.previousPosts)
      }
      if (context?.previousCategories) {
        queryClient.setQueryData(['community-categories'], context.previousCategories)
      }
      console.error('Post creation error:', error)
      alert(error.response?.data?.detail || 'Failed to create post. Please try again.')
    },
    onSettled: () => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      queryClient.invalidateQueries({ queryKey: ['community-categories'] })
    }
  })

  const createReply = useMutation({
    mutationFn: (data: { post_id: string; content: string; is_anonymous: boolean; parent_reply_id?: string }) =>
      api.post(`/api/community/posts/${data.post_id}/replies`, data),
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['post-replies', data.post_id] })
      await queryClient.cancelQueries({ queryKey: ['community-posts'] })

      // Snapshot previous values
      const previousReplies = queryClient.getQueryData<Reply[]>(['post-replies', data.post_id])
      const previousPosts = queryClient.getQueryData<Post[]>(['community-posts', selectedCategory])

      // Optimistically add new reply
      const optimisticReply: Reply = {
        id: `temp-${Date.now()}`,
        post_id: data.post_id,
        author_name: data.is_anonymous ? 'Anonymous' : (currentUser?.display_name || 'You'),
        author_id: currentUser?.id || '',
        content: data.content,
        is_anonymous: data.is_anonymous,
        upvotes: 0,
        created_at: new Date().toISOString(),
        parent_reply_id: data.parent_reply_id || null,
        user_voted: null
      }

      queryClient.setQueryData<Reply[]>(['post-replies', data.post_id], (old = []) => [...old, optimisticReply])

      // Update reply count on the post
      if (previousPosts) {
        queryClient.setQueryData<Post[]>(['community-posts', selectedCategory],
          previousPosts.map(p => p.id === data.post_id ? { ...p, reply_count: p.reply_count + 1 } : p)
        )
      }

      // Also update selectedPost's reply_count if it matches
      if (selectedPost && selectedPost.id === data.post_id) {
        setSelectedPost({ ...selectedPost, reply_count: selectedPost.reply_count + 1 })
      }

      // Clear input immediately
      setNewReply('')
      setIsReplyAnonymous(false)

      return { previousReplies, previousPosts }
    },
    onError: (_error, data, context) => {
      // Roll back on error
      if (context?.previousReplies) {
        queryClient.setQueryData(['post-replies', data.post_id], context.previousReplies)
      }
      if (context?.previousPosts) {
        queryClient.setQueryData(['community-posts', selectedCategory], context.previousPosts)
      }
    },
    onSettled: (_data, _error, variables) => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: ['post-replies', variables.post_id] })
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
    }
  })

  const vote = useMutation({
    mutationFn: (data: { type: 'post' | 'reply'; id: string; direction: 'up' | 'down' }) =>
      api.post(`/api/community/${data.type}s/${data.id}/vote`, { direction: data.direction }),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['community-posts'] })
      await queryClient.cancelQueries({ queryKey: ['post-replies'] })

      const previousPosts = queryClient.getQueryData<Post[]>(['community-posts', selectedCategory])
      const previousReplies = selectedPost ? queryClient.getQueryData<Reply[]>(['post-replies', selectedPost.id]) : null

      if (data.type === 'post') {
        // Update posts list
        queryClient.setQueryData<Post[]>(['community-posts', selectedCategory], (old = []) =>
          old.map(p => {
            if (p.id !== data.id) return p
            const wasVoted = p.user_voted
            const newVote = wasVoted === data.direction ? null : data.direction
            let upvoteDelta = 0
            if (wasVoted === 'up' && newVote !== 'up') upvoteDelta--
            if (wasVoted === 'down' && newVote !== 'down') upvoteDelta++
            if (newVote === 'up' && wasVoted !== 'up') upvoteDelta++
            if (newVote === 'down' && wasVoted !== 'down') upvoteDelta--
            return { ...p, upvotes: p.upvotes + upvoteDelta, user_voted: newVote }
          })
        )
        // Also update selectedPost if it matches
        if (selectedPost && selectedPost.id === data.id) {
          const wasVoted = selectedPost.user_voted
          const newVote = wasVoted === data.direction ? null : data.direction
          let upvoteDelta = 0
          if (wasVoted === 'up' && newVote !== 'up') upvoteDelta--
          if (wasVoted === 'down' && newVote !== 'down') upvoteDelta++
          if (newVote === 'up' && wasVoted !== 'up') upvoteDelta++
          if (newVote === 'down' && wasVoted !== 'down') upvoteDelta--
          setSelectedPost({ ...selectedPost, upvotes: selectedPost.upvotes + upvoteDelta, user_voted: newVote })
        }
      } else {
        // Update replies
        queryClient.setQueryData<Reply[]>(['post-replies', selectedPost?.id], (old = []) =>
          old.map(r => {
            if (r.id !== data.id) return r
            const wasVoted = r.user_voted
            const newVote = wasVoted === data.direction ? null : data.direction
            let upvoteDelta = 0
            if (wasVoted === 'up' && newVote !== 'up') upvoteDelta--
            if (wasVoted === 'down' && newVote !== 'down') upvoteDelta++
            if (newVote === 'up' && wasVoted !== 'up') upvoteDelta++
            if (newVote === 'down' && wasVoted !== 'down') upvoteDelta--
            return { ...r, upvotes: r.upvotes + upvoteDelta, user_voted: newVote }
          })
        )
      }

      return { previousPosts, previousReplies }
    },
    onError: (_error, data, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(['community-posts', selectedCategory], context.previousPosts)
      }
      if (context?.previousReplies && selectedPost) {
        queryClient.setQueryData(['post-replies', selectedPost.id], context.previousReplies)
      }
    },
    onSettled: () => {
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
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['community-posts'] })
      const previousPosts = queryClient.getQueryData<Post[]>(['community-posts', selectedCategory])

      // Optimistically remove the post
      queryClient.setQueryData<Post[]>(['community-posts', selectedCategory], (old = []) =>
        old.filter(p => p.id !== id)
      )

      setSelectedPost(null)
      return { previousPosts }
    },
    onError: (_error, _id, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(['community-posts', selectedCategory], context.previousPosts)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      queryClient.invalidateQueries({ queryKey: ['community-categories'] })
    }
  })

  const deleteReply = useMutation({
    mutationFn: (id: string) => api.delete(`/api/community/replies/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['post-replies'] })
      const previousReplies = selectedPost ? queryClient.getQueryData<Reply[]>(['post-replies', selectedPost.id]) : null

      // Optimistically remove the reply
      if (selectedPost) {
        queryClient.setQueryData<Reply[]>(['post-replies', selectedPost.id], (old = []) =>
          old.filter(r => r.id !== id)
        )
        // Update reply count
        setSelectedPost({ ...selectedPost, reply_count: selectedPost.reply_count - 1 })
      }

      return { previousReplies }
    },
    onError: (_error, _id, context) => {
      if (context?.previousReplies && selectedPost) {
        queryClient.setQueryData(['post-replies', selectedPost.id], context.previousReplies)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['post-replies'] })
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
    }
  })

  const suggestCategory = useMutation({
    mutationFn: (data: typeof newCategory) => api.post('/api/community/categories/suggest', data),
    onSuccess: () => {
      setShowSuggestCategory(false)
      setNewCategory({ name: '', description: '', icon: 'MessageSquare' })
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
    <div className="space-y-4">
      <SEO
        title="Nurse Community"
        description="Connect with nurses across Virginia. Share experiences, ask questions, and get advice from fellow healthcare professionals in our community forums."
        canonical="https://vanurses.net/community"
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Community</h1>
          <p className="text-slate-600 text-sm">Connect with nurses across Virginia</p>
        </div>
        <button
          onClick={() => {
            const selectedCat = categories.find(c => c.slug === selectedCategory)
            setNewPost({
              title: '',
              content: '',
              is_anonymous: false,
              category_id: selectedCat?.id || ''
            })
            setShowNewPost(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Post
        </button>
      </div>

      <div className="flex gap-4">
        {/* Categories Sidebar - Narrower */}
        <div className="w-52 flex-shrink-0 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Categories</h3>
              <button
                onClick={() => setShowSuggestCategory(true)}
                className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                title="Suggest a category"
              >
                <Lightbulb className="w-3.5 h-3.5" />
              </button>
            </div>
            {categoriesLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="space-y-0.5">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm ${
                    selectedCategory === null ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  All Discussions
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.slug)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm flex justify-between ${
                      selectedCategory === cat.slug ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="text-slate-400 text-xs">{cat.post_count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Trending - Compact */}
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <h3 className="font-semibold text-slate-900 text-sm mb-2">Trending</h3>
            <div className="space-y-2">
              {trending.slice(0, 4).map((post, i) => (
                <button
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="w-full text-left group"
                >
                  <div className="flex gap-1.5">
                    <span className="text-slate-400 text-xs font-medium">{i + 1}.</span>
                    <p className="text-xs text-slate-600 group-hover:text-primary-600 line-clamp-2 leading-tight">
                      {post.title}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Guidelines - Very Compact */}
          <div className="bg-slate-50 rounded-xl p-3">
            <h3 className="font-semibold text-slate-900 text-xs mb-1.5">Guidelines</h3>
            <ul className="text-xs text-slate-500 space-y-0.5">
              <li>- Be respectful</li>
              <li>- No HIPAA violations</li>
              <li>- No spam</li>
            </ul>
          </div>
        </div>

        {/* Posts List */}
        <div className="flex-1 space-y-2">
          {posts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No posts in this category yet</p>
              <button
                onClick={() => setShowNewPost(true)}
                className="mt-3 text-primary-600 hover:underline text-sm"
              >
                Be the first to post!
              </button>
            </div>
          ) : (
            posts.map(post => (
              <div
                key={post.id}
                className={`bg-white rounded-xl border p-3 hover:shadow-md transition-all cursor-pointer ${
                  selectedPost?.id === post.id ? 'border-primary-300 shadow-md' : 'border-slate-200 hover:border-primary-200'
                }`}
                onClick={() => setSelectedPost(post)}
              >
                <div className="flex items-start gap-3">
                  {/* Compact inline voting */}
                  <div className="flex items-center gap-0.5 bg-slate-50 rounded-lg px-1.5 py-1">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        vote.mutate({ type: 'post', id: post.id, direction: 'up' })
                      }}
                      className={`p-0.5 rounded ${post.user_voted === 'up' ? 'text-primary-600' : 'text-slate-400 hover:text-primary-600'}`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-semibold min-w-[20px] text-center text-slate-700">{post.upvotes}</span>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        vote.mutate({ type: 'post', id: post.id, direction: 'down' })
                      }}
                      className={`p-0.5 rounded ${post.user_voted === 'down' ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title with badges */}
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {post.is_pinned && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium flex items-center gap-0.5">
                          <Pin className="w-2.5 h-2.5" />
                        </span>
                      )}
                      {post.is_locked && (
                        <Lock className="w-3 h-3 text-slate-400" />
                      )}
                      <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">
                        {post.category_name}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-900 line-clamp-1 text-sm">{post.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{post.content}</p>

                    {/* Compact metadata row */}
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                      <span>{post.is_anonymous ? 'Anonymous' : post.author_name}</span>
                      <span>-</span>
                      <span>{formatDate(post.created_at)}</span>
                      <span className="flex items-center gap-0.5">
                        <MessageSquare className="w-3 h-3" />
                        {post.reply_count}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Eye className="w-3 h-3" />
                        {post.view_count}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Slide-out Post Panel */}
      {selectedPost && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setSelectedPost(null)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <button
                onClick={() => setSelectedPost(null)}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm"
              >
                <X className="w-4 h-4" />
                Close
              </button>
              <div className="flex items-center gap-2">
                {selectedPost.is_pinned && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium flex items-center gap-1">
                    <Pin className="w-3 h-3" /> Pinned
                  </span>
                )}
                <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">
                  {selectedPost.category_name}
                </span>
              </div>
            </div>

            {/* Scrollable Content - Chat-like layout */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              {/* Post Content - Fixed at top */}
              <div className="p-4 border-b border-slate-100 bg-white">
                <div className="flex items-start gap-3 mb-3">
                  {/* Voting */}
                  <div className="flex flex-col items-center gap-0.5 bg-slate-50 rounded-lg px-2 py-1">
                    <button
                      onClick={() => vote.mutate({ type: 'post', id: selectedPost.id, direction: 'up' })}
                      className={`p-1 rounded ${selectedPost.user_voted === 'up' ? 'text-primary-600' : 'text-slate-400 hover:text-primary-600'}`}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-semibold text-slate-700">{selectedPost.upvotes}</span>
                    <button
                      onClick={() => vote.mutate({ type: 'post', id: selectedPost.id, direction: 'down' })}
                      className={`p-1 rounded ${selectedPost.user_voted === 'down' ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-slate-900 mb-1">{selectedPost.title}</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {selectedPost.is_anonymous ? 'Anonymous' : selectedPost.author_name}
                      </span>
                      <span>-</span>
                      <span>{formatDate(selectedPost.created_at)}</span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {selectedPost.view_count}
                      </span>
                    </div>
                  </div>

                  {/* Edit/Delete for owner */}
                  {currentUser?.id === selectedPost.author_id && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditPost({ title: selectedPost.title, content: selectedPost.content })
                          setEditingPost(selectedPost)
                        }}
                        className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-slate-100 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this post?')) {
                            deletePost.mutate(selectedPost.id)
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{selectedPost.content}</p>
              </div>

              {/* Replies - Chat message style (newest at bottom) */}
              <div className="flex-1 p-4 bg-gradient-to-b from-slate-50 to-white">
                <h4 className="font-semibold text-slate-900 text-sm mb-3">
                  {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
                </h4>

                {replies.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-6">No replies yet. Be the first!</p>
                ) : (
                  <div className="space-y-2">
                    {replies.map(reply => (
                      <div key={reply.id} className="flex gap-2 p-3 bg-white rounded-lg shadow-sm border border-slate-100">
                        {/* Reply voting */}
                        <div className="flex flex-col items-center gap-0">
                          <button
                            onClick={() => vote.mutate({ type: 'reply', id: reply.id, direction: 'up' })}
                            className={`p-0.5 rounded ${reply.user_voted === 'up' ? 'text-primary-600' : 'text-slate-400 hover:text-primary-600'}`}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-medium text-slate-600">{reply.upvotes}</span>
                          <button
                            onClick={() => vote.mutate({ type: 'reply', id: reply.id, direction: 'down' })}
                            className={`p-0.5 rounded ${reply.user_voted === 'down' ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 text-sm">
                                {reply.is_anonymous ? 'Anonymous' : reply.author_name}
                              </span>
                              <span className="text-xs text-slate-400">{formatDate(reply.created_at)}</span>
                            </div>
                            {currentUser?.id === reply.author_id && (
                              <button
                                onClick={() => {
                                  if (confirm('Delete this reply?')) {
                                    deleteReply.mutate(reply.id)
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-slate-700 text-sm whitespace-pre-wrap">{reply.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Reply Input - Fixed at BOTTOM like text messages */}
            {!selectedPost.is_locked && (
              <div className="p-3 bg-white border-t border-slate-200">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <textarea
                      value={newReply}
                      onChange={e => setNewReply(e.target.value)}
                      placeholder="Write a reply..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      rows={2}
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-500 mt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 w-3 h-3"
                        checked={isReplyAnonymous}
                        onChange={(e) => setIsReplyAnonymous(e.target.checked)}
                      />
                      Anonymous
                    </label>
                  </div>
                  <button
                    onClick={() => createReply.mutate({
                      post_id: selectedPost.id,
                      content: newReply,
                      is_anonymous: isReplyAnonymous
                    })}
                    disabled={!newReply.trim() || createReply.isPending}
                    className="flex items-center justify-center w-10 h-10 bg-primary-600 text-white rounded-full hover:bg-primary-700 disabled:opacity-50 flex-shrink-0"
                  >
                    {createReply.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
                <textarea
                  value={newPost.content}
                  onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                  placeholder="Share your thoughts..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none text-sm"
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
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium"
                  disabled={createPost.isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={() => createPost.mutate(newPost)}
                  disabled={!newPost.title.trim() || !newPost.category_id || createPost.isPending}
                  className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
                <textarea
                  value={editPost.content}
                  onChange={e => setEditPost({ ...editPost, content: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none text-sm"
                  rows={5}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditingPost(null)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updatePost.mutate({ id: editingPost.id, ...editPost })}
                  disabled={!editPost.title.trim() || !editPost.content.trim()}
                  className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={newCategory.description}
                  onChange={e => setNewCategory({ ...newCategory, description: e.target.value })}
                  placeholder="What topics would this category cover?"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none text-sm"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Icon</label>
                <select
                  value={newCategory.icon}
                  onChange={e => setNewCategory({ ...newCategory, icon: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {ICON_OPTIONS.map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowSuggestCategory(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => suggestCategory.mutate(newCategory)}
                  disabled={!newCategory.name.trim() || suggestCategory.isPending}
                  className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
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

      {/* CSS for slide-in animation */}
      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
