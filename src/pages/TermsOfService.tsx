import { Layout } from "../components/layout/Layout";

export function TermsOfService() {
  return (
    <Layout showBack backTo="/">
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-4">Terms of Service</h1>
          <p className="text-sm text-slate-500 mb-6">Last updated: July 22, 2026</p>

          <div className="prose prose-sm text-slate-600 space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing Global Social Media Dashboard, you agree to these Terms of Service.
                If you do not agree, do not use the service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">2. Description of Service</h2>
              <p>
                Global Social Media Dashboard provides analytics and follower tracking across
                multiple social media platforms. The service aggregates data from connected
                accounts and displays it in a unified dashboard.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">3. User Responsibilities</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>You must have valid accounts on connected social media platforms</li>
                <li>You are responsible for maintaining the security of your dashboard account</li>
                <li>You must comply with each platform's terms of service when connecting accounts</li>
                <li>You must not use the service for any illegal or unauthorized purpose</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">4. Platform Compliance</h2>
              <p>
                Your use of connected platforms is governed by their respective terms:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Facebook/Instagram: Meta Platform Terms</li>
                <li>YouTube: Google Terms of Service</li>
                <li>TikTok: TikTok Terms of Service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">5. Data Accuracy</h2>
              <p>
                We strive to display accurate analytics, but data may be subject to delays
                or inaccuracies based on platform API limitations. We are not responsible for
                discrepancies between our dashboard and platform native analytics.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">6. Service Availability</h2>
              <p>
                We may modify, suspend, or discontinue the service at any time without notice.
                We are not liable for any interruption or data loss.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">7. Limitation of Liability</h2>
              <p>
                Global Social Media Dashboard is provided "as is" without warranties. We are not
                liable for any indirect, incidental, or consequential damages arising from use
                of the service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">8. Termination</h2>
              <p>
                We may terminate your access to the service at any time for violation of these
                terms. You may disconnect your accounts and stop using the service at any time.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">9. Changes to Terms</h2>
              <p>
                We reserve the right to update these terms at any time. Continued use of the
                service constitutes acceptance of updated terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">10. Contact</h2>
              <p>
                For questions about these Terms, contact us at support@example.com.
              </p>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
