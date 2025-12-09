export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-slate-900 mb-6">Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last Updated: December 7, 2025</p>

      <div className="prose prose-slate max-w-none">
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">1. Introduction</h2>
          <p className="text-slate-600 mb-4">
            VANurses ("we," "our," or "us") respects your privacy and is committed to protecting your
            personal information. This Privacy Policy explains how we collect, use, disclose, and
            safeguard your information when you use our Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">2. Information We Collect</h2>

          <h3 className="text-lg font-medium text-slate-700 mb-3">2.1 Account Information</h3>
          <ul className="list-disc list-inside text-slate-600 space-y-2 mb-4">
            <li>Name and email address</li>
            <li>Professional credentials (nursing license, certifications)</li>
            <li>Work experience and preferences</li>
            <li>Resume and profile information</li>
          </ul>

          <h3 className="text-lg font-medium text-slate-700 mb-3">2.2 Usage Data</h3>
          <ul className="list-disc list-inside text-slate-600 space-y-2 mb-4">
            <li>Job searches and saved preferences</li>
            <li>Facility views and comparisons</li>
            <li>Application history</li>
            <li>Device and browser information</li>
          </ul>

          <h3 className="text-lg font-medium text-slate-700 mb-3">2.3 AI Interaction Data</h3>
          <p className="text-slate-600 mb-4">
            When you use Sully (our AI assistant), we collect:
          </p>
          <ul className="list-disc list-inside text-slate-600 space-y-2">
            <li>Conversation history (stored for service improvement)</li>
            <li>Selected personality mode preferences</li>
            <li>Questions and topics discussed</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">3. How We Use Your Information</h2>
          <ul className="list-disc list-inside text-slate-600 space-y-2">
            <li>To provide and maintain the Service</li>
            <li>To match you with relevant job opportunities</li>
            <li>To personalize your experience and recommendations</li>
            <li>To improve our AI assistant's responses</li>
            <li>To send job alerts and notifications (with your consent)</li>
            <li>To communicate important service updates</li>
            <li>To analyze usage patterns and improve features</li>
          </ul>
        </section>

        <section className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-800 mb-4">4. AI & Data Processing</h2>

          <h3 className="text-lg font-medium text-blue-700 mb-3">4.1 Self-Hosted AI</h3>
          <p className="text-slate-700 mb-4">
            Our AI assistant (Sully) runs on self-hosted infrastructure. Your conversations are:
          </p>
          <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4">
            <li>Processed on our private servers, not sent to third-party AI providers</li>
            <li>Not used to train external AI models</li>
            <li>Stored securely with encryption at rest</li>
          </ul>

          <h3 className="text-lg font-medium text-blue-700 mb-3">4.2 Conversation Privacy</h3>
          <p className="text-slate-700 mb-4">
            While we retain conversation history to improve the service, conversations in "No Filter"
            mode are treated with additional discretion. We do not share individual conversation
            content with third parties or use it for advertising purposes.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">5. Information Sharing</h2>
          <p className="text-slate-600 mb-4">We may share your information with:</p>
          <ul className="list-disc list-inside text-slate-600 space-y-2">
            <li>
              <strong>Employers:</strong> When you apply for jobs, relevant profile information is
              shared with the hiring facility.
            </li>
            <li>
              <strong>Service Providers:</strong> Third parties who help us operate the Service
              (hosting, email delivery, analytics).
            </li>
            <li>
              <strong>Legal Requirements:</strong> When required by law or to protect our rights.
            </li>
          </ul>
          <p className="text-slate-600 mt-4">
            We do NOT sell your personal information to advertisers or data brokers.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">6. Data Security</h2>
          <p className="text-slate-600 mb-4">
            We implement industry-standard security measures including:
          </p>
          <ul className="list-disc list-inside text-slate-600 space-y-2">
            <li>SSL/TLS encryption for data in transit</li>
            <li>Encryption at rest for sensitive data</li>
            <li>Regular security audits and updates</li>
            <li>Access controls and authentication requirements</li>
            <li>Multi-factor authentication support</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">7. Your Rights</h2>
          <p className="text-slate-600 mb-4">You have the right to:</p>
          <ul className="list-disc list-inside text-slate-600 space-y-2">
            <li>Access your personal information</li>
            <li>Correct inaccurate information</li>
            <li>Delete your account and associated data</li>
            <li>Export your data in a portable format</li>
            <li>Opt out of marketing communications</li>
            <li>Request deletion of AI conversation history</li>
          </ul>
          <p className="text-slate-600 mt-4">
            To exercise these rights, contact us at{' '}
            <a href="mailto:privacy@vanurses.net" className="text-primary-600 hover:underline">
              privacy@vanurses.net
            </a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">8. Cookies & Tracking</h2>
          <p className="text-slate-600 mb-4">
            We use cookies and similar technologies for:
          </p>
          <ul className="list-disc list-inside text-slate-600 space-y-2">
            <li>Authentication and session management</li>
            <li>Remembering your preferences</li>
            <li>Analytics to improve the Service</li>
          </ul>
          <p className="text-slate-600 mt-4">
            You can control cookie preferences through your browser settings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">9. Data Retention</h2>
          <p className="text-slate-600 mb-4">
            We retain your information for as long as your account is active or as needed to provide
            services. After account deletion, we may retain anonymized data for analytics purposes.
            AI conversation logs are retained for up to 90 days unless you request earlier deletion.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">10. Children's Privacy</h2>
          <p className="text-slate-600 mb-4">
            The Service is not intended for users under 18 years of age. We do not knowingly collect
            information from minors. The "No Filter" AI mode is strictly for adult users.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">11. Changes to This Policy</h2>
          <p className="text-slate-600 mb-4">
            We may update this Privacy Policy periodically. We will notify you of material changes
            via email or through the Service. Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">12. Contact Us</h2>
          <p className="text-slate-600">
            For privacy-related questions or requests:{' '}
            <a href="mailto:privacy@vanurses.net" className="text-primary-600 hover:underline">
              privacy@vanurses.net
            </a>
          </p>
          <p className="text-slate-600 mt-2">
            VANurses<br />
            Virginia, USA
          </p>
        </section>
      </div>
    </div>
  )
}
