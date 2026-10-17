/**
 * 🖼️ 2026-10-17 어드민 소셜 — 카드 이미지(1080×1350) 미리보기 + 만들기/다시 만들기.
 *   인스타는 이미지가 없으면 게시가 막힌다. 매일 09:00 크론이 인스타 초안에 자동으로 붙이고,
 *   실패했거나 글을 고친 뒤에는 여기서 다시 만든다(서버: POST /api/admin/social/posts/:id/card-image).
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Loader2, ImagePlus, RefreshCw } from 'lucide-react'
import type { SocialPost } from './types'

interface Props { post: SocialPost; onChange: () => void }

export default function SocialCardImage({ post, onChange }: Props) {
  const [busy, setBusy] = useState(false)
  const hasImage = post.media_kind === 'image' && !!post.media_url

  const make = async () => {
    setBusy(true)
    try {
      const { data } = await api.post(`/api/admin/social/posts/${post.id}/card-image`)
      if (data?.success) { toast.success('카드 이미지를 만들었습니다'); onChange() }
      else toast.error(data?.error || '카드 이미지를 만들지 못했습니다')
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || '카드 이미지를 만들지 못했습니다')
    } finally { setBusy(false) }
  }

  return (
    <div className="mt-3 flex items-end gap-3">
      {hasImage && (
        <a href={post.media_url || undefined} target="_blank" rel="noreferrer" className="block shrink-0">
          <img src={post.media_url || undefined} alt="카드 이미지" width={96} height={120}
            className="h-[120px] w-[96px] rounded-lg object-cover ring-1 ring-gray-200" loading="lazy" />
        </a>
      )}
      <button onClick={make} disabled={busy}
        className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50">
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : hasImage ? <RefreshCw className="h-3 w-3" /> : <ImagePlus className="h-3 w-3" />}
        {hasImage ? '카드 다시 만들기' : '카드 이미지 만들기'}
      </button>
    </div>
  )
}
