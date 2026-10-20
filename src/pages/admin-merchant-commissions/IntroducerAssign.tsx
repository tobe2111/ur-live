/**
 * 🤝 어드민 매장 카드 — **영입자 지정**.
 *
 * 대표 2026-08-31: 영입 2% 를 QA 하려면 매장에 영입자가 박혀 있어야 하는데,
 * 지정하는 화면이 없어 DB 로만 가능했다.
 *
 * ⚠️ **여기 넣는 값은 `users.id`(유저 번호)다 — 셀러 번호가 아니다.**
 *   `sellers.introduced_by_influencer_id` 를 적립·지급·조회·등록귀속 네 곳이 전부 users.id 로 읽는다.
 *   두 id 공간이 라이브에서 실제로 겹치므로(셀러 3·5·6 ↔ 유저 3·5·6) 잘못 넣으면
 *   **에러 없이 엉뚱한 사람에게 2% 가 간다.** 그래서 저장 전에 그 유저가 누구인지 보여준다.
 *
 * 라이트 테마 고정(대시보드 룰 — `dark:` 금지).
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

export default function IntroducerAssign({
  sellerId,
  current,
  onChanged,
}: {
  sellerId: number
  /** 지금 박혀 있는 영입자(없으면 null) */
  current: { id: string; handle: string | null } | null
  onChanged: () => void
}) {
  const [userId, setUserId] = useState('')
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<{ id: string; name: string | null; handle: string | null } | null>(null)
  const [busy, setBusy] = useState(false)

  /** 저장 전에 "이 번호가 누구인지" 를 눈으로 확인시킨다 — 오지정이 조용히 지나가지 않게. */
  async function lookup() {
    const id = userId.trim()
    if (!id) { toast.error('유저 번호를 입력하세요'); return }
    setBusy(true)
    try {
      const res = await api.get(`/api/admin/users/${encodeURIComponent(id)}`)
      const u = res.data?.data
      if (res.data?.success && u) setPreview({ id: String(u.id), name: u.name ?? null, handle: u.handle ?? null })
      else { setPreview(null); toast.error('그 번호의 유저를 찾지 못했습니다') }
    } catch {
      setPreview(null); toast.error('조회 중 오류')
    } finally { setBusy(false) }
  }

  async function assign(next: string | null) {
    if (reason.trim().length < 5) { toast.error('사유를 5자 이상 적어주세요'); return }
    setBusy(true)
    try {
      const res = await api.patch(`/api/admin/sellers/${sellerId}/reassign-influencer`, {
        new_influencer_id: next === null ? null : Number(next),
        reason: reason.trim(),
      })
      if (res.data?.success) {
        toast.success(next === null ? '영입자를 해제했습니다' : '영입자를 지정했습니다')
        setUserId(''); setReason(''); setPreview(null)
        onChanged()
      } else {
        toast.error(res.data?.error || '변경 실패')
      }
    } catch {
      toast.error('변경 중 오류')
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div>
        <p className="text-sm font-bold text-gray-900">이 매장, 누가 데려왔나?</p>
        <p className="text-xs text-gray-500 mt-0.5">
          지정하면 이 매장 매출의 2%를 1년간 받습니다. <b>직접 입점 매장에서만</b> 지급됩니다.
        </p>
      </div>

      <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        현재: {current
          ? <b>{current.handle ? `@${current.handle}` : `유저 #${current.id}`}</b>
          : <span className="text-gray-500">지정 안 됨</span>}
      </div>

      <div className="flex gap-2">
        <input
          value={userId}
          onChange={(e) => { setUserId(e.target.value); setPreview(null) }}
          placeholder="유저 번호 (셀러 번호 아님)"
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm"
        />
        <button type="button" onClick={lookup} disabled={busy}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 disabled:opacity-50">
          확인
        </button>
      </div>

      {preview && (
        <div className="text-xs text-gray-900 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          이 사람이 맞나요? — <b>{preview.name || '(이름 없음)'}</b>
          {preview.handle && <span className="text-gray-600"> @{preview.handle}</span>}
          <span className="text-gray-500"> · 유저 #{preview.id}</span>
        </div>
      )}

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="사유 (5자 이상 — 감사 기록에 남습니다)"
        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm"
      />

      <div className="flex gap-2">
        {/* 확인을 눌러 사람을 본 뒤에만 지정할 수 있다 — 번호만 보고 저장하는 길을 막는다. */}
        <button
          type="button"
          disabled={busy || !preview}
          onClick={() => preview && assign(preview.id)}
          className="flex-1 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold disabled:opacity-40"
        >
          {preview ? '이 사람으로 지정' : '먼저 확인을 누르세요'}
        </button>
        {current && (
          <button type="button" disabled={busy} onClick={() => assign(null)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 disabled:opacity-50">
            해제
          </button>
        )}
      </div>
    </div>
  )
}
