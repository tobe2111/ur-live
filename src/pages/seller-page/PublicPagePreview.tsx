import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight } from 'lucide-react'
import { getSellerId } from '@/lib/seller-auth'

/**
 * 셀러 공개 페이지 미리보기 + 링크 복사.
 * 🛡️ TD-006 추출 (2026-05-06).
 */
export default function PublicPagePreview() {
  const { t } = useTranslation()
  const sellerId = getSellerId()
  if (!sellerId) return null
  const username = localStorage.getItem('seller_username') || sellerId

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">{t('seller.myPublicPage')}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/s/${sellerId}`)
              const el = document.getElementById('copy-toast')
              if (el) { el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 2000) }
            }}
            className="text-xs text-blue-600 font-medium hover:underline"
          >
            {t('seller.copyLink')}
          </button>
          <a
            href={`/profile/${username}`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-0.5"
          >
            {t('seller.newTab')} <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
      </div>
      <p id="copy-toast" className="text-xs text-green-600 text-center mb-2 hidden">{t('seller.linkCopied')}</p>

      <div className="flex justify-center">
        <a
          href={`/profile/${username}`}
          className="block w-full max-w-[280px] p-4 bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl border border-pink-100 text-center hover:shadow-md transition-shadow"
        >
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center">
            <span className="text-2xl">🏪</span>
          </div>
          <p className="text-sm font-bold text-gray-900">{t('seller.myPublicPage')}</p>
          <p className="text-xs text-gray-500 mt-1">{t('seller.tapToEditPublicPage')}</p>
        </a>
      </div>

      <div className="flex gap-2 mt-4">
        <a
          href={`/profile/${username}`}
          target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200"
        >
          {t('seller.newTab')} <ArrowUpRight className="w-3 h-3" />
        </a>
        <Link
          to="/seller/profile"
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
        >
          {t('seller.editProfile')}
        </Link>
      </div>
    </div>
  )
}
