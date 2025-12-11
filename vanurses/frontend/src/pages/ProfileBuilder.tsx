import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { api, setAuthToken } from '../api/client'
import {
  User, Mail, Phone, MapPin, Award, Briefcase, GraduationCap,
  Plus, X, Save, Edit2, Check, Calendar, FileText, Shield
} from 'lucide-react'

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
  education: Education[]
  work_history: WorkHistory[]
  summary: string
  skills: string[]
}

interface Education {
  id: string
  school: string
  degree: string
  field: string
  graduation_year: number
}

interface WorkHistory {
  id: string
  employer: string
  title: string
  location: string
  start_date: string
  end_date: string | null
  current: boolean
  description: string
}

const LICENSE_TYPES = ['RN', 'LPN', 'CNA', 'NP', 'APRN', 'CNS', 'CRNA']
const SPECIALTIES = [
  'ICU/Critical Care', 'Emergency/Trauma', 'Med-Surg', 'Labor & Delivery',
  'Pediatrics', 'Oncology', 'Cardiac', 'OR/Surgical', 'NICU', 'Psych/Mental Health',
  'Telemetry', 'Geriatrics', 'Home Health', 'Dialysis', 'Wound Care'
]
const CERTIFICATIONS = [
  'BLS', 'ACLS', 'PALS', 'NRP', 'TNCC', 'CCRN', 'CEN', 'OCN', 'CNOR', 'RNC-OB'
]
const SKILLS = [
  'IV Insertion', 'Wound Care', 'Medication Administration', 'Patient Assessment',
  'EMR/EHR Systems', 'Team Leadership', 'Patient Education', 'Critical Thinking',
  'Care Planning', 'Telemetry Monitoring', 'Ventilator Management', 'Code Response'
]

