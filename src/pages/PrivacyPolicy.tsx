import { Layout } from "../components/layout/Layout";

export function PrivacyPolicy() {
  return (
    <Layout showBack backTo="/">
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-4">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mb-6">Last updated: July 22, 2026</p>

          <div className="prose prose-sm text-slate-600 space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">1. Information We Collect</h2>
              <p>
                Global Social Media Dashboard collects data from connected social media accounts to display
                follower counts, engagement metrics, and analytics. This includes:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Follower/subscriber counts from Facebook, Instagram, YouTube, and TikTok</li>
                <li>Video view counts and engagement metrics</li>
                <li>Account names and identifiers</li>
                <li>Usage data within the dashboard application</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">2. How We Use Your Data</h2>
              <p>
                The data collected is used solely for displaying analytics within the dashboard.
                We do not sell, share, or monetize your social media data.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">3. Data Storage</h2>
              <p>
                All data is stored securely in our Supabase database. OAuth tokens are encrypted
                at rest. We retain data only as long as your account remains active.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">4. Third-Party Services</h2>
              <p>
                We connect to the following third-party platforms to retrieve analytics data:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Facebook Graph API</li>
                <li>Instagram Graph API</li>
                <li>YouTube Data API</li>
                <li>TikTok Display API</li>
              </ul>
              <p className="mt-2">
                Each platform's own privacy policy governs how they handle your data.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">5. Data Security</h2>
              <p>
                We implement industry-standard security measures including encrypted token storage,
                HTTPS for all API communications, and role-based access control.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">6. Your Rights</h2>
              <p>
                You can disconnect your social media accounts at any time, which will remove
                all associated data from our systems. Contact us to request full data deletion.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-3">7. Contact</h2>
              <p>
                For questions about this Privacy Policy, contact us at support@example.com.
              </p>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
