import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  HelpCircle, MessageSquare, Send, ChevronDown, ChevronUp,
  Mail, Clock, CheckCircle, AlertCircle, ExternalLink, Key, Lock, Unlock
} from 'lucide-react'
import { api } from '../api/client'
import { unlockAdmin, lockAdmin, isAdminUnlocked } from '../hooks/useSubscription'

interface FAQ {
  question: string
  answer: string
  category: string
}

interface Ticket {
  id: string
  subject: string
  status: string
  created_at: string
  last_reply_at: string | null
}

const faqs: FAQ[] = [
  {
    category: 'Getting Started',
    question: 'How do I create an account?',
    answer: 'Click "Sign In" on the homepage to create your account through our secure authentication system. You\'ll get a 3-day free trial of all premium features!'
  },
  {
    category: 'Getting Started',
    question: 'What is the OFS score?',
    answer: 'The Overall Facility Score (OFS) is our proprietary 10-index rating system that evaluates nursing workplaces across pay, safety, work environment, patient care, and more. Scores range from 0-100 with letter grades A+ through F.'
  },
  {
    category: 'Subscriptions',
    question: 'What\'s included in each subscription tier?',
    answer: 'Starter ($9/mo) includes full scoring data and 5 Sully questions daily. Pro ($19/mo) adds unlimited Sully (except NoFilter), facility comparisons, and alerts. Premium ($30/mo) includes all features plus NoFilter mode and PDF exports.'
  },
  {
    category: 'Subscriptions',
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes! You can cancel your subscription at any time from the Billing page. Your access continues until the end of your current billing period.'
  },
  {
    category: 'Sully AI',
    question: 'What can Sully help me with?',
    answer: 'Sully is our AI nursing assistant that can answer questions about facilities, jobs, career advice, and more. She has access to real-time job data and facility scores to give you accurate, personalized recommendations.'
  },
  {
    category: 'Sully AI',
    question: 'What are Sully\'s mood modes?',
    answer: 'Sully has 4 moods: Optimistic (encouraging and friendly), Neutral (professional and factual), Stern (blunt and direct), and NoFilter (brutally honest - Premium only).'
  },
  {
    category: 'Jobs',
    question: 'How often are jobs updated?',
    answer: 'Our job scraper runs daily to fetch new postings from healthcare job boards across Virginia. Jobs are verified and scored within 24 hours of posting.'
  },
  {
    category: 'Jobs',
    question: 'How do I save jobs to apply later?',
    answer: 'Click the bookmark icon on any job listing to save it. Access all your saved jobs from the "Saved" page in the navigation.'
  }
]

export default function Support() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [contactForm, setContactForm] = useState({
    subject: '',
    message: '',
    category: 'general'
  })
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [adminCode, setAdminCode] = useState('')
  const [adminError, setAdminError] = useState('')
  const [adminUnlocked] = useState(() => isAdminUnlocked())

  const { data: tickets } = useQuery<Ticket[]>({
    queryKey: ['support-tickets'],
    queryFn: () => api.get('/api/support/tickets').then(res => res.data.tickets)
  })

  const submitTicket = useMutation({
    mutationFn: (data: typeof contactForm) =>
      api.post('/api/support/tickets', data).then(res => res.data),
    onSuccess: () => {
      setSubmitSuccess(true)
      setContactForm({ subject: '', message: '', category: 'general' })
      setTimeout(() => setSubmitSuccess(false), 5000)
    }
  })

  const faqCategories = [...new Set(faqs.map(f => f.category))]

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
          <HelpCircle className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Help & Support</h1>
          <p className="text-slate-500">Get answers and contact our team</p>
        </div>
      </div>

      {/* Quick Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
            <Mail className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-semibold text-slate-900 mb-1">Email Support</h3>
          <p className="text-sm text-slate-500 mb-2">support@vanurses.net</p>
          <p className="text-xs text-slate-400">Response within 24 hours</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-3">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="font-semibold text-slate-900 mb-1">Ask Sully</h3>
          <p className="text-sm text-slate-500 mb-2">AI-powered instant help</p>
          <a href="/sully" className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
            Chat with Sully <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="font-semibold text-slate-900 mb-1">Business Hours</h3>
          <p className="text-sm text-slate-500 mb-2">Mon-Fri 9am-5pm EST</p>
          <p className="text-xs text-slate-400">Sully available 24/7</p>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Frequently Asked Questions</h2>
        </div>

        <div className="divide-y divide-slate-100">
          {faqCategories.map((category) => (
            <div key={category}>
              <div className="px-6 py-3 bg-slate-50">
                <h3 className="text-sm font-medium text-slate-600">{category}</h3>
              </div>
              {faqs
                .filter(f => f.category === category)
                .map((faq, idx) => {
                  const globalIdx = faqs.indexOf(faq)
                  const isExpanded = expandedFaq === globalIdx
                  return (
                    <button
                      key={idx}
                      onClick={() => setExpandedFaq(isExpanded ? null : globalIdx)}
                      className="w-full text-left px-6 py-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">{faq.question}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      {isExpanded && (
                        <p className="mt-3 text-sm text-slate-600 pr-8">
                          {faq.answer}
                        </p>
                      )}
                    </button>
                  )
                })}
            </div>
          ))}
        </div>
      </div>

      {/* Contact Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Contact Us</h2>

        {submitSuccess && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <p className="text-sm text-emerald-700">
              Your message has been sent! We'll respond within 24 hours.
            </p>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitTicket.mutate(contactForm)
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              value={contactForm.category}
              onChange={(e) => setContactForm({ ...contactForm, category: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="general">General Question</option>
              <option value="billing">Billing & Subscriptions</option>
              <option value="technical">Technical Issue</option>
              <option value="feature">Feature Request</option>
              <option value="data">Data & Scoring Question</option>
              <option value="hr">HR / Recruiter Inquiry</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
            <input
              type="text"
              value={contactForm.subject}
              onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
              placeholder="Brief description of your question"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
            <textarea
              value={contactForm.message}
              onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
              placeholder="Tell us more about how we can help..."
              rows={5}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitTicket.isPending}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {submitTicket.isPending ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>

      {/* Previous Tickets */}
      {tickets && tickets.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Your Support Tickets</h2>

          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-slate-900">{ticket.subject}</p>
                  <p className="text-sm text-slate-500">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  ticket.status === 'open' ? 'bg-amber-100 text-amber-700' :
                  ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {ticket.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff Section */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Key className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Staff</span>
        </div>

        {adminUnlocked ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-600">
              <Unlock className="w-4 h-4" />
              <span className="text-sm font-medium">Active</span>
            </div>
            <button
              onClick={() => lockAdmin()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-300 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              Deactivate
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="password"
              value={adminCode}
              onChange={(e) => { setAdminCode(e.target.value); setAdminError('') }}
              placeholder="Code..."
              className="flex-1 text-sm px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  unlockAdmin(adminCode).then(success => {
                    if (!success) setAdminError('Invalid')
                  })
                }
              }}
            />
            <button
              onClick={() => {
                unlockAdmin(adminCode).then(success => {
                  if (!success) setAdminError('Invalid')
                })
              }}
              className="px-4 py-1.5 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors"
            >
              Go
            </button>
          </div>
        )}
        {adminError && <p className="text-xs text-red-500 mt-2">{adminError}</p>}
      </div>

      {/* Status Page Link */}
      <div className="text-center py-4">
        <a
          href="https://status.vanurses.net"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1"
        >
          <AlertCircle className="w-4 h-4" />
          Check System Status
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}
