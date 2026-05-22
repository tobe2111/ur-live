import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, ArrowLeft, Radio, Utensils, Users } from 'lucide-react'
import SEO from '@/components/SEO'

export default function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const popularLinks = [
    { to: '/', label: t('notFound.linkLive'), Icon: Radio },
    { to: '/restaurant-map', label: t('notFound.linkRestaurant'), Icon: Utensils },
    { to: '/referral', label: t('notFound.linkGroupBuy'), Icon: Users },
  ]

  return (
    <>
      <SEO
        title={t('notFound.title')}
        description={t('notFound.seoDescription')}
        url="/404"
        noindex
      />

      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#fbfbfd] via-white to-[#f5f5f7] dark:from-[#0A0A0A] dark:via-[#0A0A0A] dark:to-[#121212] flex items-center justify-center px-4 py-12">
        {/* Decorative floating orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 h-[360px] w-[360px] rounded-full bg-gradient-to-br from-[#FF0033]/20 to-[#EC4899]/10 blur-3xl animate-pulse"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-24 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-[#EC4899]/15 to-[#FF0033]/10 blur-3xl animate-pulse"
          style={{ animationDelay: '1.2s' }}
        />

        {/* Grid dot pattern */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.25]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage:
              'radial-gradient(ellipse at center, black 40%, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at center, black 40%, transparent 75%)',
          }}
        />

        {/* 🛡️ 2026-05-20: PC 에서도 너무 좁지 않도록 lg:padding 추가 */}
        <div className="relative z-10 max-w-xl w-full text-center px-4 lg:px-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* 404 Large Gradient */}
          <h1
            className="font-black leading-none tracking-tight text-[140px] md:text-[200px] bg-gradient-to-r from-[#FF0033] to-[#EC4899] bg-clip-text text-transparent select-none"
            aria-label="404"
          >
            404
          </h1>

          {/* Subtitle */}
          <h2 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {t('notFound.title')}
          </h2>

          {/* Description */}
          <p className="mt-3 text-base text-gray-500 dark:text-gray-400">
            {t('notFound.description')}
          </p>

          {/* Action Buttons */}
          <div className="mt-10 grid grid-cols-2 gap-3">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 h-12 rounded-2xl bg-black dark:bg-white text-white dark:text-gray-900 font-bold text-[15px] shadow-sm hover:bg-gray-900 dark:hover:bg-gray-100 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
            >
              <Home className="h-4 w-4" />
              {t('notFound.goHome')}
            </Link>
            <button
              type="button" onClick={() => navigate(-1)} aria-label="뒤로 가기"
              className="inline-flex items-center justify-center gap-2 h-12 rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1C1C1E] text-gray-700 dark:text-gray-300 font-bold text-[15px] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] hover:border-gray-300 dark:hover:border-[#3A3A3A] transition-all duration-200 active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('notFound.goBack')}
            </button>
          </div>

          {/* Popular Links */}
          <div className="mt-12 pt-8 border-t border-gray-200/70 dark:border-[#2A2A2A]">
            <p className="mb-4 text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('notFound.popularPages')}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {popularLinks.map(({ to, label, Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2A2A2A] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-[#3A3A3A] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] hover:text-gray-900 dark:hover:text-white transition-all duration-200 active:scale-[0.98] shadow-sm"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
