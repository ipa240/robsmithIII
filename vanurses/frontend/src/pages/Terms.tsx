import { SEO } from '../components/SEO'

export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <SEO
        title="Terms of Service"
        description="VANurses Terms of Service. Read our terms and conditions for using the VANurses nursing job platform and AI assistant."
        canonical="https://vanurses.net/terms"
      />
      <h1 className="text-3xl font-bold text-slate-900 mb-6">Terms of Service</h1>
      <p className="text-sm text-slate-500 mb-8">Last Updated: December 7, 2025</p>

      <div className="prose prose-slate max-w-none">
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">1. Acceptance of Terms</h2>
          <p className="text-slate-600 mb-4">
            By accessing or using VANurses ("the Service"), you agree to be bound by these Terms of Service.
            If you do not agree to these terms, please do not use the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">2. Service Description</h2>
          <p className="text-slate-600 mb-4">
            VANurses is a job search and career platform for nursing professionals in Virginia. The Service
            provides job listings, facility information, career resources, and AI-powered assistance features.
          </p>
        </section>

        <section className="mb-8 bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-amber-800 mb-4">3. AI Assistant ("Sully") - Important Disclosure</h2>

          <h3 className="text-lg font-medium text-amber-700 mb-3">3.1 About Sully</h3>
          <p className="text-slate-700 mb-4">
            VANurses includes an AI-powered career assistant named "Sully" that can help answer questions
            about nursing jobs, facilities, and career guidance. Sully operates with multiple personality
            modes to serve diverse user preferences.
          </p>

          <h3 className="text-lg font-medium text-amber-700 mb-3">3.2 "No Filter" Mode</h3>
          <div className="bg-amber-100 border-l-4 border-amber-500 p-4 mb-4">
            <p className="text-slate-800 font-medium mb-2">CONTENT WARNING:</p>
            <p className="text-slate-700">
              Sully includes a "No Filter" personality mode that provides unfiltered, blunt, and potentially
              vulgar responses. This mode may contain strong language, adult themes, and brutally honest
              opinions. Users who select this mode do so at their own discretion.
            </p>
          </div>

          <h3 className="text-lg font-medium text-amber-700 mb-3">3.3 Unrestricted AI Models</h3>
          <p className="text-slate-700 mb-4">
            Unlike many public AI services that impose strict content moderation, VANurses utilizes
            self-hosted, unrestricted AI language models. This architectural choice reflects our commitment
            to providing authentic, uncensored communication. Key points:
          </p>
          <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4">
            <li>
              <strong>Freedom of Expression:</strong> We believe adults should have access to unfiltered
              AI assistance without corporate censorship limiting honest discourse.
            </li>
            <li>
              <strong>Self-Hosted Models:</strong> Our AI runs on private infrastructure, not subject to
              the content policies of major cloud AI providers.
            </li>
            <li>
              <strong>User Choice:</strong> You control the personality mode. Default modes (Friendly,
              Neutral, Stern) maintain professional language. "No Filter" mode removes these constraints.
            </li>
            <li>
              <strong>Not for Minors:</strong> The "No Filter" mode is intended for adult users only.
              By using this feature, you confirm you are at least 18 years of age.
            </li>
          </ul>

          <h3 className="text-lg font-medium text-amber-700 mb-3">3.4 AI Limitations</h3>
          <p className="text-slate-700 mb-4">
            Sully is an AI assistant, not a licensed professional. Information provided is for general
            guidance only and should not be considered medical, legal, or professional advice. Always
            verify important information through official channels.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">4. User Accounts</h2>
          <p className="text-slate-600 mb-4">
            You are responsible for maintaining the confidentiality of your account credentials and for
            all activities that occur under your account. You must provide accurate information during
            registration and keep your profile information current.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">5. Acceptable Use</h2>
          <p className="text-slate-600 mb-4">You agree not to:</p>
          <ul className="list-disc list-inside text-slate-600 space-y-2">
            <li>Use the Service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to any portion of the Service</li>
            <li>Submit false or misleading information</li>
            <li>Harass, abuse, or harm other users</li>
            <li>Scrape or collect data without permission</li>
            <li>Interfere with the proper functioning of the Service</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">6. Job Listings & Facility Information</h2>
          <p className="text-slate-600 mb-4">
            Job listings and facility information are sourced from various sources and provided for
            informational purposes. VANurses does not guarantee the accuracy, completeness, or availability
            of any listing. The OFS (Optimal Facility Score) is a proprietary rating system based on
            publicly available data and should be used as one factor among many in your decision-making.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">7. User-Generated Content</h2>
          <p className="text-slate-600 mb-4">
            Content you submit through the Community forum, facility reviews, or other features remains
            your responsibility. You grant VANurses a non-exclusive license to display and distribute
            such content on the platform. We reserve the right to remove content that violates these terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">8. Intellectual Property</h2>
          <p className="text-slate-600 mb-4">
            The Service, including its original content, features, and functionality, is owned by VANurses
            and protected by copyright, trademark, and other intellectual property laws. "Sully" and the
            Sully character are trademarks of VANurses.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">9. Disclaimer of Warranties</h2>
          <p className="text-slate-600 mb-4">
            THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT
            WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE. AI-GENERATED CONTENT
            MAY CONTAIN ERRORS OR INACCURACIES.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">10. Limitation of Liability</h2>
          <p className="text-slate-600 mb-4">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, VANURSES SHALL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE,
            INCLUDING BUT NOT LIMITED TO DAMAGES RESULTING FROM AI-GENERATED CONTENT OR CAREER DECISIONS
            MADE BASED ON INFORMATION PROVIDED THROUGH THE SERVICE.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">11. Changes to Terms</h2>
          <p className="text-slate-600 mb-4">
            We reserve the right to modify these terms at any time. Continued use of the Service after
            changes constitutes acceptance of the new terms. We will notify users of material changes
            via email or through the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">12. Governing Law</h2>
          <p className="text-slate-600 mb-4">
            These terms shall be governed by the laws of the Commonwealth of Virginia, without regard
            to conflict of law principles.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">13. Contact</h2>
          <p className="text-slate-600">
            Questions about these Terms of Service may be directed to:{' '}
            <a href="mailto:legal@vanurses.net" className="text-primary-600 hover:underline">
              legal@vanurses.net
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
