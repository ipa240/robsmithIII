import { useState } from 'react'
import { Lock, Unlock } from 'lucide-react'

// NoFilter unlock code and storage key (shared across all pages)
export const NOFILTER_UNLOCK_CODE = 'sullynofilter!'
export const NOFILTER_STORAGE_KEY = 'sully_nofilter_unlocked'

interface NoFilterUnlockModalProps {
  isOpen: boolean
  onClose: () => void
  onUnlock: () => void
}

export function NoFilterUnlockModal({ isOpen, onClose, onUnlock }: NoFilterUnlockModalProps) {
  const [unlockCode, setUnlockCode] = useState('')
  const [unlockError, setUnlockError] = useState('')

  const handleUnlockSubmit = () => {
    if (unlockCode === NOFILTER_UNLOCK_CODE) {
      localStorage.setItem(NOFILTER_STORAGE_KEY, 'true')
      onUnlock()
      onClose()
      setUnlockCode('')
      setUnlockError('')
    } else {
      setUnlockError('Invalid code. Contact us for access.')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <Lock className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">No Filter Mode</h3>
            <p className="text-sm text-slate-500">Enter code to unlock</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Nursing is stressful. Sometimes you need real talk, not corporate fluff.
          No Filter Sully is that burned-out nurse every unit has - the one who tells it like it is.
          <span className="block mt-2 font-medium text-red-600">Have a laugh while getting honest answers.</span>
          <span className="block mt-2 text-xs text-slate-500">
            <a href="/support" className="text-red-500 hover:text-red-600 underline">Message us</a> to get an unlock code.
          </span>
        </p>
        <div className="space-y-3">
          <input
            type="text"
            value={unlockCode}
            onChange={(e) => { setUnlockCode(e.target.value); setUnlockError('') }}
            placeholder="Enter unlock code..."
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            onKeyDown={(e) => e.key === 'Enter' && handleUnlockSubmit()}
            autoFocus
          />
          {unlockError && (
            <p className="text-sm text-red-500">{unlockError}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => { onClose(); setUnlockCode(''); setUnlockError('') }}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUnlockSubmit}
              className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
            >
              Unlock
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to check if NoFilter is unlocked
export function isNoFilterUnlocked(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(NOFILTER_STORAGE_KEY) === 'true'
}

// Helper function to lock NoFilter
export function lockNoFilter(): void {
  localStorage.removeItem(NOFILTER_STORAGE_KEY)
}

// Small lock/unlock button component for inline use
interface NoFilterLockButtonProps {
  isUnlocked: boolean
  onToggle: () => void
  className?: string
}

export function NoFilterLockButton({ isUnlocked, onToggle, className = '' }: NoFilterLockButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors ${
        isUnlocked
          ? 'text-red-600 hover:bg-red-50'
          : 'text-slate-400 hover:bg-slate-100'
      } ${className}`}
      title={isUnlocked ? 'Lock No Filter mode' : 'Unlock No Filter mode'}
    >
      {isUnlocked ? (
        <>
          <Unlock className="w-3 h-3" />
          <span>Lock</span>
        </>
      ) : (
        <>
          <Lock className="w-3 h-3" />
          <span>Unlock</span>
        </>
      )}
    </button>
  )
}

export default NoFilterUnlockModal
