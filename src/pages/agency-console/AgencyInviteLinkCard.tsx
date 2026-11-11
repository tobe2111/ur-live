import { useCallback, useEffect, useRef, useState } from 'react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/useToast'
import { feedPayload, sendKakaoShare, shareViaKakao } from '@/lib/kakao-share'
import { agencyInviteCardCopy } from '@/shared/agency-store-invite'
import { agencyRequest, readAgencyProfile } from './agency-api'

interface Invite { url: string; expiresAt?: string; useCount: number }

/**
 * 🔗 매장 영입 링크(관리자) — 사장님께 카톡으로 보내는 링크. 사장님이 열어 [맡기기] 를 누르면 바로 운영이 시작되고,
 * 아직 유어딜에 없는 사장님은 그 링크에서 매장을 등록하면 **등록과 동시에** 이 에이전시에 연결된다.
 * 링크는 에이전시당 하나이고 **여러 매장이 같은 링크를 계속 쓴다** — 매장이 있어도 영입은 계속된다(2026-10-31 대표).
 * 새로 만들면 옛 링크는 끊긴다(엉뚱한 곳에 퍼졌을 때 거두는 방법).
 *
 * 2026-10-31 대표 *"카카오톡으로 보면 예쁘게 보이게끔"*:
 *   - 살아 있는 링크가 없으면 **열자마자 만든다** — 링크가 없던 자리라 끊길 것도 없다. 사람이 누를 버튼은 [보내기] 하나가 된다.
 *   - [카카오톡으로 보내기] 가 우리가 정한 카드(에이전시 이름 · 설명 · [매장 맡기기] 버튼)를 보낸다. 공유창은 **누른 순간**
 *     열어야 폰 브라우저가 막지 않으므로 SDK 를 미리 데워 두고 동기로 보낸다(`sendKakaoShare`), 안 데워졌으면 비동기로.
 *   - 카톡이 안 되면 기기 공유 → 복사 순으로 내려간다.
 *
 * 🤝 2026-11-11 대표 *"모두가 번거롭지 않게 자동화"* — **우리 몫 %** 를 여기서 한 번 정해 둔다. 사장님은 링크 화면에서
 *   그 % 를 보고 [맡기기] 하고, 그 순간 그 매장의 몫으로 저장된다(사장님이 따로 적을 일이 없다).
 */
