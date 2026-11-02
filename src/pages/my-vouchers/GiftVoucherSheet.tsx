/**
 * 🎁 이용권 선물 시트 (2026-10-11 대표 "1,2,4 해줄래" 중 4번 · 결정 "내 이용권 넘기기" + "받은 뒤엔 환불 막기")
 *
 * 두 단계다: ① 선물 링크 만들기(서버) ② 카카오톡으로 보내기(카카오 공유창 = 친구 고르기).
 * 한 번에 하지 않는 이유: 공유창은 **누른 순간**에 열어야 폰 브라우저가 막지 않는다 — 서버 왕복을
 * 기다린 뒤 열면 일부 브라우저가 "사용자가 누르지 않은 이동" 으로 보고 막는다.
 * 친구 고르기는 카카오 공유창이 한다(별도 '친구 목록' 권한·심사 불필요).
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { GiftBoxIcon } from '@/components/icons/urdeal-icons'
import { feedPayload, sendKakaoShare } from '@/lib/kakao-share'
import { X } from 'lucide-react'
import type { Voucher } from './types'
import { injectMotionCss } from '@/lib/motion-css'
// 🎬 이 부품이 쓰는 움직임 CSS 만 — 불러올 때 한 번 꽂는다(lib/motion-css.ts 머리말)
injectMotionCss('ur-m-gift', `@keyframes ur-draw { from { stroke-dashoffset: 120; } to { stroke-dashoffset: 0; } }.ur-gift-mark { animation: ur-popin .45s cubic-bezier(.3,1.3,.5,1) both; }.ur-gift-mark path { stroke-dasharray: 120; animation: ur-draw .45s ease-out .35s both; }.ur-gift-mark path + path { animation-delay: .7s; }.ur-gift-mark, .ur-gift-mark path,  .ur-upload-img, .ur-upload-bar > span { transition: none !important; }@media (prefers-reduced-motion: reduce){.ur-gift-mark,.ur-gift-mark path{animation:none!important}}`)
injectMotionCss('ur-m-popin', `@keyframes ur-popin { 0% { opacity: 0; transform: scale(.5); } 70% { opacity: 1; transform: scale(1.1); } 100% { opacity: 1; transform: none; } }.ur-popin { animation: ur-popin .4s cubic-bezier(.3,1.3,.5,1) both; }.ur-slam, .ur-thud, .ur-popin, .ur-rise, .ur-ring, .ur-flash,@media (prefers-reduced-motion: reduce){.ur-popin{animation:none!important}}`)

type Pending = { token: string; url: string }

/**
 * 🔁 2026-10-12 — 카드 조립·전송을 `lib/kakao-share.ts` 로 **행동 불변**으로 옮겼다(사본 셋 방지).
 *   **동기 유지**가 중요하다 — 위 머리말대로 공유창은 누른 순간에 열어야 폰 브라우저가 안 막는다.
 */
function sendKakao(v: Voucher, url: string): boolean {
  return sendKakaoShare(feedPayload({
    title: '이용권 선물이 도착했어요',
    description: [v.product_name, v.restaurant_name].filter(Boolean).join(', '),
    imageUrl: v.product_image && /^https:\/\//.test(v.product_image) ? v.product_image : undefined,
    url,
    buttons: [{ title: '선물 받기' }],
  }))
}

