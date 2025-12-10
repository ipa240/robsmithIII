import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import Facilities from './pages/Facilities'
import FacilityDetail from './pages/FacilityDetail'
import Compare from './pages/Compare'
import Dashboard from './pages/Dashboard'
import Onboarding from './pages/Onboarding'
import Profile from './pages/Profile'
import SavedJobs from './pages/SavedJobs'
import Sully from './pages/Sully'
import Billing from './pages/Billing'
import Notifications from './pages/Notifications'
import Admin from './pages/Admin'
import Support from './pages/Support'
import HR from './pages/HR'
import ProfileBuilder from './pages/ProfileBuilder'
import ResumeBuilder from './pages/ResumeBuilder'
import Applications from './pages/Applications'
import Community from './pages/Community'
import Learning from './pages/Learning'
import News from './pages/News'
import Scoring from './pages/Scoring'
import Map from './pages/Map'
import Trends from './pages/Trends'
import Results from './pages/Results'
import Callback from './pages/Callback'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import Goodbye from './pages/Goodbye'
import ProtectedRoute from './components/ProtectedRoute'
import PublicLayout from './components/PublicLayout'

function App() {
  return (
    <Routes>
      {/* Public routes - landing, callback, legal pages */}
      <Route path="/" element={<Landing />} />
      <Route path="/callback" element={<Callback />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/goodbye" element={<Goodbye />} />

      {/* Public browsing - no login required (includes pages with blur overlays for premium features) */}
      <Route element={<PublicLayout />}>
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/facilities" element={<Facilities />} />
        <Route path="/facilities/:id" element={<FacilityDetail />} />
        <Route path="/map" element={<Map />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/sully" element={<Sully />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/learn" element={<Learning />} />
        <Route path="/news" element={<News />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/resume" element={<ResumeBuilder />} />
        <Route path="/community" element={<Community />} />
        <Route path="/scoring" element={<Scoring />} />
        <Route path="/saved" element={<SavedJobs />} />
        <Route path="/support" element={<Support />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/billing" element={<Billing />} />
      </Route>

      {/* Protected routes - require login */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/hr" element={<HR />} />
        <Route path="/profile/edit" element={<ProfileBuilder />} />
        <Route path="/results" element={<Results />} />
      </Route>
    </Routes>
  )
}

export default App
