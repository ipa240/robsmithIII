import { Link } from 'react-router-dom'
import {
  Shield, DollarSign, Star, MapPin, Heart, Briefcase,
  Users, Clock, Sun, Eye, ChevronRight, Award, BarChart3,
  Database, CheckCircle, HelpCircle
} from 'lucide-react'

const INDICES = [
  {
    id: 'pci',
    name: 'Pay Competitiveness',
    abbr: 'PCI',
    icon: DollarSign,
    color: 'emerald',
    description: 'Analyzes how competitive pay rates are compared to regional and national benchmarks',
    factors: ['Base hourly rates', 'Shift differentials', 'Bonus structures', 'Sign-on incentives']
  },
  {
    id: 'eri',
    name: 'Employee Reviews',
    abbr: 'ERI',
    icon: Star,
    color: 'amber',
    description: 'Aggregates employee sentiment from multiple trusted review platforms',
    factors: ['Overall satisfaction', 'Work-life balance', 'Management quality', 'Career growth']
  },
  {
    id: 'lssi',
    name: 'Location Safety',
    abbr: 'LSSI',
    icon: Shield,
    color: 'blue',
    description: 'Evaluates neighborhood safety using official crime statistics and community data',
    factors: ['Violent crime rates', 'Property crime', 'Night safety', 'Parking security']
  },
  {
    id: 'pei',
    name: 'Patient Experience',
    abbr: 'PEI',
    icon: Heart,
    color: 'rose',
    description: 'Based on official CMS HCAHPS scores measuring patient satisfaction',
    factors: ['Nurse communication', 'Care quality', 'Responsiveness', 'Cleanliness']
  },
  {
    id: 'fsi',
    name: 'Facility Statistics',
    abbr: 'FSI',
    icon: Briefcase,
    color: 'purple',
    description: 'Analyzes operational metrics that impact your work environment',
    factors: ['Bed capacity', 'Staffing ratios', 'Readmission rates', 'Certifications']
  },
  {
    id: 'ali',
    name: 'Amenities & Lifestyle',
    abbr: 'ALI',
    icon: MapPin,
    color: 'cyan',
    description: 'Measures convenience and quality of life near the facility',
    factors: ['Restaurants nearby', 'Shopping options', 'Childcare access', 'Gym facilities']
  },
  {
    id: 'jti',
    name: 'Job Transparency',
    abbr: 'JTI',
    icon: Eye,
    color: 'indigo',
    description: 'Scores how transparent and complete job postings are',
    factors: ['Pay disclosure', 'Benefits clarity', 'Requirements detail', 'Schedule info']
  },
  {
    id: 'csi',
    name: 'Commute Stress',
    abbr: 'CSI',
    icon: Clock,
    color: 'orange',
    description: 'Evaluates traffic patterns and accessibility for your commute',
    factors: ['Rush hour traffic', 'Public transit', 'Parking availability', 'Highway access']
  },
  {
    id: 'qli',
    name: 'Quality of Life',
    abbr: 'QLI',
    icon: Users,
    color: 'teal',
    description: 'Assesses community demographics and living conditions',
    factors: ['Cost of living', 'School ratings', 'Healthcare access', 'Housing market']
  },
  {
    id: 'cci',
    name: 'Climate Comfort',
    abbr: 'CCI',
    icon: Sun,
    color: 'yellow',
    description: 'Considers weather patterns and seasonal conditions',
    factors: ['Temperature range', 'Precipitation', 'Severe weather', 'Outdoor days']
  },
]

const GRADE_SCALE = [
  { grade: 'A+', range: '97-100', color: 'bg-emerald-500' },
  { grade: 'A', range: '93-96', color: 'bg-emerald-400' },
  { grade: 'A-', range: '90-92', color: 'bg-emerald-300' },
  { grade: 'B+', range: '87-89', color: 'bg-green-400' },
  { grade: 'B', range: '83-86', color: 'bg-green-300' },
  { grade: 'B-', range: '80-82', color: 'bg-lime-300' },
  { grade: 'C+', range: '77-79', color: 'bg-yellow-300' },
  { grade: 'C', range: '73-76', color: 'bg-yellow-400' },
  { grade: 'C-', range: '70-72', color: 'bg-amber-400' },
  { grade: 'D+', range: '67-69', color: 'bg-orange-400' },
  { grade: 'D', range: '63-66', color: 'bg-orange-500' },
  { grade: 'D-', range: '60-62', color: 'bg-red-400' },
  { grade: 'F', range: '0-59', color: 'bg-red-500' },
]

const DATA_SOURCES = [
  { name: 'Bureau of Labor Statistics', type: 'Salary Data' },
  { name: 'CMS HCAHPS', type: 'Patient Experience' },
  { name: 'FBI Crime Statistics', type: 'Safety Data' },
  { name: 'Employee Review Platforms', type: 'Workplace Culture' },
  { name: 'Census Bureau', type: 'Demographics' },
  { name: 'Virginia Health Department', type: 'Facility Data' },
  { name: 'Job Posting Analysis', type: 'Transparency' },
  { name: 'Traffic & Transit APIs', type: 'Commute Data' },
]

