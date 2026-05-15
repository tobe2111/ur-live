/**
 * 🛡️ 2026-05-15: 외부 플랫폼 라이브 진행 중 배지.
 *
 * TikTok / Instagram Live 는 임베디드 불가능 (정책 막힘).
 * 대안: 셀러가 multi-channel 송출 시 외부 링크 카드로 표시 (클릭 시 외부 앱 이동).
 *
 * 데이터: seller.external_live_urls = { tiktok?: string; instagram?: string; facebook?: string }
 * 셀러가 본인 프로필에 입력 (옵션, 빈 경우 미표시).
 */

import { ExternalLink } from 'lucide-react'

interface Props {
  externalLiveUrls?: {
    tiktok?: string
    instagram?: string
    facebook?: string
  }
}

const PLATFORMS = [
  { key: 'tiktok' as const, label: 'TikTok', icon: '🎵', bg: 'bg-black', color: 'text-white' },
  { key: 'instagram' as const, label: 'Instagram', icon: '📷', bg: 'bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-400', color: 'text-white' },
  { key: 'facebook' as const, label: 'Facebook', icon: '📘', bg: 'bg-blue-600', color: 'text-white' },
]

export default function ExternalLivePlatforms({ externalLiveUrls }: Props) {
  if (!externalLiveUrls) return null
  const available = PLATFORMS.filter(p => externalLiveUrls[p.key])
  if (available.length === 0) return null

  return (
    <div className="mb-4">
      <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
        다른 플랫폼에서도 라이브 중
      </p>
      <div className="flex flex-wrap gap-2">
        {available.map(p => (
          <a
            key={p.key}
            href={externalLiveUrls[p.key]!}
            target="_blank"
            rel="noopener noreferrer"
            className={`${p.bg} ${p.color} inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-transform hover:scale-105 shadow-sm`}
            aria-label={`${p.label} 라이브 보기 (외부 링크)`}
          >
            <span>{p.icon}</span>
            <span>{p.label}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        ))}
      </div>
    </div>
  )
}
