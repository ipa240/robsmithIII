import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import SullyChat from './SullyChat'

export default function SullyButton() {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()

  // Hide on the Sully page since it has its own full chat interface
  if (location.pathname === '/sully') {
    return null
  }

  return (
    <>
      {/* Chat Popup */}
      <SullyChat isOpen={isOpen} onClose={() => setIsOpen(false)} />

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all z-50 overflow-hidden ${
          isOpen
            ? 'bg-slate-700'
            : 'hover:scale-110 hover:shadow-xl ring-2 ring-white ring-offset-2'
        }`}
        title="Chat with Sully"
      >
        {isOpen ? (
          <X className="w-7 h-7 text-white" />
        ) : (
          <img
            src="/media/sully/sully-neutral.jpg"
            alt="Chat with Sully"
            className="w-full h-full object-cover"
          />
        )}
      </button>
    </>
  )
}
