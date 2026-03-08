import React from 'react'
import { Eye, Share2 } from 'lucide-react'

interface LiveStreamInfoProps {
  title: string
  streamerName: string
  streamerAvatar?: string
  viewerCount: number
  onShare?: () => void
  className?: string
}

export const LiveStreamInfo = React.memo(function LiveStreamInfo({
  title,
  streamerName,
  streamerAvatar,
  viewerCount,
  onShare,
  className = ''
}: LiveStreamInfoProps) {
  const formatViewerCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`
    }
    return count.toString()
  }

  return (
    <div className={`bg-white p-4 shadow-sm ${className}`}>
      {/* 스트림 제목 */}
      <h1 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2">
        {title}
      </h1>

      {/* 스트리머 정보 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* 아바타 */}
          {streamerAvatar ? (
            <img
              src={streamerAvatar}
              alt={streamerName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-600 font-bold">
                {streamerName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* 이름 & 시청자 수 */}
          <div>
            <p className="font-medium text-gray-900">{streamerName}</p>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Eye size={14} />
              <span>{formatViewerCount(viewerCount)} 시청 중</span>
            </div>
          </div>
        </div>

        {/* 공유 버튼 */}
        {onShare && (
          <button
            onClick={onShare}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="공유하기"
          >
            <Share2 size={20} className="text-gray-600" />
          </button>
        )}
      </div>
    </div>
  )
})
