import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Sparkles, Info, Zap, Lock, Unlock, Key, LogIn, Database, Globe } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { isAdminUnlocked } from '../hooks/useSubscription'
import { api } from '../api/client'

type Mood = 'optimistic' | 'neutral' | 'stern' | 'nofilter'
type SearchMode = 'internal' | 'hybrid' | 'web'

// NoFilter unlock code
const NOFILTER_UNLOCK_CODE = 'sullynofilter!'
const NOFILTER_STORAGE_KEY = 'sully_nofilter_unlocked'

interface Message {
  role: 'user' | 'sully'
  content: string
  mood?: Mood
  searchMode?: SearchMode
  dataSources?: string[]
  timestamp: Date
}

const SEARCH_MODES: { id: SearchMode; label: string; icon: typeof Database; desc: string; recommended?: boolean }[] = [
  { id: 'internal', label: 'Database', icon: Database, desc: 'VANurses data only', recommended: true },
  { id: 'hybrid', label: 'Hybrid', icon: Zap, desc: 'Database + Web search' },
  { id: 'web', label: 'Web', icon: Globe, desc: 'Internet search only' },
]

const MOODS: { id: Mood; label: string; color: string; bgColor: string; desc: string; image: string; locked?: boolean }[] = [
  { id: 'optimistic', label: 'Friendly', color: 'text-emerald-600', bgColor: 'bg-emerald-500', desc: 'Encouraging, uses emojis', image: '/media/sully/sully-optimistic.jpg' },
  { id: 'neutral', label: 'Neutral', color: 'text-sky-600', bgColor: 'bg-sky-500', desc: 'Professional & balanced', image: '/media/sully/sully-neutral.jpg' },
  { id: 'stern', label: 'Stern', color: 'text-amber-600', bgColor: 'bg-amber-500', desc: 'Blunt, no-BS', image: '/media/sully/sully-stern.jpg' },
  { id: 'nofilter', label: 'No Filter', color: 'text-red-600', bgColor: 'bg-red-500', desc: 'Burned-out nurse energy', image: '/media/sully/sully-nofilter.jpg', locked: true },
]

const QUICK_PROMPTS = [
  { icon: Sparkles, text: "What are the best-rated hospitals in Richmond?", category: "facilities" },
  { icon: Zap, text: "Are there any ICU jobs with good pay?", category: "jobs" },
  { icon: Info, text: "How is the job market for travel nurses in Virginia?", category: "general" },
  { icon: Sparkles, text: "Which facilities have the worst reviews?", category: "facilities" },
  { icon: Zap, text: "What's the average pay for RNs in Northern Virginia?", category: "pay" },
  { icon: Info, text: "Tell me about patient safety ratings in Hampton Roads", category: "facilities" },
]

