import { Lock, TrendingUp, TrendingDown, Users, DollarSign, Clock, Heart, Car } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { useSubscription } from '../hooks/useSubscription'

interface FacilityAnalyticsProps {
  facilityId: string
  facilityName: string
}

// Sample data for visualizations
const staffingData = [
  { month: 'Jul', ratio: 4.2 },
  { month: 'Aug', ratio: 4.5 },
  { month: 'Sep', ratio: 4.3 },
  { month: 'Oct', ratio: 4.8 },
  { month: 'Nov', ratio: 4.6 },
  { month: 'Dec', ratio: 4.4 },
]

const salaryData = [
  { role: 'RN', facility: 38, regional: 35, state: 34 },
  { role: 'ICU', facility: 45, regional: 42, state: 40 },
  { role: 'ER', facility: 42, regional: 40, state: 38 },
  { role: 'OR', facility: 48, regional: 45, state: 43 },
  { role: 'L&D', facility: 40, regional: 38, state: 36 },
]

const outcomeData = [
  { month: 'Jul', readmission: 12, infection: 2.1, falls: 1.8 },
  { month: 'Aug', readmission: 11, infection: 1.9, falls: 1.6 },
  { month: 'Sep', readmission: 10, infection: 1.8, falls: 1.5 },
  { month: 'Oct', readmission: 9, infection: 1.7, falls: 1.4 },
  { month: 'Nov', readmission: 9, infection: 1.6, falls: 1.3 },
  { month: 'Dec', readmission: 8, infection: 1.5, falls: 1.2 },
]

const turnoverData = [
  { year: '2021', rate: 28 },
  { year: '2022', rate: 25 },
  { year: '2023', rate: 22 },
  { year: '2024', rate: 18 },
]

export default function FacilityAnalytics({ facilityId, facilityName }: FacilityAnalyticsProps) {
  const { isProOrAbove, isPremiumOrAbove } = useSubscription()

  // Show locked state for non-premium users
  if (!isProOrAbove) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            Premium Analytics
          </h2>
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
            <Lock className="w-3 h-3" />
            Pro
          </span>
        </div>

        {/* Blurred Preview */}
        <div className="relative">
          <div className="blur-sm pointer-events-none select-none">
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div className="h-32 bg-slate-100 rounded-lg"></div>
              <div className="h-32 bg-slate-100 rounded-lg"></div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="h-32 bg-slate-100 rounded-lg"></div>
              <div className="h-32 bg-slate-100 rounded-lg"></div>
            </div>
          </div>

          {/* Upgrade CTA */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 max-w-sm text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Unlock Deep Analytics</h3>
              <p className="text-sm text-slate-600 mb-4">
                Get staffing trends, salary comparisons, patient outcomes, and more for {facilityName}.
              </p>
              <ul className="text-left text-sm text-slate-600 space-y-2 mb-4">
                <li className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary-500" />
                  Nurse-to-patient ratios over time
                </li>
                <li className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  Salary vs. regional & state averages
                </li>
                <li className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-500" />
                  Patient outcome metrics
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Staff turnover analysis
                </li>
              </ul>
              <Link
                to="/billing"
                className="block w-full px-4 py-2 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-lg font-medium hover:from-primary-700 hover:to-accent-700 transition-all"
              >
                Upgrade to Pro - $19/mo
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-600" />
          Premium Analytics
        </h2>
        <span className="text-xs text-slate-500">Updated daily</span>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Staffing Ratios */}
        <div className="border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-primary-500" />
            <h3 className="font-medium text-slate-900">Nurse-to-Patient Ratio</h3>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold text-slate-900">1:4.4</span>
            <span className="flex items-center text-sm text-emerald-600">
              <TrendingDown className="w-4 h-4" />
              Improving
            </span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={staffingData}>
                <defs>
                  <linearGradient id="staffGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="ratio" stroke="#6366f1" fill="url(#staffGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500 mt-2">Lower is better. State avg: 1:5.2</p>
        </div>

        {/* Salary Comparison */}
        <div className="border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <h3 className="font-medium text-slate-900">Salary Comparison ($/hr)</h3>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salaryData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="role" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip />
                <Bar dataKey="facility" fill="#10b981" name="This Facility" radius={[0, 4, 4, 0]} />
                <Bar dataKey="regional" fill="#94a3b8" name="Regional Avg" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 text-xs mt-2">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-emerald-500"></div>
              This Facility
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-slate-400"></div>
              Regional Avg
            </span>
          </div>
        </div>

        {/* Patient Outcomes */}
        <div className="border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-red-500" />
            <h3 className="font-medium text-slate-900">Patient Outcomes</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center">
              <div className="text-lg font-bold text-slate-900">8%</div>
              <div className="text-xs text-slate-500">Readmit</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-slate-900">1.5%</div>
              <div className="text-xs text-slate-500">HAI Rate</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-slate-900">1.2</div>
              <div className="text-xs text-slate-500">Falls/1k</div>
            </div>
          </div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={outcomeData}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="readmission" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="infection" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-emerald-500" />
            All metrics improving vs. last year
          </p>
        </div>

        {/* Turnover Rate */}
        <div className="border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="font-medium text-slate-900">Staff Turnover Rate</h3>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold text-slate-900">18%</span>
            <span className="flex items-center text-sm text-emerald-600">
              <TrendingDown className="w-4 h-4" />
              -10% YoY
            </span>
          </div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={turnoverData}>
                <XAxis dataKey="year" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="rate" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500 mt-2">National avg: 27%. Lower is better.</p>
        </div>
      </div>

      {/* Premium-only feature for Premium tier */}
      {isPremiumOrAbove && (
        <div className="mt-6 p-4 bg-gradient-to-r from-primary-50 to-accent-50 rounded-lg border border-primary-100">
          <div className="flex items-center gap-2 mb-2">
            <Car className="w-4 h-4 text-primary-600" />
            <h3 className="font-medium text-slate-900">Commute Analysis</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-slate-900">12 min</div>
              <div className="text-xs text-slate-500">From Richmond</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">25 min</div>
              <div className="text-xs text-slate-500">From Short Pump</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">35 min</div>
              <div className="text-xs text-slate-500">From Midlothian</div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3 text-center">
            Estimated drive times during typical shift change hours (6:30 AM / 6:30 PM)
          </p>
        </div>
      )}
    </div>
  )
}
