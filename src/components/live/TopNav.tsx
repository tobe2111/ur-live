import { Eye } from 'lucide-react'
import { formatViewers } from './LiveUtils'
import { YouTubeIcon, InstagramIcon } from './LiveIcons'

// TikTok 아이콘
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13a8.28 8.28 0 005.58 2.17V11.7a4.83 4.83 0 01-3.77-1.24V6.69z" />
    </svg>
  )
}

export function TopNav({ viewers, sellerLinks }: {
  viewers: number
  sellerLinks?: { youtube?: string; instagram?: string; tiktok?: string }
}) {
  const hasLinks = sellerLinks?.youtube || sellerLinks?.instagram || sellerLinks?.tiktok
  return (
    <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 pt-safe pb-2 mt-3">
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

      {/* 우측 상단: SNS 아이콘 버튼 */}
      {hasLinks && (
        <div className="flex items-center gap-2">
          {sellerLinks?.youtube && (
            <a
              href={sellerLinks.youtube}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-600/80 backdrop-blur-sm hover:bg-red-600 transition-all active:scale-95"
              aria-label="YouTube"
            >
              <YouTubeIcon className="h-4 w-4 text-white" />
            </a>
          )}
          {sellerLinks?.instagram && (
            <a
              href={sellerLinks.instagram}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/80 to-pink-500/80 backdrop-blur-sm hover:from-purple-500 hover:to-pink-500 transition-all active:scale-95"
              aria-label="Instagram"
            >
              <InstagramIcon className="h-4 w-4 text-white" />
            </a>
          )}
          {sellerLinks?.tiktok && (
            <a
              href={sellerLinks.tiktok}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/80 backdrop-blur-sm hover:bg-black transition-all active:scale-95"
              aria-label="TikTok"
            >
              <TikTokIcon className="h-4 w-4 text-white" />
            </a>
          )}
        </div>
      )}
    </header>
  )
}
