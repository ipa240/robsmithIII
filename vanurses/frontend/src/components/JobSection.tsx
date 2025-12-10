import { ReactNode } from 'react'

interface JobSectionProps {
  title: string
  icon: ReactNode
  content: string | string[] | null | undefined
  isLoading?: boolean
  variant?: 'default' | 'highlight'
}

export default function JobSection({ title, icon, content, isLoading, variant = 'default' }: JobSectionProps) {
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

  if (!content || (Array.isArray(content) && content.length === 0)) {
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
      {Array.isArray(content) ? (
        <ul className="space-y-1.5">
          {content.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
              <span className="text-primary-400 mt-1.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600 whitespace-pre-line">{content}</p>
      )}
    </div>
  )
}
