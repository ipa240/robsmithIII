import { useState, useEffect, useCallback } from 'react'
import { useSubscription } from './useSubscription'

const STORAGE_KEY = 'vanurses_viewed_jobs'
const FREE_VIEW_LIMIT = 3

interface ViewedJob {
  id: string
  viewedAt: number
}

/**
 * Hook to track job detail views for free users.
 * Views are stored in localStorage and NEVER reset - they persist forever
 * until the user upgrades to a paid plan.
 */
export function useJobViewLimit() {
  const { isPaid, tier } = useSubscription()
  const [viewedJobs, setViewedJobs] = useState<ViewedJob[]>([])

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ViewedJob[]
        setViewedJobs(parsed)
      }
    } catch (error) {
      console.error('Error loading viewed jobs:', error)
    }
  }, [])

  // Save to localStorage when viewedJobs changes
  const saveViewedJobs = useCallback((jobs: ViewedJob[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
      setViewedJobs(jobs)
    } catch (error) {
      console.error('Error saving viewed jobs:', error)
    }
  }, [])

  /**
   * Check if a specific job has been viewed before
   */
  const hasViewed = useCallback(
    (jobId: string): boolean => {
      return viewedJobs.some((j) => j.id === jobId)
    },
    [viewedJobs]
  )

  /**
   * Check if user can view a job (either already viewed, or under limit)
   */
  const canView = useCallback(
    (jobId: string): boolean => {
      // Paid users always can view
      if (isPaid) return true

      // Already viewed this job
      if (hasViewed(jobId)) return true

      // Under the limit
      return viewedJobs.length < FREE_VIEW_LIMIT
    },
    [isPaid, hasViewed, viewedJobs.length]
  )

  /**
   * Record a view for a job. Only records if not already viewed.
   * Returns true if view was recorded, false if already viewed or at limit.
   */
  const recordView = useCallback(
    (jobId: string): boolean => {
      // Paid users don't need tracking
      if (isPaid) return true

      // Already viewed
      if (hasViewed(jobId)) return true

      // At limit
      if (viewedJobs.length >= FREE_VIEW_LIMIT) return false

      // Record the view
      const newView: ViewedJob = {
        id: jobId,
        viewedAt: Date.now(),
      }
      saveViewedJobs([...viewedJobs, newView])
      return true
    },
    [isPaid, hasViewed, viewedJobs, saveViewedJobs]
  )

  /**
   * Get remaining view count
   */
  const remainingViews = isPaid
    ? -1 // Unlimited
    : Math.max(0, FREE_VIEW_LIMIT - viewedJobs.length)

  /**
   * Check if limit has been reached
   */
  const limitReached = !isPaid && viewedJobs.length >= FREE_VIEW_LIMIT

  /**
   * Get list of viewed job IDs
   */
  const viewedJobIds = viewedJobs.map((j) => j.id)

  return {
    // State
    viewedJobs,
    viewedJobIds,
    viewCount: viewedJobs.length,
    limit: isPaid ? -1 : FREE_VIEW_LIMIT,
    remainingViews,
    limitReached,

    // Methods
    hasViewed,
    canView,
    recordView,

    // For debugging
    tier,
    isPaid,
  }
}

export default useJobViewLimit
