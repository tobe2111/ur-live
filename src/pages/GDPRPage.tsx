import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'

export default function GDPRPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A]">
      <SEO title="Privacy Policy (GDPR) - YourDeal" description="YourDeal privacy policy and GDPR compliance information." url="/gdpr" />
      {/* 🛡️ 2026-05-20: 정책 페이지 ur-content-medium (1024px) 으로 PC 가독성 향상. */}
      <div className="ur-content-medium px-5 lg:px-8 py-8 lg:py-12">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Privacy Policy & GDPR Compliance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: April 2026</p>

        <div className="space-y-6 text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">1. Data Controller</h2>
            <p>Lister Corporation ("YourDeal") is the data controller for personal data processed through live.ur-team.com.</p>
            <p className="mt-1">Contact: jiwon@ur-team.com</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account data:</strong> Name, email, profile image (via Kakao/Google OAuth)</li>
              <li><strong>Order data:</strong> Shipping address, phone number, payment information</li>
              <li><strong>Usage data:</strong> Pages visited, products viewed, search queries</li>
              <li><strong>Device data:</strong> IP address, browser type, device type</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">3. Legal Basis for Processing</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Contract:</strong> Processing orders and delivering products</li>
              <li><strong>Consent:</strong> Marketing communications, Kakao notifications</li>
              <li><strong>Legitimate interest:</strong> Fraud prevention, service improvement</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">4. Your Rights (GDPR)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate data</li>
              <li><strong>Erasure:</strong> Request deletion of your data</li>
              <li><strong>Portability:</strong> Receive your data in machine-readable format</li>
              <li><strong>Objection:</strong> Object to processing based on legitimate interest</li>
              <li><strong>Withdraw consent:</strong> Withdraw consent at any time</li>
            </ul>
            <p className="mt-2">To exercise these rights, contact jiwon@ur-team.com or use Account Settings → Delete Account.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">5. Data Retention</h2>
            <p>We retain personal data for as long as your account is active. Order data is kept for 5 years for tax compliance. You can delete your account at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">6. Data Transfers</h2>
            <p>Data is processed on Cloudflare (global edge network) and Firebase (Google Cloud). Both providers maintain adequate safeguards for international data transfers.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">7. Cookies</h2>
            <p>We use essential cookies for authentication and session management. No third-party tracking cookies are used without consent.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">8. Contact</h2>
            <p>For privacy inquiries: jiwon@ur-team.com</p>
            <p>Lister Corporation, Busan, South Korea</p>
          </section>
        </div>
      </div>
    </div>
  )
}
