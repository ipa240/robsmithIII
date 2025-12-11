import { useQuery } from '@tanstack/react-query'
import { useSubscription } from './useSubscription'
import { api } from '../api/client'

const FREE_SAVE_LIMIT = 1 // Free users can save 1 job
const STARTER_SAVE_LIMIT = -1 // Unlimited for paid

interface SavedJobsApiResponse {
  success: boolean
  data: Array<{
    id: string
    title: string
    saved_at: string
  }>
}

/**
 * Hook to track saved jobs limit for free users.
 * Free users can only save 1 job.
 * Paid users (starter and above) have unlimited saves.
 */
export function useSavedJobLimit() {
  const { isPaid, tier } = useSubscription()

  // Fetch saved jobs count from API - use same key as JobDetail for cache sharing
  const { data, isLoading, refetch } = useQuery<SavedJobsApiResponse>({
    queryKey: ['saved-jobs'],
    queryFn: async () => {
      const response = await api.get('/api/me/saved-jobs')
      return response.data
    },
    staleTime: 30000, // Cache for 30 seconds
    retry: 1,
  })

  // Count is derived from the data array length
  const savedCount = data?.data?.length || 0
  const limit = isPaid ? STARTER_SAVE_LIMIT : FREE_SAVE_LIMIT

  /**
   * Check if user can save another job
   */
  const canSave = (): boolean => {
    // Paid users always can save
    if (isPaid) return true

    // Free users limited to 1
    return savedCount < FREE_SAVE_LIMIT
  }

  /**
   * Check if limit has been reached
   */
  const limitReached = !isPaid && savedCount >= FREE_SAVE_LIMIT

  /**
   * Get remaining saves
   */
  const remainingSaves = isPaid ? -1 : Math.max(0, FREE_SAVE_LIMIT - savedCount)

  return {
    // State
    savedCount,
    limit,
    remainingSaves,
    limitReached,
    isLoading,

    // Methods
    canSave,
    refetch,

    // For reference
    tier,
    isPaid,
  }
}

export default useSavedJobLimit
