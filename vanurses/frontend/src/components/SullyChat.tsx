import { useState, useRef, useEffect } from 'react'
import { Send, X, Loader2, Database, Globe, Zap, Lock, Key, Unlock } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../api/client'

type Mood = 'optimistic' | 'neutral' | 'stern' | 'nofilter'

// NoFilter unlock code - shared with Sully.tsx
const NOFILTER_UNLOCK_CODE = 'sullynofilter!'
const NOFILTER_STORAGE_KEY = 'sully_nofilter_unlocked'
type SearchMode = 'internal' | 'hybrid' | 'web'

interface Message {
  role: 'user' | 'sully'
  content: string
  mood?: Mood
  searchMode?: SearchMode
  dataSources?: string[]
}

interface SullyChatProps {
  onClose: () => void
  isOpen: boolean
}

const MOODS: { id: Mood; label: string; color: string; desc: string; image: string; locked?: boolean }[] = [
  { id: 'optimistic', label: 'Friendly', color: 'bg-emerald-500', desc: 'Encouraging, uses emojis', image: '/media/sully/sully-optimistic.jpg' },
  { id: 'neutral', label: 'Neutral', color: 'bg-sky-500', desc: 'Professional & balanced', image: '/media/sully/sully-neutral.jpg' },
  { id: 'stern', label: 'Stern', color: 'bg-amber-500', desc: 'Blunt, no-BS', image: '/media/sully/sully-stern.jpg' },
  { id: 'nofilter', label: 'No Filter', color: 'bg-red-500', desc: 'Burned-out nurse energy', image: '/media/sully/sully-nofilter.jpg', locked: true },
]

const SEARCH_MODES: { id: SearchMode; label: string; icon: typeof Database; desc: string; recommended?: boolean }[] = [
  { id: 'internal', label: 'Database', icon: Database, desc: 'VANurses data only', recommended: true },
  { id: 'hybrid', label: 'Hybrid', icon: Zap, desc: 'Database + Web' },
  { id: 'web', label: 'Web', icon: Globe, desc: 'Web search only' },
]

export default function SullyChat({ onClose, isOpen }: SullyChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'sully', content: "Hey! I'm Sully, your AI nursing career assistant. Ask me anything about jobs, facilities, or your nursing career in Virginia! I have access to real-time data on facilities, scores, and job listings." }
  ])
  const [input, setInput] = useState('')
  const [mood, setMood] = useState<Mood>('neutral')
  const [searchMode, setSearchMode] = useState<SearchMode>('internal')
  const [nofilterUnlocked, setNofilterUnlocked] = useState(() => {
    return localStorage.getItem(NOFILTER_STORAGE_KEY) === 'true'
  })
  const [showUnlockInput, setShowUnlockInput] = useState(false)
  const [unlockCode, setUnlockCode] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleUnlockSubmit = () => {
    if (unlockCode === NOFILTER_UNLOCK_CODE) {
      localStorage.setItem(NOFILTER_STORAGE_KEY, 'true')
      setNofilterUnlocked(true)
      setShowUnlockInput(false)
      setUnlockCode('')
      setUnlockError('')
      setMood('nofilter')
    } else {
      setUnlockError('Invalid code')
    }
  }

  const handleMoodClick = (m: typeof MOODS[0]) => {
    if (m.locked && !nofilterUnlocked) {
      setShowUnlockInput(true)
    } else {
      setMood(m.id)
      setShowUnlockInput(false)
    }
  }

  const handleLockNofilter = () => {
    localStorage.removeItem(NOFILTER_STORAGE_KEY)
    setNofilterUnlocked(false)
    if (mood === 'nofilter') {
      setMood('neutral')
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      api.post('/api/sully/chat', { message, mood, search_mode: searchMode }).then(res => res.data),
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: 'sully',
        content: data.response,
        mood: data.mood,
        searchMode: data.search_mode,
        dataSources: data.data_sources
      }])
    },
    onError: () => {
      setMessages(prev => [...prev, { role: 'sully', content: "Sorry, I'm having trouble right now. Try again in a moment!" }])
    }
  })

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return

    setMessages(prev => [...prev, { role: 'user', content: input }])
    chatMutation.mutate(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 max-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <img
            src={MOODS.find(m => m.id === mood)?.image || '/media/sully/sully-neutral.jpg'}
            alt="Sully"
            className="w-10 h-10 rounded-full object-cover"
          />
          <div>
            <h3 className="font-semibold text-slate-900">Sully</h3>
            <p className="text-xs text-slate-500">{MOODS.find(m => m.id === mood)?.desc || 'AI Career Assistant'}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* Mood Selector */}
      <div className="flex gap-2 p-3 border-b border-slate-100 overflow-x-auto">
        {MOODS.map((m) => {
          const isLocked = m.locked && !nofilterUnlocked
          return (
            <button
              key={m.id}
              onClick={() => handleMoodClick(m)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                mood === m.id
                  ? `${m.color} text-white`
                  : isLocked
                    ? 'bg-slate-200 text-slate-400'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title={isLocked ? 'Locked - enter code to unlock' : m.desc}
            >
              {m.label}
              {isLocked && <Lock className="w-3 h-3" />}
            </button>
          )
        })}
      </div>

      {/* Unlock Code Input (shows when clicking locked NoFilter) */}
      {showUnlockInput && (
        <div className="px-3 py-2 border-b border-slate-100 bg-red-50">
          <div className="flex items-center gap-2 mb-1.5">
            <Key className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-medium text-slate-700">Every unit has one...</span>
            <button onClick={() => setShowUnlockInput(false)} className="ml-auto text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mb-2">
            <a href="/support" className="text-red-500 hover:text-red-600 underline">Message us</a> to get an unlock code for burned-out nurse energy.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={unlockCode}
              onChange={(e) => { setUnlockCode(e.target.value); setUnlockError('') }}
              placeholder="Enter code..."
              className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleUnlockSubmit()}
              autoFocus
            />
            <button
              onClick={handleUnlockSubmit}
              className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600"
            >
              Unlock
            </button>
          </div>
          {unlockError && <p className="text-xs text-red-500 mt-1">{unlockError}</p>}
        </div>
      )}

      {/* Search Mode Selector */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
        <span className="text-xs text-slate-500 font-medium">Search:</span>
        {SEARCH_MODES.map((mode) => {
          const Icon = mode.icon
          return (
            <button
              key={mode.id}
              onClick={() => setSearchMode(mode.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                searchMode === mode.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
              title={mode.desc}
            >
              <Icon className="w-3 h-3" />
              {mode.label}
              {mode.recommended && searchMode !== mode.id && (
                <span className="ml-0.5 text-[10px] text-emerald-600">✓</span>
              )}
            </button>
          )
        })}
      </div>

      {/* No Filter Disclaimer & Lock Option */}
      {mood === 'nofilter' && (
        <div className="px-3 py-2 border-b border-slate-100 bg-red-50">
          <p className="text-[10px] text-red-600 mb-2">
            <strong>Disclaimer:</strong> No Filter mode uses adult language and dark humor. For entertainment only - not professional advice.
          </p>
          <button
            onClick={handleLockNofilter}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-200 text-red-700 text-xs font-medium rounded-lg hover:bg-red-300 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            Re-lock No Filter Mode
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
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
            </div>
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl px-4 py-2.5">
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Sully anything..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            className="p-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
