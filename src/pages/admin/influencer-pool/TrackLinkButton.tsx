import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

/**
 * 🔗 리드별 협찬 추적링크 (2026-07-27 — "성과 기반 매칭"을 말이 아닌 데이터로).
 *   제안 메시지에 이 링크를 넣어 보내면, 그 인플루언서가 만든 유입만 클릭수로 분리 측정된다.
 *   멱등: 이미 발급된 리드는 같은 코드를 반환(이미 보낸 링크는 절대 안 바뀜) + 현재 클릭수 표시.
 *   목적지 URL 은 매장/딜 페이지 — 마지막 입력값을 기억해 연속 발급 시 재입력 불필요.
 */
const LAST_TARGET_KEY = 'ads_track_last_target'

export default function TrackLinkButton({ leadId }: { leadId: number }) {
  const [busy, setBusy] = useState(false)

  async function run() {
    const remembered = (() => { try { return localStorage.getItem(LAST_TARGET_KEY) || '' } catch { return '' } })()
    const target = window.prompt('추적링크가 보낼 목적지 URL을 입력하세요.\n(매장 링크샵·딜 상세 등 — 인플루언서가 소개할 페이지)', remembered)
    if (target === null) return
    const url = target.trim()
    if (!url) { toast.error('목적지 URL을 입력해주세요'); return }
    setBusy(true)
    try {
      const r = await api.post(`/api/admin/ads/influencer-pool/${leadId}/track-link`, { target_url: url })
      if (!r.data?.success) { toast.error(r.data?.error || '추적링크 생성 실패'); return }
      try { localStorage.setItem(LAST_TARGET_KEY, url) } catch { /* quota — 무해 */ }
      const short = `${window.location.origin}/l/${r.data.code}`
      await navigator.clipboard?.writeText(short).catch(() => null)
      toast.success(r.data.created
        ? `🔗 추적링크 생성·복사됨 — ${short} (제안 메시지에 넣어 보내세요)`
        : `🔗 기존 추적링크 복사됨 — ${short} · 현재 ${r.data.click_count}클릭`)
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '추적링크 생성 실패')
    } finally { setBusy(false) }
  }

  return (
    <button onClick={run} disabled={busy} title="이 인플루언서 전용 추적링크 생성/복사 — 제안에 넣어 보내면 유입을 분리 측정"
      className="text-[12px] font-semibold text-indigo-600 hover:underline disabled:opacity-40">🔗</button>
  )
}
