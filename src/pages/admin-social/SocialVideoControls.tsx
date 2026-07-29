/**
 * 🆕 2026-07-15 어드민 소셜 홍보 — 릴스/쇼츠 영상 컨트롤(유튜브 쇼츠 + 인스타 릴스).
 *   ① 영상 기획(스토리보드) 생성 → ② 렌더 제출 → ③ 상태 폴링(done 시 media_url 세팅 → 발행 가능).
 *   기획/대본은 항상 가능. 렌더는 게이트 ON + provider 필요(없으면 안내).
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Loader2, Clapperboard, Film, RefreshCw } from 'lucide-react'
import type { SocialPost } from './types'

interface Scene { narration: string; onScreenText: string; visualDirection: string; durationSec: number }
interface Storyboard { title: string; description: string; hashtags: string[]; scenes: Scene[] }

interface Props {
  post: SocialPost
  videoEnabled: boolean // 렌더 게이트+provider ON 여부
  onChange: () => void
}

export default function SocialVideoControls({ post, videoEnabled, onChange }: Props) {
  const [busy, setBusy] = useState<'plan' | 'render' | 'poll' | null>(null)
  const [open, setOpen] = useState(false)

  let storyboard: Storyboard | null = null
  try { storyboard = post.storyboard ? JSON.parse(post.storyboard) : null } catch { storyboard = null }
  const renderStatus = post.render_status || 'none'

  const genPlan = async () => {
    setBusy('plan')
    try {
      const { data } = await api.post(`/api/admin/social/posts/${post.id}/video-plan`)
      if (data?.success) { toast.success('영상 기획(스토리보드)을 생성했습니다'); setOpen(true); onChange() }
      else toast.error(data?.error === 'NOT_CONFIGURED' ? 'ANTHROPIC_API_KEY 미설정' : (data?.error || '생성 실패'))
    } catch (e: any) { toast.error(e?.response?.data?.error || '생성 중 오류') } finally { setBusy(null) }
  }

  const render = async () => {
    setBusy('render')
    try {
      const { data } = await api.post(`/api/admin/social/posts/${post.id}/render`)
      if (data?.success) { toast.success(data.status === 'done' ? '영상이 준비됐습니다' : '영상 렌더를 시작했습니다'); onChange() }
      else toast.error(data?.error || '렌더 실패')
    } catch (e: any) { toast.error(e?.response?.data?.error || '렌더 중 오류') } finally { setBusy(null) }
  }

  const poll = async () => {
    setBusy('poll')
    try {
      const { data } = await api.get(`/api/admin/social/posts/${post.id}/render-status`)
      if (data?.success) {
        if (data.status === 'done') toast.success('영상 렌더 완료 — 발행 준비됨')
        else if (data.status === 'failed') toast.error('영상 렌더 실패')
        onChange()
      } else toast.error(data?.error || '상태 조회 실패')
    } catch (e: any) { toast.error(e?.response?.data?.error || '조회 중 오류') } finally { setBusy(null) }
  }

  return (
    <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Film className="h-4 w-4 text-purple-500" /> 릴스/쇼츠 영상 (세로 9:16)
        </div>
        <div className="flex items-center gap-2 text-xs">
          {renderStatus === 'processing' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">렌더 중</span>}
          {renderStatus === 'done' && <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">영상 준비됨</span>}
          {renderStatus === 'failed' && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">렌더 실패</span>}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={genPlan} disabled={busy !== null}
          className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          {busy === 'plan' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clapperboard className="h-3 w-3" />}
          {storyboard ? '기획 다시 생성' : '영상 기획 생성'}
        </button>

        {storyboard && (
          <button onClick={render} disabled={busy !== null || !videoEnabled}
            title={videoEnabled ? '' : '영상 렌더가 비활성(SOCIAL_VIDEO_ENABLED OFF 또는 provider 미설정)'}
            className="flex items-center gap-1 rounded-lg bg-purple-600 px-2.5 py-1 text-xs text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40">
            {busy === 'render' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Film className="h-3 w-3" />} 영상 렌더
          </button>
        )}
        {renderStatus === 'processing' && (
          <button onClick={poll} disabled={busy !== null}
            className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {busy === 'poll' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} 상태 새로고침
          </button>
        )}
        {storyboard && (
          <button onClick={() => setOpen(!open)} className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:text-gray-900">
            {open ? '기획 접기' : `기획 보기 (${storyboard.scenes.length}컷)`}
          </button>
        )}
      </div>

      {!videoEnabled && storyboard && (
        <p className="mt-2 text-xs text-gray-400">렌더 provider 미설정 — 기획/대본은 준비됐습니다. 완성된 mp4 URL 을 편집에서 직접 넣어 발행할 수도 있어요.</p>
      )}

      {open && storyboard && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-2">
          {storyboard.scenes.map((s, i) => (
            <div key={i} className="rounded-lg bg-white p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">컷 {i + 1} · {s.durationSec}초</span>
                {s.onScreenText && <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] text-white">{s.onScreenText}</span>}
              </div>
              <p className="mt-1 text-gray-600">🎙 {s.narration}</p>
              {s.visualDirection && <p className="mt-0.5 text-gray-400">🎬 {s.visualDirection}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
