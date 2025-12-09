/**
 * Format utilities for consistent text display
 */

// Words that should stay lowercase in title case
const LOWERCASE_WORDS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'of', 'in'
])

// Words/acronyms that should stay uppercase
const UPPERCASE_WORDS = new Set([
  'VA', 'DC', 'MD', 'NC', 'WV', 'USA', 'US', 'RN', 'LPN', 'NP', 'CNA', 'BSN', 'MSN', 'DNP',
  'ICU', 'ER', 'OR', 'NICU', 'PICU', 'CCU', 'PACU', 'ED', 'OB', 'GYN', 'L&D',
  'HCA', 'VCU', 'UVA', 'MCV', 'INOVA', 'CJW', 'CMC', 'VHC', 'VHS',
  'II', 'III', 'IV', 'LLC', 'INC', 'PC'
])

/**
 * Convert string to title case with smart handling of acronyms and small words
 */
export function toTitleCase(str: string | null | undefined): string {
  if (!str) return ''

  // If already mixed case and not all caps, return as-is (probably already formatted)
  const hasLowercase = /[a-z]/.test(str)
  const hasUppercase = /[A-Z]/.test(str)
  if (hasLowercase && hasUppercase && str !== str.toUpperCase()) {
    return str
  }

  return str
    .toLowerCase()
    .split(/(\s+|-|'|")/)
    .map((word, index, arr) => {
      // Skip empty strings and separators
      if (!word.trim() || /^[\s\-'"]+$/.test(word)) return word

      const upperWord = word.toUpperCase()

      // Check if it's an acronym that should stay uppercase
      if (UPPERCASE_WORDS.has(upperWord)) {
        return upperWord
      }

      // Keep small words lowercase unless first or last word
      if (LOWERCASE_WORDS.has(word) && index > 0 && index < arr.length - 1) {
        return word
      }

      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join('')
}

/**
 * Format a number as currency
 */
export function formatCurrency(value: number, options?: { decimals?: number }): string {
  const { decimals = 0 } = options || {}
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}

/**
 * Format a date as relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
