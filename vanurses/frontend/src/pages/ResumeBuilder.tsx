import { Link } from 'react-router-dom'
import { FileText, Mail, ArrowRight, Clock, Sparkles } from 'lucide-react'

export default function ResumeBuilder() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-100 text-primary-600 mb-6">
          <FileText className="w-10 h-10" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          Resume Builder
        </h1>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium mb-6">
          <Clock className="w-4 h-4" />
          Coming Soon
        </div>

        {/* Description */}
        <p className="text-slate-600 mb-8 max-w-md mx-auto">
          We're working on an AI-powered resume builder designed specifically for nursing professionals.
          Create tailored resumes that highlight your clinical experience and certifications.
        </p>

        {/* Features Preview */}
        <div className="bg-slate-50 rounded-lg p-6 mb-8 text-left">
          <h3 className="font-semibold text-slate-900 mb-4 text-center">What's Coming:</h3>
          <ul className="space-y-3">
            {[
              'Pre-built templates for healthcare professionals',
              'AI-powered summary and bullet point suggestions',
              'Automatic skills extraction from your profile',
              'Export to PDF with professional formatting',
              'Tailored versions for specific job postings',
            ].map((feature, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                <span className="text-slate-600">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Want early access? Let us know!
          </p>
          <a
            href="mailto:support@vanurses.net?subject=Resume Builder Early Access"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            <Mail className="w-5 h-5" />
            Request Early Access
          </a>
        </div>

        {/* Back Link */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <Link
            to="/dashboard"
            className="text-primary-600 hover:underline inline-flex items-center gap-1"
          >
            Back to Dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