export default function ProfileBuilder() {
  const queryClient = useQueryClient()
  const auth = useAuth()
  const [editingSection, setEditingSection] = useState<string | null>(null)

  // Redirect to login if not authenticated
  if (!auth.isAuthenticated && !auth.isLoading) {
    auth.signinRedirect()
    return null
  }
  const [newWorkEntry, setNewWorkEntry] = useState<Partial<WorkHistory> | null>(null)
  const [newEducation, setNewEducation] = useState<Partial<Education> | null>(null)

  // Set auth token for API calls
  useEffect(() => {
    if (auth.user?.access_token) {
      setAuthToken(auth.user.access_token)
    }
  }, [auth.user?.access_token])

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ['profile'],
    queryFn: () => api.get('/api/me/profile').then(res => res.data)
  })

  const updateProfile = useMutation({
    mutationFn: (data: Partial<ProfileData>) => api.put('/api/me/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setEditingSection(null)
    }
  })

  const [formData, setFormData] = useState<Partial<ProfileData>>({})

  const startEditing = (section: string) => {
    setFormData(profile || {})
    setEditingSection(section)
  }

  const saveSection = () => {
    updateProfile.mutate(formData)
  }

  const toggleArrayItem = (field: keyof ProfileData, item: string) => {
    const current = (formData[field] as string[]) || []
    if (current.includes(item)) {
      setFormData({ ...formData, [field]: current.filter(i => i !== item) })
    } else {
      setFormData({ ...formData, [field]: [...current, item] })
    }
  }

  const addWorkHistory = () => {
    if (!newWorkEntry?.employer || !newWorkEntry?.title) return
    const entry: WorkHistory = {
      id: crypto.randomUUID(),
      employer: newWorkEntry.employer || '',
      title: newWorkEntry.title || '',
      location: newWorkEntry.location || '',
      start_date: newWorkEntry.start_date || '',
      end_date: newWorkEntry.current ? null : (newWorkEntry.end_date || null),
      current: newWorkEntry.current || false,
      description: newWorkEntry.description || ''
    }
    setFormData({
      ...formData,
      work_history: [...(formData.work_history || []), entry]
    })
    setNewWorkEntry(null)
  }

  const removeWorkHistory = (id: string) => {
    setFormData({
      ...formData,
      work_history: (formData.work_history || []).filter(w => w.id !== id)
    })
  }

  const addEducation = () => {
    if (!newEducation?.school || !newEducation?.degree) return
    const entry: Education = {
      id: crypto.randomUUID(),
      school: newEducation.school || '',
      degree: newEducation.degree || '',
      field: newEducation.field || '',
      graduation_year: newEducation.graduation_year || new Date().getFullYear()
    }
    setFormData({
      ...formData,
      education: [...(formData.education || []), entry]
    })
    setNewEducation(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profile Builder</h1>
          <p className="text-slate-600">Complete your profile to generate professional resumes</p>
        </div>
        <a
          href="/resume"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <FileText className="w-4 h-4" />
          Build Resume
        </a>
      </div>

      {/* Personal Information */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Personal Information</h2>
          </div>
          {editingSection !== 'personal' ? (
            <button
              onClick={() => startEditing('personal')}
              className="text-primary-600 hover:text-primary-700"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditingSection(null)} className="text-slate-500 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
              <button onClick={saveSection} className="text-green-600 hover:text-green-700">
                <Check className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div className="p-6">
          {editingSection === 'personal' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={formData.first_name || ''}
                  onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={formData.last_name || ''}
                  onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={e => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state || ''}
                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ZIP</label>
                  <input
                    type="text"
                    value={formData.zip_code || ''}
                    onChange={e => setFormData({ ...formData, zip_code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-slate-600">
                <User className="w-4 h-4" />
                <span>{profile?.first_name} {profile?.last_name || 'Not set'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="w-4 h-4" />
                <span>{profile?.email || 'Not set'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4" />
                <span>{profile?.phone || 'Not set'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-4 h-4" />
                <span>{profile?.city ? `${profile.city}, ${profile.state}` : 'Not set'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nursing Credentials */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Nursing Credentials</h2>
          </div>
          {editingSection !== 'credentials' ? (
            <button onClick={() => startEditing('credentials')} className="text-primary-600 hover:text-primary-700">
              <Edit2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditingSection(null)} className="text-slate-500 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
              <button onClick={saveSection} className="text-green-600 hover:text-green-700">
                <Check className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div className="p-6">
          {editingSection === 'credentials' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">License Type</label>
                  <select
                    value={formData.license_type || ''}
                    onChange={e => setFormData({ ...formData, license_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    {LICENSE_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">License State</label>
                  <input
                    type="text"
                    value={formData.license_state || ''}
                    onChange={e => setFormData({ ...formData, license_state: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">License Number</label>
                  <input
                    type="text"
                    value={formData.license_number || ''}
                    onChange={e => setFormData({ ...formData, license_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expiration Date</label>
                  <input
                    type="date"
                    value={formData.license_expires_at || ''}
                    onChange={e => setFormData({ ...formData, license_expires_at: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="compact"
                    checked={formData.compact_license || false}
                    onChange={e => setFormData({ ...formData, compact_license: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <label htmlFor="compact" className="text-sm text-slate-700">Compact License (NLC)</label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Certifications</label>
                <div className="flex flex-wrap gap-2">
                  {CERTIFICATIONS.map(cert => (
                    <button
                      key={cert}
                      onClick={() => toggleArrayItem('certifications', cert)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        (formData.certifications || []).includes(cert)
                          ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                          : 'bg-slate-100 text-slate-600 border-2 border-transparent'
                      }`}
                    >
                      {cert}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Years of Experience</label>
                <input
                  type="number"
                  min="0"
                  value={formData.years_experience || 0}
                  onChange={e => setFormData({ ...formData, years_experience: parseInt(e.target.value) })}
                  className="w-32 px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-slate-600">License:</span>
                <span className="font-medium">{profile?.license_type || 'Not set'} - {profile?.license_state || ''}</span>
                {profile?.compact_license && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Compact</span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-600">Experience:</span>
                <span className="font-medium">{profile?.years_experience || 0} years</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Certifications:</span>
                <div className="flex flex-wrap gap-1">
                  {(profile?.certifications || []).map(cert => (
                    <span key={cert} className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">{cert}</span>
                  ))}
                  {(!profile?.certifications || profile.certifications.length === 0) && (
                    <span className="text-slate-400">None added</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Specialties & Skills */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Award className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Specialties & Skills</h2>
          </div>
          {editingSection !== 'skills' ? (
            <button onClick={() => startEditing('skills')} className="text-primary-600 hover:text-primary-700">
              <Edit2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditingSection(null)} className="text-slate-500 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
              <button onClick={saveSection} className="text-green-600 hover:text-green-700">
                <Check className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div className="p-6">
          {editingSection === 'skills' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Specialties</label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTIES.map(spec => (
                    <button
                      key={spec}
                      onClick={() => toggleArrayItem('specialties', spec)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        (formData.specialties || []).includes(spec)
                          ? 'bg-accent-100 text-accent-700 border-2 border-accent-500'
                          : 'bg-slate-100 text-slate-600 border-2 border-transparent'
                      }`}
                    >
                      {spec}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Skills</label>
                <div className="flex flex-wrap gap-2">
                  {SKILLS.map(skill => (
                    <button
                      key={skill}
                      onClick={() => toggleArrayItem('skills', skill)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        (formData.skills || []).includes(skill)
                          ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                          : 'bg-slate-100 text-slate-600 border-2 border-transparent'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <span className="text-slate-600 text-sm">Specialties:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(profile?.specialties || []).map(spec => (
                    <span key={spec} className="px-2 py-0.5 bg-accent-100 text-accent-700 text-xs rounded-full">{spec}</span>
                  ))}
                  {(!profile?.specialties || profile.specialties.length === 0) && (
                    <span className="text-slate-400 text-sm">None added</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-slate-600 text-sm">Skills:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(profile?.skills || []).map(skill => (
                    <span key={skill} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{skill}</span>
                  ))}
                  {(!profile?.skills || profile.skills.length === 0) && (
                    <span className="text-slate-400 text-sm">None added</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Work History */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Briefcase className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Work History</h2>
          </div>
          {editingSection !== 'work' ? (
            <button onClick={() => startEditing('work')} className="text-primary-600 hover:text-primary-700">
              <Edit2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditingSection(null)} className="text-slate-500 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
              <button onClick={saveSection} className="text-green-600 hover:text-green-700">
                <Check className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div className="p-6">
          {editingSection === 'work' ? (
            <div className="space-y-4">
              {(formData.work_history || []).map(work => (
                <div key={work.id} className="p-4 bg-slate-50 rounded-lg relative">
                  <button
                    onClick={() => removeWorkHistory(work.id)}
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <p className="font-medium">{work.title}</p>
                  <p className="text-sm text-slate-600">{work.employer} - {work.location}</p>
                  <p className="text-xs text-slate-500">{work.start_date} - {work.current ? 'Present' : work.end_date}</p>
                </div>
              ))}
              {newWorkEntry ? (
                <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="Job Title"
                      value={newWorkEntry.title || ''}
                      onChange={e => setNewWorkEntry({ ...newWorkEntry, title: e.target.value })}
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <input
                      placeholder="Employer"
                      value={newWorkEntry.employer || ''}
                      onChange={e => setNewWorkEntry({ ...newWorkEntry, employer: e.target.value })}
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <input
                      placeholder="Location"
                      value={newWorkEntry.location || ''}
                      onChange={e => setNewWorkEntry({ ...newWorkEntry, location: e.target.value })}
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <input
                      type="date"
                      placeholder="Start Date"
                      value={newWorkEntry.start_date || ''}
                      onChange={e => setNewWorkEntry({ ...newWorkEntry, start_date: e.target.value })}
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newWorkEntry.current || false}
                        onChange={e => setNewWorkEntry({ ...newWorkEntry, current: e.target.checked })}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <span className="text-sm text-slate-700">Currently work here</span>
                    </label>
                    {!newWorkEntry.current && (
                      <input
                        type="date"
                        placeholder="End Date"
                        value={newWorkEntry.end_date || ''}
                        onChange={e => setNewWorkEntry({ ...newWorkEntry, end_date: e.target.value })}
                        className="px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    )}
                  </div>
                  <textarea
                    placeholder="Job description..."
                    value={newWorkEntry.description || ''}
                    onChange={e => setNewWorkEntry({ ...newWorkEntry, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button onClick={addWorkHistory} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">Add</button>
                    <button onClick={() => setNewWorkEntry(null)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setNewWorkEntry({})}
                  className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:text-slate-700 hover:border-slate-400 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Work Experience
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {(profile?.work_history || []).map(work => (
                <div key={work.id} className="flex gap-4">
                  <div className="w-2 h-2 bg-primary-500 rounded-full mt-2" />
                  <div>
                    <p className="font-medium">{work.title}</p>
                    <p className="text-sm text-slate-600">{work.employer} - {work.location}</p>
                    <p className="text-xs text-slate-500">{work.start_date} - {work.current ? 'Present' : work.end_date}</p>
                  </div>
                </div>
              ))}
              {(!profile?.work_history || profile.work_history.length === 0) && (
                <p className="text-slate-400 text-center py-4">No work history added</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Education */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Education</h2>
          </div>
          {editingSection !== 'education' ? (
            <button onClick={() => startEditing('education')} className="text-primary-600 hover:text-primary-700">
              <Edit2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditingSection(null)} className="text-slate-500 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
              <button onClick={saveSection} className="text-green-600 hover:text-green-700">
                <Check className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div className="p-6">
          {editingSection === 'education' ? (
            <div className="space-y-4">
              {(formData.education || []).map(edu => (
                <div key={edu.id} className="p-4 bg-slate-50 rounded-lg">
                  <p className="font-medium">{edu.degree} in {edu.field}</p>
                  <p className="text-sm text-slate-600">{edu.school} - {edu.graduation_year}</p>
                </div>
              ))}
              {newEducation ? (
                <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="School/University"
                      value={newEducation.school || ''}
                      onChange={e => setNewEducation({ ...newEducation, school: e.target.value })}
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <input
                      placeholder="Degree (BSN, ADN, MSN, etc.)"
                      value={newEducation.degree || ''}
                      onChange={e => setNewEducation({ ...newEducation, degree: e.target.value })}
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <input
                      placeholder="Field of Study"
                      value={newEducation.field || ''}
                      onChange={e => setNewEducation({ ...newEducation, field: e.target.value })}
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <input
                      type="number"
                      placeholder="Graduation Year"
                      value={newEducation.graduation_year || ''}
                      onChange={e => setNewEducation({ ...newEducation, graduation_year: parseInt(e.target.value) })}
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addEducation} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">Add</button>
                    <button onClick={() => setNewEducation(null)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setNewEducation({})}
                  className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:text-slate-700 hover:border-slate-400 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Education
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {(profile?.education || []).map(edu => (
                <div key={edu.id} className="flex gap-4">
                  <div className="w-2 h-2 bg-primary-500 rounded-full mt-2" />
                  <div>
                    <p className="font-medium">{edu.degree} in {edu.field}</p>
                    <p className="text-sm text-slate-600">{edu.school} - {edu.graduation_year}</p>
                  </div>
                </div>
              ))}
              {(!profile?.education || profile.education.length === 0) && (
                <p className="text-slate-400 text-center py-4">No education added</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Professional Summary */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Professional Summary</h2>
          </div>
          {editingSection !== 'summary' ? (
            <button onClick={() => startEditing('summary')} className="text-primary-600 hover:text-primary-700">
              <Edit2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditingSection(null)} className="text-slate-500 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
              <button onClick={saveSection} className="text-green-600 hover:text-green-700">
                <Check className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div className="p-6">
          {editingSection === 'summary' ? (
            <textarea
              value={formData.summary || ''}
              onChange={e => setFormData({ ...formData, summary: e.target.value })}
              placeholder="Write a brief professional summary highlighting your experience, skills, and career goals..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              rows={5}
            />
          ) : (
            <p className="text-slate-600">
              {profile?.summary || 'No summary added. A professional summary helps employers understand your background.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
