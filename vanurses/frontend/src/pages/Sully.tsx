import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Sparkles, Info, Zap } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

type Mood = 'optimistic' | 'neutral' | 'stern'

interface Message {
  role: 'user' | 'sully'
  content: string
  mood?: Mood
  timestamp: Date
}

const MOODS: { id: Mood; label: string; color: string; bgColor: string; desc: string; image: string }[] = [
  { id: 'optimistic', label: 'Friendly', color: 'text-emerald-600', bgColor: 'bg-emerald-500', desc: 'Warm & encouraging', image: '/media/sully/sully-optimistic.jpg' },
  { id: 'neutral', label: 'Neutral', color: 'text-sky-600', bgColor: 'bg-sky-500', desc: 'Professional & balanced', image: '/media/sully/sully-neutral.jpg' },
  { id: 'stern', label: 'Stern', color: 'text-amber-600', bgColor: 'bg-amber-500', desc: 'Blunt & direct', image: '/media/sully/sully-stern.jpg' },
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
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'sully',
      content: "Hey there! I'm Sully, your AI nursing career assistant. I know all about Virginia's hospitals, their scores, job openings, and pay rates. Ask me anything - I'll give you the real scoop!",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [mood, setMood] = useState<Mood>('neutral')
  const [showVideo, setShowVideo] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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
      api.post('/api/sully/chat', { message, mood }).then(res => res.data),
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: 'sully',
        content: data.response,
        mood: data.mood,
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

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-20 h-20">
            {/* Video intro plays first, then shows static image */}
            {showVideo ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                onEnded={() => setShowVideo(false)}
                className="w-20 h-20 object-cover rounded-full"
                src="/media/sully/sully-hi-alpha.webm"
              />
            ) : (
              <img
                src={currentMood?.image || '/media/sully/sully-neutral.jpg'}
                alt="Sully"
                className="w-20 h-20 object-cover rounded-full shadow-lg transition-all duration-300"
              />
            )}
            {/* Online indicator */}
            <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white ${status?.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
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
          {MOODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMood(m.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                mood === m.id
                  ? `${m.bgColor} text-white shadow-md ring-2 ring-offset-2 ring-${m.bgColor.replace('bg-', '')}`
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <img src={m.image} alt={m.label} className="w-8 h-8 rounded-full object-cover" />
              <div className="text-left">
                <span className="block">{m.label}</span>
                {mood === m.id && <span className="text-xs opacity-75">{m.desc}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat Messages */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[600px]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
              Current mood: <span className={currentMood?.color}>{currentMood?.label}</span> - Press Enter to send
            </p>
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
              <p><span className="text-red-600 font-medium">No Filter</span> - Vulgar, burned-out nurse energy, brutally honest</p>
            </div>
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
