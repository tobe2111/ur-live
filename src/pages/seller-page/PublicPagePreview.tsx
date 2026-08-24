import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Users } from 'lucide-react'
import { useState } from 'react'
import { getSellerId } from '@/lib/seller-auth'

/**
 * 셀러 공개 페이지 — 컴팩트 한 줄 (2026-08-23 대표 AB테스트: "여백이 많잖아. 컴팩트하게").
 *   종전: 큰 이미지 카드 + 버튼 2개로 화면 1/4 차지 → 지금: 아이콘+링크+팔로워 칩+액션 3개 한 줄.
 */
export default function PublicPagePreview({ followerCount = 0 }: { followerCount?: number }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const sellerId = getSellerId()
  if (!sellerId) return null
  const username = localStorage.getItem('seller_username') || sellerId

  return (
    <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-lg shrink-0">🏪</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-gray-900">{t('seller.myPublicPage')}</p>
        <p className="text-[11px] text-gray-400 truncate">/profile/{username}</p>
      </div>
      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-pink-50 text-pink-700 text-[11px] font-bold shrink-0">
        <Users className="w-3 h-3" /> {followerCount}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/s/${sellerId}`)
            setCopied(true); setTimeout(() => setCopied(false), 2000)
          }}
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
        >
          {copied ? `✓ ${t('seller.linkCopied')}` : t('seller.copyLink')}
        </button>
        <a
          href={`/profile/${username}`}
          target="_blank" rel="noopener noreferrer"
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-0.5"
        >
          {t('seller.newTab')} <ArrowUpRight className="w-3 h-3" />
        </a>
        <Link
          to="/seller/profile"
          className="px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] font-bold hover:bg-gray-800"
        >
          {t('seller.editProfile')}
        </Link>
      </div>
    </div>
  )
}