export default function GiftVoucherSheet({ voucher, onClose, onPendingChange }: {
  voucher: Voucher
  onClose: () => void
  /** 🔒 링크가 살아 있는지(=이용권이 잠겼는지) 바뀔 때 — 사용 화면이 잠금/해제를 따라간다. */
  onPendingChange?: (pending: boolean) => void
}) {
  useEscapeKey(onClose)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<Pending | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  // 🎬 2026-11-02 시안 4차 "선물하기 완료": 방금 만든 링크일 때만 상자가 톡 나타나고 리본이 그려진다.
  const [justCreated, setJustCreated] = useState(false)

  useEffect(() => {
    let alive = true
    import('@/lib/kakao-sdk').then((m) => m.ensureKakaoSdk()).catch(() => { /* 복사로 대체 */ })
    api.get(`/api/group-buy/gifts/by-voucher/${encodeURIComponent(voucher.code)}`)
      .then((r) => { if (alive) { setPending(r.data?.data ?? null); onPendingChange?.(!!r.data?.data) } })
      .catch(() => { /* 없으면 새로 만든다 */ })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [voucher.code])

  const create = async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await api.post('/api/group-buy/gifts', { code: voucher.code, message: message.trim() || undefined })
      setPending(r.data?.data ?? null)
      onPendingChange?.(!!r.data?.data)
      if (r.data?.data) setJustCreated(true)
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '선물 링크를 만들지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); toast.success('선물 링크를 복사했어요') } catch { toast.error('복사하지 못했어요') }
  }

  const share = (url: string) => {
    if (!sendKakao(voucher, url)) void copy(url)
  }

  const revoke = async (token: string) => {
    if (busy) return
    setBusy(true)
    try {
      await api.post(`/api/group-buy/gifts/${encodeURIComponent(token)}/cancel`)
      setPending(null)
      onPendingChange?.(false)
      toast.success('선물 보내기를 취소했어요. 이용권은 그대로 내 지갑에 있어요')
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '선물 보내기를 취소하지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10700] flex items-end sm:items-center justify-center bg-black/60" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="이용권 선물하기"
        onClick={(e) => e.stopPropagation()}
        className="ur-sheet-in w-full sm:max-w-[420px] bg-surface rounded-t-2xl sm:rounded-2xl px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <GiftBoxIcon size={20} /> 이용권 선물하기
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="w-11 h-11 -mr-3 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">{voucher.product_name}{voucher.restaurant_name ? ` · ${voucher.restaurant_name}` : ''}</p>

        <ul className="mt-4 space-y-1">
          {[
            '친구가 받으면 이 이용권은 친구 지갑으로 옮겨가요',
            '선물 링크를 만들면 친구가 받기 전까지 이 이용권은 쓸 수 없어요(선물 보내기를 취소하면 다시 쓸 수 있어요)',
            '받은 뒤에는 보낸 사람도 받은 사람도 직접 취소·환불할 수 없어요',
          ].map((s) => (
            <li key={s} className="flex gap-2 text-[13px] text-gray-600 dark:text-gray-300 leading-snug"><span aria-hidden>·</span><span>{s}</span></li>
          ))}
        </ul>

        {loading ? (
          <div className="mt-5 h-[52px] rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ) : pending ? (
          <>
            {justCreated && (
              <svg className="ur-gift-mark mx-auto mt-5 block w-16 h-16" viewBox="0 0 110 110" aria-hidden="true">
                <rect x="18" y="42" width="74" height="56" rx="8" fill="var(--brand-tint)" stroke="var(--brand-text)" strokeWidth="3" />
                <rect x="12" y="30" width="86" height="16" rx="5" fill="var(--brand-tint)" stroke="var(--brand-text)" strokeWidth="3" />
                <path d="M55 30 V98" stroke="var(--brand)" fill="none" strokeWidth="6" strokeLinecap="round" />
                <path d="M55 30 C40 12 26 22 38 30 M55 30 C70 12 84 22 72 30" stroke="var(--brand)" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <p className="mt-5 text-[13px] font-medium text-gray-900 dark:text-white">선물 링크가 준비됐어요. 친구에게 보내 주세요</p>
            <button type="button" onClick={() => share(pending.url)}
              className="mt-3 w-full py-4 rounded-2xl bg-brand text-white text-[15px] font-bold active:scale-[0.98] transition-transform">
              카카오톡으로 보내기
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => copy(pending.url)}
                className="py-3 rounded-xl border border-rule-strong text-gray-900 dark:text-white text-[13px] font-medium">
                링크 복사
              </button>
              <button type="button" onClick={() => revoke(pending.token)} disabled={busy}
                className="py-3 rounded-xl border border-rule-strong text-gray-500 dark:text-gray-400 text-[13px] font-medium disabled:opacity-50">
                선물 보내기 취소
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="mt-5 block text-[13px] font-medium text-gray-900 dark:text-white" htmlFor="gift-msg">함께 보낼 말 (선택)</label>
            <textarea id="gift-msg" value={message} onChange={(e) => setMessage(e.target.value.slice(0, 100))} rows={2}
              placeholder="맛있게 먹어!"
              className="mt-2 w-full rounded-xl border border-rule-strong bg-surface px-3 py-2 text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none" />
            <button type="button" onClick={create} disabled={busy}
              className="mt-3 w-full py-4 rounded-2xl bg-brand text-white text-[15px] font-bold disabled:opacity-50 active:scale-[0.98] transition-transform">
              {busy ? '만드는 중…' : '선물 링크 만들기'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
