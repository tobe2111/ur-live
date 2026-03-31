import React from 'react'
import { Eye } from 'lucide-react'
import { formatViewers } from './LiveUtils'
import { YouTubeIcon, InstagramIcon, KakaoTalkIcon } from './LiveIcons'

export function TopNav({ viewers, sellerLinks, onSubscribe }: {
  viewers: number
  sellerLinks?: { youtube?: string; instagram?: string; kakao?: string }
  onSubscribe?: (platform: string) => void
}) {
  const hasLinks = sellerLinks?.youtube || sellerLinks?.instagram || sellerLinks?.kakao
  return (
    <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 pt-safe pb-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-red-500/90 backdrop-blur-sm px-2.5 py-1.5 shadow-lg shadow-red-500/30">
          <span className="h-2 w-2 rounded-full bg-white animate-blink-live" />
          <span className="text-xs font-extrabold tracking-wider text-white">LIVE</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-black/40 backdrop-blur-md px-2.5 py-1.5">
          <Eye className="h-3.5 w-3.5 text-white/80" />
          <span className="text-xs font-semibold text-white/90">
            {formatViewers(viewers)}
          </span>
        </div>
      </div>

      {/* 우측 상단: SNS 링크 + 구독 */}
      {hasLinks && (
        <div className="flex items-center gap-2">
          {sellerLinks?.youtube && (
            <a
              href={sellerLinks.youtube}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onSubscribe?.('유튜브')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600/80 backdrop-blur-sm hover:bg-red-600 transition-all active:scale-95"
              aria-label="YouTube 구독"
            >
              <YouTubeIcon className="h-4 w-4 text-white" />
              <span className="text-[10px] font-bold text-white">구독</span>
            </a>
          )}
          {sellerLinks?.instagram && (
            <a
              href={sellerLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onSubscribe?.('인스타그램')}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/80 to-pink-500/80 backdrop-blur-sm hover:from-purple-500 hover:to-pink-500 transition-all active:scale-95"
              aria-label="Instagram"
            >
              <InstagramIcon className="h-4 w-4 text-white" />
            </a>
          )}
          {sellerLinks?.kakao && (
            <a
              href={sellerLinks.kakao}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onSubscribe?.('카카오톡')}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-yellow-400/80 backdrop-blur-sm hover:bg-yellow-400 transition-all active:scale-95"
              aria-label="KakaoTalk"
            >
              <KakaoTalkIcon className="h-4 w-4 text-gray-900" />
            </a>
          )}
        </div>
      )}
    </header>
  )
}