export function AgencyInviteLinkCard({ canManage = true }: { canManage?: boolean } = {}) {
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const agencyName = readAgencyProfile()?.agency.name || ''
  const [sharePct, setSharePct] = useState<number | null>(null)
  const [shareInput, setShareInput] = useState('')

  const create = useCallback(async (): Promise<Invite | null> => {
    const r = await agencyRequest<{ invite: Invite; message?: string }>('/store-invite', { method: 'POST' })
    if (!r.ok) { toast.error(r.data.error || '링크를 만들지 못했어요.'); return null }
    setInvite(r.data.invite)
    return r.data.invite
  }, [])

  const load = useCallback(async () => {
    setError('')
    const r = await agencyRequest<{ invite: Invite | null; sharePct?: number }>('/store-invite')
    if (!r.ok) { setError(r.data.error || '영입 링크를 불러오지 못했어요.'); return }
    const pct = Number(r.data.sharePct) || 0
    setSharePct(pct); setShareInput(pct ? String(pct) : '')
    if (r.data.invite) { setInvite(r.data.invite); return }
    // 살아 있는 링크가 없다(처음이거나 만료) — 바로 만든다. 끊을 옛 링크가 없으므로 묻지 않는다.
    // 🧑‍🤝‍🧑 직원은 만들 수 없다(서버 adminOnly) — 직원은 관리자가 만든 링크를 보내기만 한다.
    if (!canManage) { setInvite(null); return }
    if (!(await create())) setInvite(null)
  }, [create, canManage])

  useEffect(() => {
    void load()
    // 공유창을 누른 순간 열 수 있게 SDK 를 미리 데운다(실패해도 버튼이 비동기로 다시 시도한다).
    void import('@/lib/kakao-sdk').then((m) => m.ensureKakaoSdk()).catch(() => { /* 폴백 */ })
  }, [load])

  async function renew() {
    if (!(await confirmDialog({ message: '새 링크를 만들면 지금 링크는 더 이상 쓸 수 없어요. 만들까요?', danger: true }))) return
    setBusy(true)
    const next = await create()
    setBusy(false)
    if (next) toast.success('새 영입 링크를 만들었어요. 예전 링크는 이제 쓸 수 없어요.')
  }

  async function revoke() {
    if (!(await confirmDialog({ message: '이 링크를 끊을까요? 이미 맡긴 매장은 그대로예요.', danger: true }))) return
    setBusy(true)
    const r = await agencyRequest('/store-invite/revoke', { method: 'POST' })
    setBusy(false)
    if (!r.ok) { toast.error(r.data.error || '끊지 못했어요.'); return }
    setInvite(null)
  }

  async function saveShare() {
    const pct = shareInput.trim() === '' ? 0 : Number(shareInput)
    setBusy(true)
    const r = await agencyRequest<{ sharePct: number; message?: string }>('/store-invite/share', { method: 'POST', body: { pct } })
    setBusy(false)
    if (!r.ok) { toast.error(r.data.error || '저장하지 못했어요.'); return }
    setSharePct(Number(r.data.sharePct) || 0)
    toast.success(r.data.message || '저장했어요.')
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('링크를 복사했어요. 사장님께 붙여 넣어 보내 주세요.')
    } catch {
      inputRef.current?.select()
      toast.info('링크를 선택해 두었어요. 길게 눌러 복사해 주세요.')
    }
  }

  async function sendKakao() {
    if (!invite) return
    const c = agencyInviteCardCopy(agencyName)
    const payload = feedPayload({ title: c.title, description: c.description, url: invite.url, buttons: [{ title: c.button }] })
    if (sendKakaoShare(payload)) return
    if (await shareViaKakao(payload)) return
    try {
      if (navigator.share) { await navigator.share({ title: c.title, text: c.description, url: invite.url }); return }
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return
    }
    await copy(invite.url)
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1D1F29] p-6 shadow-lift">
      {/* 제목은 시트 머리('매장 영입 링크')가 말한다 — 같은 말을 두 번 하지 않는다. */}
      <p className="text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
        사장님이 링크를 열어 [맡기기] 한 번이면 바로 운영을 시작해요. 아직 유어딜에 없는 매장은 그 링크에서 등록하면 등록과 동시에 연결돼요. 한 링크를 여러 매장에 계속 보내도 돼요.
      </p>
      {sharePct !== null && (
        <div className="mt-3 flex items-center gap-3" data-testid="agency-invite-share">
          <label htmlFor="agency-invite-share-pct" className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-gray-900 dark:text-white">우리 몫</span>
            <span className="block text-[12px] text-gray-500 dark:text-gray-400">판매액의 %. 사장님이 링크에서 보고 맡기면 그 매장에 그대로 적용돼요</span>
          </label>
          {canManage ? (
            <>
              <span className="relative">
                <input id="agency-invite-share-pct" type="number" inputMode="decimal" min={0} max={90} step={0.5} value={shareInput}
                  onChange={(e) => setShareInput(e.target.value)} placeholder="0"
                  className="h-10 w-20 rounded-xl bg-gray-50 dark:bg-white/5 pl-3 pr-7 text-right text-[15px] text-gray-900 dark:text-white tabular-nums outline-none" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-gray-400 dark:text-gray-500">%</span>
              </span>
              <button type="button" disabled={busy || (Number(shareInput) || 0) === sharePct} onClick={() => { void saveShare() }}
                className="h-10 shrink-0 rounded-xl bg-gray-100 dark:bg-white/10 px-4 text-[13px] font-medium text-gray-700 dark:text-gray-200 disabled:opacity-50">저장</button>
            </>
          ) : (
            <span className="text-[15px] font-medium text-gray-900 dark:text-white tabular-nums">{sharePct ? `${sharePct}%` : '정하지 않음'}</span>
          )}
        </div>
      )}
      {error ? (
        <>
          <p className="mt-3 text-[13px] text-tone-bad">{error}</p>
          <button type="button" onClick={() => { void load() }} className="mt-3 h-10 rounded-xl bg-brand px-4 text-[13px] font-medium text-white">다시 시도</button>
        </>
      ) : invite === undefined ? (
        <p className="mt-3 text-[13px] text-gray-500 dark:text-gray-400">링크 준비 중…</p>
      ) : invite ? (
        <>
          <button type="button" onClick={() => { void sendKakao() }} data-testid="agency-invite-kakao"
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] text-[15px] font-medium text-[#3C1E1E] active:opacity-90">
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#3C1E1E" d="M12 3c5.5 0 10 3.58 10 8 0 4.42-4.5 8-10 8-1.15 0-2.25-.16-3.28-.45L3 21l1.45-5.72C3.55 14.2 3 12.66 3 11c0-4.42 4.5-8 9-8z" />
            </svg>
            카카오톡으로 보내기
          </button>
          <div className="mt-3 flex gap-2">
            <input ref={inputRef} readOnly value={invite.url} onFocus={(e) => e.currentTarget.select()} aria-label="영입 링크"
              className="min-w-0 flex-1 rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200 outline-none" />
            <button type="button" onClick={() => { void copy(invite.url) }}
              className="h-10 shrink-0 rounded-xl bg-gray-100 dark:bg-white/10 px-4 text-[13px] font-medium text-gray-700 dark:text-gray-200">복사</button>
          </div>
          <div className="mt-3 flex items-center gap-3 text-[12px] text-gray-500 dark:text-gray-400">
            <span>이 링크로 맡긴 매장 {invite.useCount}곳</span>
            {canManage && (
              <>
                <button type="button" disabled={busy} onClick={() => { void renew() }} className="ml-auto font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50">새로 만들기</button>
                <button type="button" disabled={busy} onClick={() => { void revoke() }} className="font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50">끊기</button>
              </>
            )}
          </div>
        </>
      ) : !canManage ? (
        <p className="mt-3 text-[13px] text-gray-500 dark:text-gray-400">아직 영입 링크가 없어요. 관리자에게 만들어 달라고 해 주세요.</p>
      ) : (
        <button type="button" disabled={busy}
          onClick={async () => { setBusy(true); const n = await create(); setBusy(false); if (n) toast.success('영입 링크를 만들었어요.') }}
          className="mt-5 h-10 rounded-xl bg-brand px-4 text-[13px] font-medium text-white disabled:opacity-50">영입 링크 만들기</button>
      )}
    </div>
  )
}
