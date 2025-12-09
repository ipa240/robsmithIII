import { useState, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../api/client'
import {
  FileText, Download, Eye, Layout, Palette, Plus, Minus,
  ChevronUp, ChevronDown, GripVertical, Lock, Sparkles,
  Upload, X, Briefcase, CheckCircle, AlertCircle, Loader2
} from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription'
import PremiumGate from '../components/PremiumGate'

interface ProfileData {
  first_name: string
  last_name: string
  email: string
  phone: string
  city: string
  state: string
  zip_code: string
  license_type: string
  license_state: string
  license_number: string
  license_expires_at: string
  compact_license: boolean
  certifications: string[]
  years_experience: number
  specialties: string[]
  education: { id: string; school: string; degree: string; field: string; graduation_year: number }[]
  work_history: { id: string; employer: string; title: string; location: string; start_date: string; end_date: string | null; current: boolean; description: string }[]
  summary: string
  skills: string[]
}

interface JobOption {
  id: string
  title: string
  facility_name: string
  city: string
  display: string
}

interface TailorResult {
  original: string
  tailored: string
  suggestions: string[]
  keywords_added: string[]
}

const TEMPLATES = [
  { id: 'modern', name: 'Modern', description: 'Clean lines with accent colors' },
  { id: 'classic', name: 'Classic', description: 'Traditional professional layout' },
  { id: 'minimal', name: 'Minimal', description: 'Simple and elegant' },
]

const COLORS = [
  { id: 'blue', primary: '#2563eb', secondary: '#1d4ed8' },
  { id: 'teal', primary: '#0d9488', secondary: '#0f766e' },
  { id: 'purple', primary: '#7c3aed', secondary: '#6d28d9' },
  { id: 'rose', primary: '#e11d48', secondary: '#be123c' },
  { id: 'slate', primary: '#475569', secondary: '#334155' },
]

const SECTIONS = [
  { id: 'summary', name: 'Professional Summary', required: true },
  { id: 'experience', name: 'Work Experience', required: true },
  { id: 'education', name: 'Education', required: true },
  { id: 'credentials', name: 'Credentials & Certifications', required: false },
  { id: 'skills', name: 'Skills', required: false },
]

export default function ResumeBuilder() {
  const { hasFeature, isPremiumOrAbove } = useSubscription()
  const resumeRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [template, setTemplate] = useState('modern')
  const [color, setColor] = useState(COLORS[0])
  const [sections, setSections] = useState(SECTIONS.map(s => ({ ...s, enabled: true })))
  const [showPreview, setShowPreview] = useState(true)

  // Resume upload state
  const [uploadedResume, setUploadedResume] = useState<string>('')
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadMessage, setUploadMessage] = useState('')

  // AI tailoring state
  const [selectedJobId, setSelectedJobId] = useState('')
  const [tailorResult, setTailorResult] = useState<TailorResult | null>(null)
  const [showTailorPanel, setShowTailorPanel] = useState(false)

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ['profile'],
    queryFn: () => api.get('/api/me/profile').then(res => res.data)
  })

  // Fetch recent jobs for tailoring
  const { data: jobsData } = useQuery({
    queryKey: ['resume-jobs'],
    queryFn: () => api.get('/api/resume/jobs/recent?limit=30').then(res => res.data),
  })

  const recentJobs: JobOption[] = jobsData?.jobs || []

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return api.post('/api/resume/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      }).then(res => res.data)
    },
    onSuccess: (data) => {
      setUploadedResume(data.text)
      setUploadStatus('success')
      setUploadMessage(data.message)
    },
    onError: (error: any) => {
      setUploadStatus('error')
      setUploadMessage(error.response?.data?.detail || 'Failed to upload resume')
    }
  })

  // Tailor mutation
  const tailorMutation = useMutation({
    mutationFn: async () => {
      return api.post('/api/resume/tailor', {
        resume_text: uploadedResume,
        job_id: selectedJobId
      }).then(res => res.data)
    },
    onSuccess: (data) => {
      setTailorResult(data)
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Failed to tailor resume')
    }
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadStatus('uploading')
      setUploadMessage('')
      uploadMutation.mutate(file)
    }
  }

  const handleTailor = () => {
    if (!uploadedResume || !selectedJobId) {
      alert('Please upload a resume and select a job first')
      return
    }
    tailorMutation.mutate()
  }

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...sections]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= sections.length) return
    ;[newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]]
    setSections(newSections)
  }

  const toggleSection = (id: string) => {
    setSections(sections.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  const handleExportPDF = async () => {
    if (!isPremiumOrAbove) return
    window.print()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const hasProfile = profile?.first_name && profile?.last_name

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resume Builder</h1>
          <p className="text-slate-600">Create and tailor your nursing resume</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? 'Hide' : 'Show'} Preview
          </button>
          <PremiumGate feature="PDF Export" requiredTier="premium" showPreview={false}>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </PremiumGate>
        </div>
      </div>

      {!hasProfile && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-amber-800">
            Your profile is incomplete. <a href="/profile/edit" className="underline font-medium">Complete your profile</a> to generate a resume from your profile data.
          </p>
        </div>
      )}

      {/* AI Resume Tailoring Section */}
      <div className="bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5" />
              <h2 className="text-lg font-semibold">AI Resume Tailoring</h2>
            </div>
            <p className="text-primary-100 mb-4">
              Upload your resume and tailor it to a specific job posting using AI.
            </p>
          </div>
          <button
            onClick={() => setShowTailorPanel(!showTailorPanel)}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
          >
            {showTailorPanel ? 'Hide' : 'Get Started'}
          </button>
        </div>

        {showTailorPanel && (
          <div className="mt-4 pt-4 border-t border-white/20 space-y-4">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">1. Upload Your Resume</label>
              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadStatus === 'uploading'}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-primary-600 rounded-lg hover:bg-primary-50 font-medium transition-colors disabled:opacity-50"
                >
                  {uploadStatus === 'uploading' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload Resume'}
                </button>
                <span className="text-sm text-primary-100">PDF, DOCX, or TXT (max 5MB)</span>
              </div>
              {uploadStatus === 'success' && (
                <div className="flex items-center gap-2 mt-2 text-sm text-emerald-200">
                  <CheckCircle className="w-4 h-4" />
                  {uploadMessage}
                </div>
              )}
              {uploadStatus === 'error' && (
                <div className="flex items-center gap-2 mt-2 text-sm text-red-200">
                  <AlertCircle className="w-4 h-4" />
                  {uploadMessage}
                </div>
              )}
            </div>

            {/* Job Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">2. Select Target Job</label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full px-4 py-2 bg-white text-slate-900 rounded-lg"
              >
                <option value="">Choose a job to tailor for...</option>
                {recentJobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.display}
                  </option>
                ))}
              </select>
            </div>

            {/* Tailor Button */}
            <div>
              <button
                onClick={handleTailor}
                disabled={!uploadedResume || !selectedJobId || tailorMutation.isPending}
                className="flex items-center gap-2 px-6 py-3 bg-white text-primary-600 rounded-lg hover:bg-primary-50 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {tailorMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    AI is tailoring your resume...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Tailor My Resume
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tailoring Results */}
      {tailorResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">AI Tailoring Results</h3>
            <button
              onClick={() => setTailorResult(null)}
              className="p-1 hover:bg-slate-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Suggestions */}
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Suggestions</h4>
              <ul className="space-y-2">
                {tailorResult.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Keywords */}
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Keywords Added</h4>
              <div className="flex flex-wrap gap-2">
                {tailorResult.keywords_added.map((k, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-primary-50 text-primary-700 text-sm rounded-full"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Tailored Content */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h4 className="font-medium text-slate-900 mb-2">Tailored Resume Content</h4>
            <div className="bg-slate-50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
              <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans">
                {tailorResult.tailored}
              </pre>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(tailorResult.tailored)}
              className="mt-2 px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg"
            >
              Copy to Clipboard
            </button>
          </div>
        </div>
      )}

      <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
        {/* Controls Panel */}
        <div className="space-y-6">
          {/* Template Selection */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layout className="w-4 h-4 text-primary-600" />
              <h3 className="font-medium text-slate-900">Template</h3>
            </div>
            <div className="space-y-2">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                    template === t.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-medium text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-primary-600" />
              <h3 className="font-medium text-slate-900">Accent Color</h3>
            </div>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-full border-2 ${
                    color.id === c.id ? 'border-slate-900 ring-2 ring-offset-2' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.primary }}
                />
              ))}
            </div>
          </div>

          {/* Section Order */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <GripVertical className="w-4 h-4 text-primary-600" />
              <h3 className="font-medium text-slate-900">Sections</h3>
            </div>
            <div className="space-y-2">
              {sections.map((section, index) => (
                <div
                  key={section.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    section.enabled ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <button
                    onClick={() => toggleSection(section.id)}
                    disabled={section.required}
                    className={`w-5 h-5 rounded border flex items-center justify-center ${
                      section.enabled
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'border-slate-300'
                    } ${section.required ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {section.enabled && <span className="text-xs">✓</span>}
                  </button>
                  <span className={`flex-1 text-sm ${section.enabled ? 'text-slate-900' : 'text-slate-400'}`}>
                    {section.name}
                    {section.required && <span className="text-xs text-slate-400 ml-1">(required)</span>}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveSection(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveSection(index, 'down')}
                      disabled={index === sections.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resume Preview */}
        {showPreview && (
          <div className="lg:col-span-2">
            <div
              ref={resumeRef}
              className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden"
              style={{ aspectRatio: '8.5 / 11' }}
            >
              <div className="p-8 h-full overflow-auto print:p-0">
                {/* Header */}
                <div className={`mb-6 ${template === 'modern' ? 'border-l-4 pl-4' : ''}`} style={{ borderColor: color.primary }}>
                  <h1 className="text-3xl font-bold text-slate-900">
                    {profile?.first_name || 'Your'} {profile?.last_name || 'Name'}
                  </h1>
                  <p className="text-lg font-medium" style={{ color: color.primary }}>
                    {profile?.license_type || 'Registered Nurse'} | {profile?.specialties?.[0] || 'Healthcare Professional'}
                  </p>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-600">
                    {profile?.email && <span>{profile.email}</span>}
                    {profile?.phone && <span>{profile.phone}</span>}
                    {profile?.city && <span>{profile.city}, {profile.state}</span>}
                  </div>
                </div>

                {/* Dynamic Sections */}
                {sections.filter(s => s.enabled).map(section => (
                  <div key={section.id} className="mb-6">
                    <h2
                      className={`text-lg font-bold mb-3 pb-1 border-b-2`}
                      style={{ color: color.primary, borderColor: color.primary }}
                    >
                      {section.name}
                    </h2>

                    {section.id === 'summary' && (
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {profile?.summary || 'A dedicated healthcare professional with experience in patient care and clinical excellence. Add a professional summary to your profile to populate this section.'}
                      </p>
                    )}

                    {section.id === 'experience' && (
                      <div className="space-y-4">
                        {(profile?.work_history || []).length > 0 ? (
                          profile?.work_history.map(work => (
                            <div key={work.id}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-semibold text-slate-900">{work.title}</p>
                                  <p className="text-sm" style={{ color: color.primary }}>{work.employer}</p>
                                </div>
                                <p className="text-sm text-slate-500">
                                  {work.start_date} - {work.current ? 'Present' : work.end_date}
                                </p>
                              </div>
                              {work.description && (
                                <p className="text-sm text-slate-600 mt-1">{work.description}</p>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400 italic">Add work experience in your profile</p>
                        )}
                      </div>
                    )}

                    {section.id === 'education' && (
                      <div className="space-y-3">
                        {(profile?.education || []).length > 0 ? (
                          profile?.education.map(edu => (
                            <div key={edu.id} className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-slate-900">{edu.degree} in {edu.field}</p>
                                <p className="text-sm" style={{ color: color.primary }}>{edu.school}</p>
                              </div>
                              <p className="text-sm text-slate-500">{edu.graduation_year}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400 italic">Add education in your profile</p>
                        )}
                      </div>
                    )}

                    {section.id === 'credentials' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-700">License:</span>
                          <span className="text-sm text-slate-600">
                            {profile?.license_type || 'RN'} - {profile?.license_state || 'VA'}
                            {profile?.compact_license && ' (Compact)'}
                          </span>
                        </div>
                        {(profile?.certifications || []).length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-700">Certifications:</span>
                            {profile?.certifications.map(cert => (
                              <span
                                key={cert}
                                className="px-2 py-0.5 text-xs rounded-full"
                                style={{ backgroundColor: `${color.primary}20`, color: color.primary }}
                              >
                                {cert}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {section.id === 'skills' && (
                      <div className="flex flex-wrap gap-2">
                        {(profile?.skills || []).length > 0 ? (
                          profile?.skills.map(skill => (
                            <span
                              key={skill}
                              className="px-3 py-1 text-sm rounded-full bg-slate-100 text-slate-700"
                            >
                              {skill}
                            </span>
                          ))
                        ) : (profile?.specialties || []).map(spec => (
                          <span
                            key={spec}
                            className="px-3 py-1 text-sm rounded-full bg-slate-100 text-slate-700"
                          >
                            {spec}
                          </span>
                        ))}
                        {(!profile?.skills?.length && !profile?.specialties?.length) && (
                          <p className="text-sm text-slate-400 italic">Add skills in your profile</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Export Options */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Preview updates automatically as you customize your resume
              </p>
              <div className="flex gap-2">
                {!isPremiumOrAbove && (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <Lock className="w-3 h-3" />
                    PDF export requires Premium
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #resume-preview, #resume-preview * {
            visibility: visible;
          }
          #resume-preview {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
