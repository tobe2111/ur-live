/**
 * 🦦 첫 이용권 축하 시트 — **딱 한 번** (2026-10-09 대표 확정 시안 ④ — "좋다 모두 해줘").
 *
 * 왜 지갑에서 뜨나: 결제 완료 화면은 토스 잠금 파일이라 거기에 끼우지 않았다(대표 승인 범위 =
 * 지갑 렌더 줄). 결제 뒤 사람이 가는 곳이 곧 지갑이고, 지갑이 "산 것을 처음 보는 자리" 다.
 *
 * 규칙
 *   · 지갑의 이용권이 **정확히 1장**일 때만 판정한다 — 이미 여러 장 가진 사람에게 "첫 이용권이에요!" 는 거짓말이다.
 *   · 한 번 띄우면 기기에 표시를 남겨 다시 안 띄운다(축하가 매번 뜨면 금방 소음이 된다).
 *     저장소가 막힌 기기(사생활 보호 창)에선 **안 띄운다** — 막힌 채로 띄우면 열 때마다 또 뜬다.
 *   · 도장 세 칸은 사실만 찍는다: 첫 구매(늘 찍힘) · 첫 사용(그 장이 사용됐을 때만) · 첫 리뷰(아직 모름 → 빈 칸).
 */
import { useEffect, useState } from 'react'
import Udal from '@/components/mascot/Udal'
import type { Voucher } from './types'

const SEEN_KEY = 'ur_first_voucher_cheer_v1'

function storageOk(): boolean {
  try {
    const k = '__ur_probe__'
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return true
  } catch { return false }
}

function alreadySeen(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return true }
}

export default function FirstVoucherSheet({ items, t }: {
  /** 이 지갑의 이용권 전부(상태 무관). */
  items: Voucher[]
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const [open, setOpen] = useState(false)
  const only = items.length === 1 ? items[0] : null

  useEffect(() => {
    if (!only || !storageOk() || alreadySeen()) return
    try { localStorage.setItem(SEEN_KEY, '1') } catch { return }
    setOpen(true)
  }, [only])

  if (!open || !only) return null
  const stamps = [
    { label: t('voucher.firstStampBuy', { defaultValue: '첫 구매' }), done: true },
    { label: t('voucher.firstStampUse', { defaultValue: '첫 사용' }), done: only.status === 'used' },
    { label: t('voucher.firstStampReview', { defaultValue: '첫 리뷰' }), done: false },
  ]

  return (
    <div className="fixed inset-0 z-[10600] bg-black/45 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-voucher-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[430px] rounded-t-3xl sm:rounded-3xl bg-surface px-6 pt-3 flex flex-col items-center text-center"
        style={{ paddingBottom: 'max(1.75rem, env(safe-area-inset-bottom))' }}
      >
        <div aria-hidden="true" className="w-10 h-1 rounded-full bg-gray-200 dark:bg-[#2C2F35]" />
        <div className="mt-5"><Udal mood="done" size={120} motion priority /></div>
        <h2 id="first-voucher-title" className="mt-4 text-[24px] font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white">
          {t('voucher.firstTitle', { defaultValue: '첫 이용권이에요!' })}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-gray-500 dark:text-gray-400">
          {t('voucher.firstDesc', { defaultValue: '매장에서 이용권의 QR만 보여주면 끝이에요. 유달이가 도장 하나 찍어 둘게요.' })}
        </p>
        <ul className="mt-6 w-full grid grid-cols-3 gap-2">
          {stamps.map((s) => (
            <li key={s.label} className="flex flex-col items-center gap-2">
              {s.done ? (
                <span className="w-14 h-14 rounded-full bg-brand flex items-center justify-center">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </span>
              ) : (
                <span className="w-14 h-14 rounded-full border-2 border-dashed border-gray-300 dark:border-[#3A3D45]" />
              )}
              <span className={`text-[13px] ${s.done ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                {s.label}{!s.done && <span className="sr-only"> {t('voucher.firstStampTodo', { defaultValue: '아직 안 함' })}</span>}
              </span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setOpen(false)} className="ur-btn ur-btn-lg ur-btn-block ur-btn-primary mt-7">
          {t('common.confirm', { defaultValue: '확인' })}
        </button>
      </div>
    </div>
  )
}
