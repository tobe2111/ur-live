/**
 * 🎫 지갑 한 줄 — 펼치지 않은 이용권 (2026-09-15 대표 확정 "안 E")
 *
 * ## 왜 생겼나
 * 대표가 지갑 시안 5개 중 **안 E(컴팩트)** 를 골랐다. 그전까지 `/my-vouchers` 는 가진 이용권을
 * **전부 펼친 티켓**으로 그렸다. 한 장이 세로 260px 쯤이라 3장이면 스크롤 한 번으로 끝나고,
 * 8장이면 "내가 뭘 갖고 있나" 를 훑는 데 네 번을 내려야 한다.
 *
 * ## 규칙
 *   - **가장 급한 한 장만** 티켓으로 펴고(=지금 쓸 것), 나머지는 이 줄로 접는다.
 *   - 줄에는 "무엇을 / 어디서 / 언제까지 / 얼마" 만. 코드·QR·환불은 눌러서 연다.
 *   - 임박(D-2 이하)은 `--tone-bad` 로 굵게 — 지갑에서 유일하게 급한 것이다.
 *
 * ## 표면 규칙 (docs/design/ticket-completion-reference-2026-09.md §1)
 * 줄마다 테두리를 두르지 않는다. 줄들은 **카드 한 장 안**에 들어가고 사이만 `border-rule`.
 * 색은 토큰만 — 툴킷 기본 초록·빨강을 hex 로 직접 적지 말 것(그게 "AI 같다"의 정체였다).
 */
import { Ticket } from 'lucide-react'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import { safeDate } from '@/utils/safe-date'
import type { Voucher } from './types'

/** 남은 일수 — 기한이 없으면 null(기한 없는 이용권도 있다). */
export function daysLeftOf(v: Voucher): number | null {
  const at = safeDate(v.expires_at)
  return at ? Math.max(0, Math.ceil((at.getTime() - Date.now()) / 86400000)) : null
}

export default function WalletRow({ v, t, onOpen }: {
  v: Voucher
  t: (key: string, opts?: Record<string, unknown>) => string
  onOpen: () => void
}) {
  const d = daysLeftOf(v)
  const urgent = v.status === 'unused' && d !== null && d <= 2
  const price = v.applied_price ?? v.product_price ?? null
  const unit = v.deal_only ? t('voucher.deal', { defaultValue: '딜' }) : t('voucher.won', { defaultValue: '원' })

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
    >
      <div className="w-[42px] h-[42px] shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-brand-tint">
        {v.product_image
          ? <img src={cfImage(v.product_image, { width: 140, quality: 82, format: 'auto' }) || v.product_image} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => cfImageOnError(e.currentTarget, v.product_image)} />
          : <Ticket className="w-[18px] h-[18px] text-brand-text/45" strokeWidth={1.6} aria-hidden />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-bold tracking-tight text-gray-900 dark:text-white truncate">{v.product_name}</div>
        <div className="text-[11.5px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
          {v.restaurant_name || ''}
          {d !== null && (
            <>
              {v.restaurant_name ? ' · ' : ''}
              <span className={urgent ? 'font-extrabold text-tone-bad' : ''}>{d === 0 ? 'D-DAY' : `D-${d}`}</span>
            </>
          )}
        </div>
      </div>

      {price !== null && (
        <div className="shrink-0 text-[14px] font-extrabold tabular-nums text-gray-700 dark:text-gray-200">
          {formatNumber(price)}<span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 ml-0.5">{unit}</span>
        </div>
      )}
    </button>
  )
}
