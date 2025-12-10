import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  CreditCard, Check, Zap, Crown, Building2,
  Clock, Star, ArrowRight, Package, History,
  CheckCircle, XCircle, ExternalLink, Heart
} from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import { api, setAuthToken } from '../api/client'

interface Tier {
  id: string
  name: string
  monthly_price: number
  yearly_price: number
  features: string[]
  popular?: boolean
}

interface TokenPack {
  id: string
  name: string
  tokens: number
  price: number
  bonus?: string
}

interface SubscriptionStatus {
  tier: string
  tier_name: string
  is_active: boolean
  expires_at?: string
  sully_daily_limit: number
  sully_questions_today: number
  nofilter_limit: number
  nofilter_used: number
  tokens_remaining: number
  saved_jobs_limit: number
  comparison_limit: number
  features: string[]
  trial_ends_at?: string
  is_trial: boolean
}

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  status: string
  invoice_url?: string
}

const TIER_ICONS: Record<string, typeof Star> = {
  free: Clock,
  facilities: Heart,
  starter: Zap,
  pro: Star,
  premium: Crown,
  hr_admin: Building2
}

export default function Billing() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [showCancelMessage, setShowCancelMessage] = useState(false)
  const [autoCheckoutTier, setAutoCheckoutTier] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const auth = useAuth()

  // Set auth token for API calls
  useEffect(() => {
    if (auth.user?.access_token) {
      setAuthToken(auth.user.access_token)
    }
  }, [auth.user?.access_token])

  // Sync subscription from Stripe
  const syncMutation = useMutation({
    mutationFn: () => api.post('/api/billing/sync').then(res => res.data),
    onSuccess: (data) => {
      console.log('Subscription synced:', data)
      queryClient.invalidateQueries({ queryKey: ['billing-status'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-status'] })
    }
  })

  // Handle URL params for success/cancel/plan
  useEffect(() => {
    const success = searchParams.get('success')
    const cancelled = searchParams.get('cancelled')
    const tokens = searchParams.get('tokens')
    const plan = searchParams.get('plan')

    if (success === 'true' || tokens === 'success') {
      setShowSuccessMessage(true)
      // Sync subscription from Stripe to update tier
      syncMutation.mutate()
      // Clear params after showing message
      setTimeout(() => {
        setSearchParams({})
        setShowSuccessMessage(false)
      }, 5000)
    }

    if (cancelled === 'true') {
      setShowCancelMessage(true)
      setTimeout(() => {
        setSearchParams({})
        setShowCancelMessage(false)
      }, 5000)
    }

    // Auto-checkout for plan from onboarding
    if (plan && !success && !cancelled) {
      setAutoCheckoutTier(plan)
    }
  }, [searchParams, setSearchParams, queryClient])

  const { data: status } = useQuery<SubscriptionStatus>({
    queryKey: ['billing-status'],
    queryFn: () => api.get('/api/billing/status').then(res => res.data)
  })

  const { data: tiersData } = useQuery<{ tiers: Tier[] }>({
    queryKey: ['billing-tiers'],
    queryFn: () => api.get('/api/billing/tiers').then(res => res.data)
  })

  const { data: packsData } = useQuery<{ packs: TokenPack[] }>({
    queryKey: ['billing-packs'],
    queryFn: () => api.get('/api/billing/token-packs').then(res => res.data)
  })

  const { data: historyData } = useQuery<{ transactions: Transaction[] }>({
    queryKey: ['billing-history'],
    queryFn: () => api.get('/api/billing/history').then(res => res.data)
  })

  const checkoutMutation = useMutation({
    mutationFn: (data: { tier: string; billing_period: string }) =>
      api.post('/api/billing/checkout', data).then(res => res.data),
    onSuccess: (data) => {
      window.location.href = data.checkout_url
    }
  })

  const tokenMutation = useMutation({
    mutationFn: (pack: string) =>
      api.post('/api/billing/tokens', { pack }).then(res => res.data),
    onSuccess: (data) => {
      window.location.href = data.checkout_url
    }
  })

  const portalMutation = useMutation({
    mutationFn: () => api.post('/api/billing/portal').then(res => res.data),
    onSuccess: (data) => {
      window.location.href = data.portal_url
    }
  })

  // Auto-checkout when tier is set from URL
  useEffect(() => {
    if (autoCheckoutTier && tiersData?.tiers) {
      const tierExists = tiersData.tiers.some(t => t.id === autoCheckoutTier)
      if (tierExists && status?.tier !== autoCheckoutTier) {
        checkoutMutation.mutate({ tier: autoCheckoutTier, billing_period: billingPeriod })
        setAutoCheckoutTier(null)
        setSearchParams({})
      } else {
        setAutoCheckoutTier(null)
        setSearchParams({})
      }
    }
  }, [autoCheckoutTier, tiersData, status, billingPeriod, checkoutMutation, setSearchParams])

  const tiers = tiersData?.tiers || []
  const packs = packsData?.packs || []
  const transactions = historyData?.transactions || []

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free'
    return `$${(cents / 100).toFixed(0)}`
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle className="w-6 h-6 text-emerald-500" />
          <div>
            <p className="font-medium text-emerald-800">Payment Successful!</p>
            <p className="text-sm text-emerald-600">Your subscription has been activated.</p>
          </div>
        </div>
      )}

      {/* Cancel Message */}
      {showCancelMessage && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <XCircle className="w-6 h-6 text-amber-500" />
          <div>
            <p className="font-medium text-amber-800">Checkout Cancelled</p>
            <p className="text-sm text-amber-600">No charges were made. You can try again anytime.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Billing & Subscription</h1>
        <p className="text-slate-500">Manage your subscription and purchase tokens</p>
      </div>

      {/* Current Plan */}
      {status && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Current Plan</h2>
                <p className="text-sm text-slate-500">
                  {status.is_trial ? 'Trial' : status.tier_name}
                </p>
              </div>
            </div>
            {status.tier !== 'free' && (
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
              >
                {portalMutation.isPending ? 'Loading...' : 'Manage Subscription'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Plan</p>
              <p className="font-semibold text-slate-900">{status.tier_name}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Sully Questions Today</p>
              <p className="font-semibold text-slate-900">
                {status.sully_questions_today} / {status.sully_daily_limit === -1 ? 'Unlimited' : status.sully_daily_limit}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Bonus Tokens</p>
              <p className="font-semibold text-slate-900">{status.tokens_remaining}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Status</p>
              <p className="font-semibold text-emerald-600">
                {status.is_trial ? 'Trial Active' : 'Active'}
              </p>
            </div>
          </div>

          {status.is_trial && status.trial_ends_at && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-sm text-amber-800">
                Your trial ends on {new Date(status.trial_ends_at).toLocaleDateString()}.
                Upgrade now to keep all features!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pricing Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Choose Your Plan</h2>
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'yearly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600'
              }`}
            >
              Yearly <span className="text-emerald-600 text-xs">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {tiers.map((tier) => {
            const Icon = TIER_ICONS[tier.id] || Star
            const price = billingPeriod === 'yearly' ? tier.yearly_price : tier.monthly_price
            const isCurrentPlan = status?.tier === tier.id

            return (
              <div
                key={tier.id}
                className={`relative rounded-2xl border p-5 ${
                  tier.popular
                    ? 'border-primary-500 bg-primary-50/50'
                    : 'border-slate-200'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                    Popular
                  </div>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`w-5 h-5 ${tier.popular ? 'text-primary-500' : 'text-slate-500'}`} />
                  <h3 className="font-semibold text-slate-900">{tier.name}</h3>
                </div>

                <div className="mb-4">
                  <span className="text-2xl font-bold text-slate-900">
                    {formatPrice(price)}
                  </span>
                  {price > 0 && (
                    <span className="text-slate-500 text-sm">
                      /{billingPeriod === 'yearly' ? 'yr' : 'mo'}
                    </span>
                  )}
                </div>

                <ul className="space-y-2 mb-4">
                  {tier.features.slice(0, 5).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => {
                    if (tier.id !== 'free' && !isCurrentPlan) {
                      checkoutMutation.mutate({ tier: tier.id, billing_period: billingPeriod })
                    }
                  }}
                  disabled={isCurrentPlan || tier.id === 'free' || checkoutMutation.isPending}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                    isCurrentPlan
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : tier.id === 'free'
                      ? 'bg-slate-100 text-slate-500 cursor-default'
                      : tier.popular
                      ? 'bg-primary-500 text-white hover:bg-primary-600'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {checkoutMutation.isPending && checkoutMutation.variables?.tier === tier.id
                    ? 'Redirecting...'
                    : isCurrentPlan
                    ? 'Current Plan'
                    : tier.id === 'free'
                    ? 'Free Forever'
                    : 'Upgrade'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Token Packs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Package className="w-6 h-6 text-primary-500" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Sully AI Credit Packs</h2>
            <p className="text-sm text-slate-500">Extra Sully questions that never expire</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {packs.map((pack) => (
            <div
              key={pack.id}
              className="border border-slate-200 rounded-xl p-5 hover:border-primary-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{pack.name}</h3>
                  {pack.bonus && (
                    <span className="text-xs text-emerald-600 font-medium">{pack.bonus}</span>
                  )}
                </div>
                <span className="text-xl font-bold text-slate-900">
                  ${(pack.price / 100).toFixed(0)}
                </span>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                {pack.tokens} Sully questions
              </p>
              <button
                onClick={() => tokenMutation.mutate(pack.id)}
                disabled={tokenMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                {tokenMutation.isPending && tokenMutation.variables === pack.id
                  ? 'Redirecting...'
                  : <>Buy Now <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <History className="w-6 h-6 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-900">Billing History</h2>
        </div>

        {transactions.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium text-slate-900">{tx.description}</p>
                  <p className="text-sm text-slate-500">
                    {new Date(tx.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-slate-900">
                    ${(tx.amount / 100).toFixed(2)}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    tx.status === 'paid' || tx.status === 'succeeded'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tx.status}
                  </span>
                  {tx.invoice_url && (
                    <a
                      href={tx.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <p>No billing history yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
