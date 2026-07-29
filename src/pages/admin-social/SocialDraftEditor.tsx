/**
 * 🆕 2026-07-15 어드민 소셜 홍보 — 초안 편집기(인라인 뷰).
 *   제목/본문/해시태그/미디어 편집 + 저장. 발행된 글은 편집 불가(상위에서 차단).
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save } from 'lucide-react'
import { parseHashtags, PLATFORMS, type SocialPost } from './types'

interface Props {
  post: SocialPost
  onBack: () => void
  onSaved: () => void
}

export default function SocialDraftEditor({ post, onBack, onSaved }: Props) {
  const meta = PLATFORMS.find((p) => p.key === post.platform)
  const [title, setTitle] = useState(post.title || '')
  const [body, setBody] = useState(post.body || '')
  const [hashtags, setHashtags] = useState(parseHashtags(post.hashtags).join(', '))
  const [mediaUrl, setMediaUrl] = useState(post.media_url || '')
  const [mediaKind, setMediaKind] = useState(post.media_kind || 'none')
  // 예약 발행 시각 — datetime-local(로컬 표시) ↔ 저장은 ISO(UTC).
  const [scheduledAt, setScheduledAt] = useState(() => {
    if (!post.scheduled_at) return ''
    const d = new Date(post.scheduled_at)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await api.patch(`/api/admin/social/posts/${post.id}`, {
        title, body,
        hashtags: hashtags.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean),
        media_url: mediaUrl.trim(), media_kind: mediaKind,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      })
      if (data?.success) { toast.success('저장했습니다'); onSaved() } else toast.error(data?.error || '저장 실패')
    } catch (e: any) { toast.error(e?.response?.data?.error || '저장 중 오류') } finally { setSaving(false) }
  }

  const needMedia = post.platform === 'instagram' || post.platform === 'youtube'

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> 목록으로
      </button>
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg">{meta?.emoji}</span>
          <span className="font-semibold text-gray-900">{meta?.label} 초안 편집</span>
          {post.ai_generated ? <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">AI 생성</span> : null}
        </div>

        <label className="mb-1 block text-sm font-medium text-gray-700">{post.platform === 'youtube' ? '영상 제목' : '제목/라벨'}</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900" />

        <label className="mb-1 block text-sm font-medium text-gray-700">{post.platform === 'youtube' ? '영상 설명란' : '본문'}</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8}
          className="mb-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900" />
        <p className="mb-4 text-xs text-gray-400">{body.length}자</p>

        <label className="mb-1 block text-sm font-medium text-gray-700">해시태그 (쉼표 구분, # 없이)</label>
        <input value={hashtags} onChange={(e) => setHashtags(e.target.value)}
          placeholder="이용권, 데이트, 동네딜" className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900" />

        <label className="mb-1 block text-sm font-medium text-gray-700">
          미디어 URL {needMedia && <span className="text-red-500">*필수</span>}
          {post.platform === 'instagram' && <span className="text-gray-400"> (공개 이미지/영상 URL)</span>}
          {post.platform === 'youtube' && <span className="text-gray-400"> (완성된 mp4 URL)</span>}
        </label>
        <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)}
          placeholder="https://media.ur-team.com/..." className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900" />
        <div className="mb-4 flex gap-3 text-sm">
          {(['none', 'image', 'video'] as const).map((k) => (
            <label key={k} className="flex items-center gap-1 text-gray-700">
              <input type="radio" name="mediaKind" checked={mediaKind === k} onChange={() => setMediaKind(k)} />
              {k === 'none' ? '없음' : k === 'image' ? '이미지' : '영상'}
            </label>
          ))}
        </div>

        <label className="mb-1 block text-sm font-medium text-gray-700">예약 발행 시각 <span className="text-gray-400">(선택 — 승인 후 이 시각에 자동 발행)</span></label>
        <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
          className="mb-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900" />
        <p className="mb-4 text-xs text-gray-400">비워두면 예약 없음(수동 발행). 예약은 매시간 점검되며, 발행 게이트가 켜져 있어야 실제 발행됩니다.</p>

        <div className="flex justify-end gap-2">
          <button onClick={onBack} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600">취소</button>
          <Button onClick={save} disabled={saving}><Save className="mr-1 h-4 w-4" />{saving ? '저장 중…' : '저장'}</Button>
        </div>
      </div>
    </div>
  )
}