export default function Sully() {
  const auth = useAuth()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'sully',
      content: "Hey there! I'm Sully, your AI nursing career assistant. I know all about Virginia's hospitals, their scores, job openings, and pay rates. Ask me anything - I'll give you the real scoop!",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [mood, setMood] = useState<Mood>('neutral')
  const [searchMode, setSearchMode] = useState<SearchMode>('internal')
  const [showVideo, setShowVideo] = useState(true)
  const [nofilterUnlocked, setNofilterUnlocked] = useState(() => {
    return localStorage.getItem(NOFILTER_STORAGE_KEY) === 'true'
  })
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [unlockCode, setUnlockCode] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const handleUnlockSubmit = () => {
    if (unlockCode === NOFILTER_UNLOCK_CODE) {
      localStorage.setItem(NOFILTER_STORAGE_KEY, 'true')
      setNofilterUnlocked(true)
      setShowUnlockModal(false)
      setUnlockCode('')
      setUnlockError('')
      setMood('nofilter')
    } else {
      setUnlockError('Invalid code. Contact us for access.')
    }
  }

  const handleLockNofilter = () => {
    localStorage.removeItem(NOFILTER_STORAGE_KEY)
    setNofilterUnlocked(false)
    if (mood === 'nofilter') {
      setMood('neutral')
    }
  }

  const handleMoodClick = (m: typeof MOODS[0]) => {
    if (m.locked && !nofilterUnlocked) {
      setShowUnlockModal(true)
    } else {
      setMood(m.id)
    }
  }

  const scrollToBottom = () => {
    // Scroll within the messages container only, not the page
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Check Sully status
  const { data: status } = useQuery({
    queryKey: ['sully-status'],
    queryFn: () => api.get('/api/sully/status').then(res => res.data),
    refetchInterval: 30000
  })

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      api.post('/api/sully/chat', { message, mood, search_mode: searchMode }).then(res => res.data),
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: 'sully',
        content: data.response,
        mood: data.mood,
        searchMode: data.search_mode,
        dataSources: data.data_sources,
        timestamp: new Date()
      }])
    },
    onError: () => {
      setMessages(prev => [...prev, {
        role: 'sully',
        content: "Damn, something went wrong on my end. Give me a sec and try again!",
        timestamp: new Date()
      }])
    }
  })

  const handleSend = (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || chatMutation.isPending) return

    setMessages(prev => [...prev, {
      role: 'user',
      content: messageText,
      timestamp: new Date()
    }])
    chatMutation.mutate(messageText)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const currentMood = MOODS.find(m => m.id === mood)

  // Require login
  if (!auth.isAuthenticated && !isAdminUnlocked()) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12">
          <img
            src="/media/sully/sully-neutral.jpg"
            alt="Sully"
            className="w-32 h-32 mx-auto mb-6 rounded-full object-cover shadow-lg"
          />
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Meet Sully</h1>
          <p className="text-lg text-slate-600 mb-8">
            Your AI nursing career assistant. Get personalized advice about jobs, facilities,
            salaries, and more. Sign in to start chatting!
          </p>
          <button
            onClick={() => auth.signinRedirect()}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            <LogIn className="w-5 h-5" />
            Sign In to Chat with Sully
          </button>
          <p className="text-sm text-slate-400 mt-4">
            Free account required
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Unlock Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Lock className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">No Filter Mode</h3>
                <p className="text-sm text-slate-500">Enter code to unlock</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Nursing is stressful. Sometimes you need real talk, not corporate fluff.
              No Filter Sully is that burned-out nurse every unit has - the one who tells it like it is.
              <span className="block mt-2 font-medium text-red-600">Have a laugh while getting honest answers.</span>
              <span className="block mt-2 text-xs text-slate-500">
                <a href="/support" className="text-red-500 hover:text-red-600 underline">Message us</a> to get an unlock code.
              </span>
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={unlockCode}
                onChange={(e) => { setUnlockCode(e.target.value); setUnlockError('') }}
                placeholder="Enter unlock code..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleUnlockSubmit()}
                autoFocus
              />
              {unlockError && (
                <p className="text-sm text-red-500">{unlockError}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowUnlockModal(false); setUnlockCode(''); setUnlockError('') }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnlockSubmit}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
                >
                  Unlock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-24 h-24">
            {/* Video intro plays first, then shows static image */}
            {showVideo ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                onEnded={() => setShowVideo(false)}
                className="w-24 h-24 object-cover rounded-full"
                src="/media/sully/sully-hi-alpha.webm"
              />
            ) : (
              <img
                src={currentMood?.image || '/media/sully/sully-neutral.jpg'}
                alt="Sully"
                className="w-24 h-24 object-cover rounded-full shadow-lg transition-all duration-300"
              />
            )}
            {/* Online indicator */}
            <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white ${status?.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Chat with Sully</h1>
            <p className="text-slate-500">Your AI nursing career assistant</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-400">
                {status?.status === 'online' ? 'Online & ready to help' : 'Currently offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Mood Selector */}
        <div className="flex flex-wrap gap-3">
          {MOODS.map((m) => {
            const isLocked = m.locked && !nofilterUnlocked
            return (
              <button
                key={m.id}
                onClick={() => handleMoodClick(m)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  mood === m.id
                    ? `${m.bgColor} text-white shadow-md ring-2 ring-offset-2`
                    : isLocked
                      ? 'bg-slate-200 text-slate-400 cursor-pointer'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <div className="relative">
                  <img
                    src={m.image}
                    alt={m.label}
                    className={`w-8 h-8 rounded-full object-cover ${isLocked ? 'opacity-50 grayscale' : ''}`}
                  />
                  {isLocked && (
                    <Lock className="absolute -bottom-1 -right-1 w-4 h-4 text-slate-500 bg-white rounded-full p-0.5" />
                  )}
                </div>
                <div className="text-left">
                  <span className="block flex items-center gap-1">
                    {m.label}
                    {isLocked && <Lock className="w-3 h-3" />}
                  </span>
                  {mood === m.id && <span className="text-xs opacity-75">{m.desc}</span>}
                </div>
              </button>
            )
          })}
        </div>

        {/* Search Mode Selector */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className="text-xs sm:text-sm text-slate-500 font-medium whitespace-nowrap">Data Source:</span>
          {SEARCH_MODES.map((mode) => {
            const Icon = mode.icon
            return (
              <button
                key={mode.id}
                onClick={() => setSearchMode(mode.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  searchMode === mode.id
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
                title={mode.desc}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="whitespace-nowrap">{mode.label}</span>
                {mode.recommended && searchMode !== mode.id && (
                  <span className="text-[9px] sm:text-[10px] text-emerald-600 font-bold hidden sm:inline">Rec</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Chat Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat Messages */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[600px]">
          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="flex items-start gap-3 max-w-[85%]">
                  {msg.role === 'sully' && (
                    <img
                      src={msg.mood ? MOODS.find(m => m.id === msg.mood)?.image : currentMood?.image || '/media/sully/sully-neutral.jpg'}
                      alt="Sully"
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                  )}
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-primary-500 text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.dataSources && msg.dataSources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <p className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Database className="w-3 h-3" />
                          Sources: {msg.dataSources.join(', ')}
                        </p>
                      </div>
                    )}
                    <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-primary-200' : 'text-slate-400'}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="flex items-start gap-3">
                  <img
                    src={currentMood?.image || '/media/sully/sully-neutral.jpg'}
                    alt="Sully"
                    className="w-8 h-8 rounded-full object-cover animate-pulse"
                  />
                  <div className="bg-slate-100 rounded-2xl px-4 py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-100">
            <div className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Sully anything about nursing jobs in Virginia..."
                rows={2}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || chatMutation.isPending}
                className="p-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Current mood: <span className={currentMood?.color}>{currentMood?.label}</span> |
              Source: <span className="text-primary-600">{SEARCH_MODES.find(m => m.id === searchMode)?.label}</span> - Press Enter to send
            </p>
            {/* No Filter Disclaimer */}
            {mood === 'nofilter' && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-600">
                  <strong>Disclaimer:</strong> No Filter mode uses adult language and dark humor. Responses are for entertainment and stress relief only - not professional medical or career advice. If you're struggling, please reach out to a real person.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Quick Prompts */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Quick Questions</h3>
            <div className="space-y-2">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt.text)}
                  disabled={chatMutation.isPending}
                  className="w-full text-left p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-sm text-slate-700 disabled:opacity-50"
                >
                  <prompt.icon className="w-4 h-4 inline mr-2 text-primary-500" />
                  {prompt.text}
                </button>
              ))}
            </div>
          </div>

          {/* Mood Info */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-4 border border-purple-100">
            <h3 className="font-semibold text-slate-900 mb-2">About Sully's Moods</h3>
            <div className="space-y-2 text-sm text-slate-600">
              <p><span className="text-emerald-600 font-medium">Friendly</span> - Encouraging, uses emojis, finds the silver lining</p>
              <p><span className="text-sky-600 font-medium">Neutral</span> - Professional, balanced, presents pros and cons</p>
              <p><span className="text-amber-600 font-medium">Stern</span> - Blunt, no-BS, tells it like it is</p>
              <p className="flex items-center gap-1">
                <span className="text-red-600 font-medium">No Filter</span>
                {nofilterUnlocked ? (
                  <button
                    onClick={handleLockNofilter}
                    className="text-xs text-emerald-500 hover:text-red-500 flex items-center gap-0.5 transition-colors"
                    title="Click to lock"
                  >
                    <Unlock className="w-3 h-3" /> Unlocked (click to lock)
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 flex items-center gap-0.5"><Lock className="w-3 h-3" /> Locked</span>
                )}
              </p>
              {nofilterUnlocked ? (
                <p className="text-red-600/80 text-xs pl-2">That nurse every unit has - brutally honest</p>
              ) : (
                <p className="text-slate-400 text-xs pl-2 italic">Every unit has one... get your code to unlock</p>
              )}
            </div>

            {/* Unlock Code Input OR Re-lock Button */}
            {nofilterUnlocked ? (
              <div className="mt-4 pt-3 border-t border-purple-200">
                <button
                  onClick={handleLockNofilter}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors font-medium text-sm"
                >
                  <Lock className="w-4 h-4" />
                  Re-lock No Filter Mode
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-2">
                  Click to lock and hide No Filter mode
                </p>
              </div>
            ) : (
              <div className="mt-4 pt-3 border-t border-purple-200">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  <Key className="w-3 h-3 inline mr-1" />
                  Have an unlock code?
                </label>
                <p className="text-[10px] text-slate-500 mb-2">
                  <a href="/support" className="text-red-500 hover:text-red-600 underline">Message us</a> to get an unlock code for burned-out nurse energy.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={unlockCode}
                    onChange={(e) => { setUnlockCode(e.target.value); setUnlockError('') }}
                    placeholder="Enter code..."
                    className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    onKeyDown={(e) => e.key === 'Enter' && handleUnlockSubmit()}
                  />
                  <button
                    onClick={handleUnlockSubmit}
                    className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Unlock
                  </button>
                </div>
                {unlockError && (
                  <p className="text-xs text-red-500 mt-1">{unlockError}</p>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 mb-2">Sully Knows</h3>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>All Virginia hospital scores</li>
              <li>Real-time job openings</li>
              <li>Pay rates & trends</li>
              <li>Facility reviews & ratings</li>
              <li>Regional job markets</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
