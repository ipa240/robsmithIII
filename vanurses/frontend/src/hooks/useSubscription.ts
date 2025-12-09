import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

// DEV MODE: Set to true to bypass all premium restrictions for testing
const DEV_MODE = false

interface SubscriptionStatus {
  tier: 'free' | 'starter' | 'pro' | 'premium' | 'hr_admin'
  tier_name: string
  is_active: boolean
  expires_at: string | null
  sully_daily_limit: number
  sully_questions_today: number
  nofilter_limit: number
  nofilter_used: number
  tokens_remaining: number
  saved_jobs_limit: number
  comparison_limit: number
  features: string[]
  trial_ends_at: string | null
  is_trial: boolean
  can_access_personalized: boolean
  can_access_resume_builder: boolean
  can_export_pdf: boolean
}

const TIER_FEATURES = {
  free: {
    full_indices: false,
    facility_compare: 0,
    sully_daily: 3,
    sully_nofilter: 1, // 1 free NoFilter chat
    pdf_export: false,
    custom_weights: false,
    trend_analytics: false,
    priority_alerts: false,
    personalized_results: false,
    resume_builder: false,
  },
  starter: {
    full_indices: true,
    facility_compare: 2,
    sully_daily: 10,
    sully_nofilter: 0,
    pdf_export: false,
    custom_weights: false,
    trend_analytics: false,
    priority_alerts: true,
    personalized_results: false,
    resume_builder: false,
  },
  pro: {
    full_indices: true,
    facility_compare: 5,
    sully_daily: 25,
    sully_nofilter: -1, // unlimited
    pdf_export: false,
    custom_weights: false,
    trend_analytics: true,
    priority_alerts: true,
    personalized_results: true,
    resume_builder: false,
  },
  premium: {
    full_indices: true,
    facility_compare: -1, // unlimited
    sully_daily: -1,
    sully_nofilter: -1,
    pdf_export: true,
    custom_weights: true,
    trend_analytics: true,
    priority_alerts: true,
    personalized_results: true,
    resume_builder: true,
  },
  hr_admin: {
    full_indices: true,
    facility_compare: -1,
    sully_daily: -1,
    sully_nofilter: -1,
    pdf_export: true,
    custom_weights: true,
    trend_analytics: true,
    priority_alerts: true,
    personalized_results: true,
    resume_builder: true,
  },
}

export function useSubscription() {
  const { data, isLoading, refetch } = useQuery<SubscriptionStatus>({
    queryKey: ['subscription-status'],
    queryFn: () => api.get('/api/billing/status').then(res => res.data),
    staleTime: 60000, // Cache for 1 minute
    enabled: !DEV_MODE,
    retry: 1,
  })

  // In DEV_MODE, always return hr_admin with full access
  if (DEV_MODE) {
    return {
      tier: 'hr_admin' as const,
      tierName: 'HR/Admin',
      isLoading: false,
      isTrial: false,
      trialDaysRemaining: 0,
      trialExpiresAt: null,
      subscriptionEndsAt: null,
      tokensRemaining: 9999,
      sullyQuestionsToday: 0,
      sullyDailyLimit: -1,
      nofilterLimit: -1,
      nofilterUsed: 0,
      savedJobsLimit: -1,
      comparisonLimit: -1,
      hasFeature: () => true,
      canCompare: () => true,
      canUseSully: () => true,
      canUseNofilter: () => true,
      canAccessPersonalized: true,
      canAccessResumeBuilder: true,
      canExportPdf: true,
      isPaid: true,
      isStarter: false,
      isPro: false,
      isPremium: true,
      isHrAdmin: true,
      isProOrAbove: true,
      isPremiumOrAbove: true,
      refetch,
    }
  }

  const tier = data?.tier || 'free'
  const features = TIER_FEATURES[tier]

  // Calculate trial days remaining
  let trialDaysRemaining = 0
  if (data?.trial_ends_at) {
    const trialEnd = new Date(data.trial_ends_at)
    const now = new Date()
    trialDaysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  }

  return {
    // Status
    tier,
    tierName: data?.tier_name || 'Free',
    isLoading,
    isTrial: data?.is_trial || false,
    trialDaysRemaining,
    trialExpiresAt: data?.trial_ends_at,
    subscriptionEndsAt: data?.expires_at,
    tokensRemaining: data?.tokens_remaining || 0,
    sullyQuestionsToday: data?.sully_questions_today || 0,
    sullyDailyLimit: data?.sully_daily_limit || 3,
    nofilterLimit: data?.nofilter_limit || 0,
    nofilterUsed: data?.nofilter_used || 0,
    savedJobsLimit: data?.saved_jobs_limit || 5,
    comparisonLimit: data?.comparison_limit || 0,

    // Feature checks
    hasFeature: (feature: keyof typeof features) => {
      // During trial, give limited access (not full)
      const value = features[feature]
      return typeof value === 'boolean' ? value : value !== 0
    },

    canCompare: (count: number) => {
      const limit = data?.comparison_limit ?? features.facility_compare
      return limit === -1 || count <= limit
    },

    canUseSully: () => {
      const limit = data?.sully_daily_limit ?? features.sully_daily
      if (limit === -1) return true
      return (data?.sully_questions_today || 0) < limit
    },

    canUseNofilter: () => {
      const limit = data?.nofilter_limit ?? features.sully_nofilter
      if (limit === -1) return true
      if (limit === 0) return false
      return (data?.nofilter_used || 0) < limit
    },

    // Access checks from API
    canAccessPersonalized: data?.can_access_personalized || false,
    canAccessResumeBuilder: data?.can_access_resume_builder || false,
    canExportPdf: data?.can_export_pdf || false,

    // Tier checks
    isPaid: tier !== 'free',
    isStarter: tier === 'starter',
    isPro: tier === 'pro',
    isPremium: tier === 'premium',
    isHrAdmin: tier === 'hr_admin',
    isProOrAbove: ['pro', 'premium', 'hr_admin'].includes(tier),
    isPremiumOrAbove: ['premium', 'hr_admin'].includes(tier),

    // Refetch function
    refetch,
  }
}