const FAQ = [
  {
    q: 'How often are scores updated?',
    a: 'Scores are recalculated weekly as new data becomes available. Major data sources like HCAHPS are updated quarterly.'
  },
  {
    q: 'Can facilities dispute their scores?',
    a: 'Facilities can submit corrections for factual errors. However, scores reflect aggregated public data and cannot be influenced.'
  },
  {
    q: 'Why might a good hospital have a low score?',
    a: 'Our scoring focuses on the nursing work experience, not just clinical reputation. A renowned hospital may score lower on commute, safety, or work-life balance factors.'
  },
  {
    q: 'Are the exact formulas public?',
    a: 'To maintain scoring integrity and prevent gaming, exact weightings are proprietary. We disclose the factors considered for transparency.'
  },
]

export default function Scoring() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-primary-600 to-accent-600 rounded-2xl p-8 md:p-12 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-10" />
        <div className="relative max-w-3xl">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-10 h-10" />
            <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
              Our Methodology
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            The VANurses Scoring System
          </h1>
          <p className="text-lg text-primary-100 mb-6">
            We analyze <strong>10 key dimensions</strong> of what makes a nursing workplace
            exceptional. Each facility receives a grade from A+ to F based on our
            comprehensive, data-driven analysis.
          </p>
          <Link
            to="/facilities"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary-700 rounded-lg font-medium hover:bg-primary-50 transition-colors"
          >
            Explore Facilities
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Grade Scale */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-primary-600" />
          Grade Scale
        </h2>
        <p className="text-slate-600 mb-6">
          The Overall Facility Score (OFS) is converted to a letter grade for easy comparison.
        </p>
        <div className="flex flex-wrap gap-2">
          {GRADE_SCALE.map(g => (
            <div key={g.grade} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
              <div className={`w-8 h-8 ${g.color} rounded-lg flex items-center justify-center text-white font-bold text-sm`}>
                {g.grade}
              </div>
              <span className="text-sm text-slate-600">{g.range}</span>
            </div>
          ))}
        </div>
      </div>

      {/* The 10 Indices */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">What We Measure</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {INDICES.map(idx => {
            const Icon = idx.icon
            const colorMap: Record<string, string> = {
              emerald: 'bg-emerald-100 text-emerald-700',
              amber: 'bg-amber-100 text-amber-700',
              blue: 'bg-blue-100 text-blue-700',
              rose: 'bg-rose-100 text-rose-700',
              purple: 'bg-purple-100 text-purple-700',
              cyan: 'bg-cyan-100 text-cyan-700',
              indigo: 'bg-indigo-100 text-indigo-700',
              orange: 'bg-orange-100 text-orange-700',
              teal: 'bg-teal-100 text-teal-700',
              yellow: 'bg-yellow-100 text-yellow-700',
            }
            return (
              <div key={idx.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${colorMap[idx.color]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900">{idx.name}</h3>
                      <span className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-500">{idx.abbr}</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{idx.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {idx.factors.map(f => (
                        <span key={f} className="text-xs px-2 py-1 bg-slate-50 text-slate-500 rounded">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Data Sources */}
      <div className="bg-slate-900 rounded-xl p-8 text-white">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-6 h-6 text-primary-400" />
          <h2 className="text-xl font-bold">Our Data Sources</h2>
        </div>
        <p className="text-slate-300 mb-6 max-w-2xl">
          We aggregate data from trusted government sources, official healthcare databases,
          and reputable third-party platforms to ensure accuracy and objectivity.
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {DATA_SOURCES.map(src => (
            <div key={src.name} className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium">{src.name}</span>
              </div>
              <span className="text-xs text-slate-400">{src.type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Why Trust Us */}
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Why Trust Our Scores?</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Database className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Data-Driven</h3>
            <p className="text-sm text-slate-600">
              Every score is backed by real data, not opinions. We analyze millions of data points weekly.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Independent</h3>
            <p className="text-sm text-slate-600">
              We don't accept payment for higher scores. Facilities cannot influence their ratings.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Heart className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Nurse-Focused</h3>
            <p className="text-sm text-slate-600">
              Our methodology prioritizes what matters to nurses, not just clinical reputation.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <HelpCircle className="w-5 h-5 text-primary-600" />
          <h2 className="text-xl font-bold text-slate-900">Frequently Asked Questions</h2>
        </div>
        <div className="space-y-4">
          {FAQ.map((item, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900 mb-2">{item.q}</h3>
              <p className="text-slate-600">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-primary-50 to-accent-50 rounded-xl p-8 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-3">
          Ready to Find Your Perfect Workplace?
        </h2>
        <p className="text-slate-600 mb-6 max-w-xl mx-auto">
          Explore Virginia healthcare facilities ranked by our comprehensive scoring system.
        </p>
        <Link
          to="/facilities"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          View Facility Rankings
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
