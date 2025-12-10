import { useAuth } from 'react-oidc-context'
import { FileText, Mail, Phone, MapPin, Briefcase, GraduationCap, Award, Download, Edit2 } from 'lucide-react'
import { useSubscription, isAdminUnlocked } from '../hooks/useSubscription'
import BlurOverlay from '../components/BlurOverlay'

export default function ResumeBuilder() {
  const auth = useAuth()
  const { isPaid } = useSubscription()
  const canAccessFeature = (auth.isAuthenticated && isPaid) || isAdminUnlocked()

  // Sample resume data
  const sampleResume = {
    name: 'Sarah Johnson, BSN, RN',
    title: 'Registered Nurse - ICU Specialist',
    email: 'sarah.johnson@email.com',
    phone: '(555) 123-4567',
    location: 'Richmond, VA',
    summary: 'Compassionate and detail-oriented ICU nurse with 5+ years of experience in critical care settings. Proven ability to manage complex patient cases, lead interdisciplinary teams, and implement evidence-based practices. Strong communication skills with patients, families, and healthcare providers.',
    experience: [
      {
        title: 'ICU Registered Nurse',
        company: 'VCU Medical Center',
        dates: 'Jan 2021 - Present',
        bullets: [
          'Provide direct patient care for up to 4 critically ill patients in a 32-bed medical ICU',
          'Collaborate with physicians, pharmacists, and respiratory therapists in daily patient rounds',
          'Precept and mentor new graduate nurses during their ICU orientation',
          'Achieved 98% patient satisfaction scores through compassionate care delivery',
        ]
      },
      {
        title: 'Med-Surg Registered Nurse',
        company: 'Bon Secours Richmond',
        dates: 'Jun 2019 - Dec 2020',
        bullets: [
          'Managed care for 5-6 patients per shift on a 36-bed medical-surgical unit',
          'Administered medications, monitored vital signs, and documented patient progress',
          'Coordinated discharge planning with case managers and social workers',
        ]
      }
    ],
    education: [
      { degree: 'Bachelor of Science in Nursing (BSN)', school: 'Virginia Commonwealth University', year: '2019' },
      { degree: 'BLS, ACLS, CCRN Certifications', school: 'American Heart Association', year: '2021' },
    ],
    skills: ['Critical Care', 'Ventilator Management', 'EPIC EMR', 'Patient Assessment', 'IV Therapy', 'Code Response', 'Family Education', 'Team Leadership']
  }

  if (!canAccessFeature) {
    return (
      <BlurOverlay
        title="AI Resume Builder"
        description="Create professional nursing resumes tailored to specific job postings. Upgrade to access this premium feature."
        showDemo
        demoKey="resume"
        showPricing
        blurIntensity="light"
      >
        <div className="max-w-4xl mx-auto">
          {/* Toolbar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary-600" />
              <span className="font-medium text-slate-900">Resume Builder</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600">
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg">
                <Download className="w-4 h-4" />
                Export PDF
              </button>
            </div>
          </div>

          {/* Resume Preview */}
          <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            {/* Header */}
            <div className="text-center border-b border-slate-200 pb-6 mb-6">
              <h1 className="text-2xl font-bold text-slate-900 mb-1">{sampleResume.name}</h1>
              <p className="text-primary-600 font-medium mb-3">{sampleResume.title}</p>
              <div className="flex items-center justify-center gap-4 text-sm text-slate-600">
                <span className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {sampleResume.email}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  {sampleResume.phone}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {sampleResume.location}
                </span>
              </div>
            </div>

            {/* Summary */}
            <div className="mb-6">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Professional Summary</h2>
              <p className="text-slate-600 text-sm leading-relaxed">{sampleResume.summary}</p>
            </div>

            {/* Experience */}
            <div className="mb-6">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Experience
              </h2>
              {sampleResume.experience.map((job, idx) => (
                <div key={idx} className="mb-4 last:mb-0">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <p className="font-semibold text-slate-900">{job.title}</p>
                      <p className="text-sm text-slate-600">{job.company}</p>
                    </div>
                    <span className="text-sm text-slate-500">{job.dates}</span>
                  </div>
                  <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 ml-2">
                    {job.bullets.map((bullet, i) => (
                      <li key={i}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Education */}
            <div className="mb-6">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Education & Certifications
              </h2>
              {sampleResume.education.map((edu, idx) => (
                <div key={idx} className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{edu.degree}</p>
                    <p className="text-sm text-slate-600">{edu.school}</p>
                  </div>
                  <span className="text-sm text-slate-500">{edu.year}</span>
                </div>
              ))}
            </div>

            {/* Skills */}
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Award className="w-4 h-4" />
                Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {sampleResume.skills.map((skill, idx) => (
                  <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </BlurOverlay>
    )
  }

  // Full feature for paid users would go here
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-600 mb-4">
          <FileText className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Resume Builder</h1>
        <p className="text-slate-600 mb-6">Create and manage your professional nursing resume.</p>
        <p className="text-sm text-slate-500">Full resume builder coming soon! Check back for updates.</p>
      </div>
    </div>
  )
}
