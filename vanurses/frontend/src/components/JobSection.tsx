import { ReactNode } from 'react'

interface JobSectionProps {
  title: string
  icon: ReactNode
  content: any  // Accept any type, safely convert
  isLoading?: boolean
  variant?: 'default' | 'highlight'
}

// Helper to safely convert any content to displayable format
const safeContent = (content: any): string | string[] | null => {
  if (!content) return null
  if (typeof content === 'string') return content

  // Handle arrays
  if (Array.isArray(content)) {
    const items = content.map(item => {
      if (typeof item === 'string') return item
      if (typeof item === 'object' && item !== null) {
        // Handle {name, description} pattern from benefits
        if (item.name && item.description) return `${item.name}: ${item.description}`
        if (item.name) return item.name
        if (item.description) return item.description
        // Fallback: join all string values
        return Object.values(item).filter(v => typeof v === 'string').join(' - ')
      }
      return String(item)
    }).filter(Boolean)
    return items.length > 0 ? items : null
  }

  // Handle objects
  if (typeof content === 'object') {
    // Handle experience: {type, years}
    if ('type' in content && 'years' in content) {
      const { type, years } = content
      if (type && years) return `${years} year${years !== 1 ? 's' : ''} ${type}`
      if (type) return type
      if (years) return `${years} year${years !== 1 ? 's' : ''} experience`
    }

    // Handle education: {required, preferred}
    if ('required' in content || 'preferred' in content) {
      const parts = []
      if (content.required) parts.push(`Required: ${content.required}`)
      if (content.preferred) parts.push(`Preferred: ${content.preferred}`)
      return parts.length > 0 ? parts : null
    }

    // Handle certifications: {additional, required_or_preferred, license_or_certification}
    if ('license_or_certification' in content || 'required_or_preferred' in content) {
      const parts = []
      if (content.license_or_certification) {
        if (Array.isArray(content.license_or_certification)) {
          parts.push(...content.license_or_certification)
        } else {
          parts.push(content.license_or_certification)
        }
      }
      if (content.required_or_preferred) {
        if (Array.isArray(content.required_or_preferred)) {
          parts.push(...content.required_or_preferred)
        } else {
          parts.push(content.required_or_preferred)
        }
      }
      if (content.additional) {
        if (Array.isArray(content.additional)) {
          parts.push(...content.additional)
        } else {
          parts.push(content.additional)
        }
      }
      return parts.length > 0 ? parts : null
    }

    // Handle schedule: {hours, pattern, shift_details, ...}
    if ('hours' in content || 'pattern' in content || 'shift_details' in content) {
      const parts = []
      if (content.pattern) parts.push(content.pattern)
      if (content.hours) parts.push(content.hours)
      if (content.shift_details) parts.push(content.shift_details)
      if (content.weekend_requirements) parts.push(`Weekend: ${content.weekend_requirements}`)
      if (content.holiday_rotation) parts.push(`Holiday: ${content.holiday_rotation}`)
      return parts.length > 0 ? parts.join(', ') : null
    }

    // Generic fallback: extract all string values
    const values = Object.values(content)
      .filter(v => typeof v === 'string' && v.length > 0)
    if (values.length > 0) return values as string[]

    return null
  }

  return String(content)
}

export default function JobSection({ title, icon, content, isLoading, variant = 'default' }: JobSectionProps) {
  // Safely convert content
  const safeValue = safeContent(content)

  if (isLoading) {
    return (
      <div className={`rounded-lg border p-4 ${variant === 'highlight' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="text-slate-400">{icon}</div>
          <h3 className="font-semibold text-slate-700">{title}</h3>
        </div>
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
          <div className="h-4 bg-slate-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (!safeValue || (Array.isArray(safeValue) && safeValue.length === 0)) {
    return null
  }

  const bgClass = variant === 'highlight'
    ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
    : 'border-slate-200 bg-white'

  return (
    <div className={`rounded-lg border p-4 ${bgClass}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={variant === 'highlight' ? 'text-emerald-600' : 'text-primary-600'}>{icon}</div>
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      {Array.isArray(safeValue) ? (
        <ul className="space-y-1.5">
          {safeValue.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
              <span className="text-primary-400 mt-1.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600 whitespace-pre-line">{safeValue}</p>
      )}
    </div>
  )
}
