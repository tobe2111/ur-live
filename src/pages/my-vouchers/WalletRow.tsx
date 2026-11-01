/**
 * 🎫 지갑 한 줄 — 펼치지 않은 이용권 (2026-09-15 대표 확정 "안 E")
 *
 * ## 왜 생겼나
 * 대표가 지갑 시안 5개 중 **안 E(컴팩트)** 를 골랐다. 그전까지 `/my-vouchers` 는 가진 이용권을
 * **전부 펼친 티켓**으로 그렸다. 한 장이 세로 260px 쯤이라 3장이면 스크롤 한 번으로 끝나고,
 * 8장이면 "내가 뭘 갖고 있나" 를 훑는 데 네 번을 내려야 한다.
 *
 * ## 규칙
 *   - ~~가장 급한 한 장만 티켓으로 펴고 나머지는 이 줄로 접는다~~ → 2026-10-14 대표 확정 **안 B**: 사용 가능한
 *     이용권은 **전부 이 줄**이다(같은 물건이 첫 장만 다르게 보였다 — 대표 스크린샷). 오른쪽은 [사용] 알약.
 *   - 줄에는 "무엇을 / 어디서 / 언제까지" 만. 코드·QR·환불은 눌러서 연다.
 *   - 남은 기간(D-N)을 말한다 (2026-10-07 대표 *"응 남은 기간 표시로 해줘"*) — 안 B 에서 이름 아래 줄로 옮겼다.
 *     지갑 A안에서 금액은 머리글 합계 한 번만 말한다 — 줄마다 장별 가격을 또 적으면 같은 말의 반복이고,
 *     이미 산 이용권에서 사람이 훑는 건 "얼마였나"가 아니라 "언제까지 써야 하나"다.
 *   - 임박(D-2 이하)은 `--tone-bad` 로 굵게 — 지갑에서 유일하게 급한 것이다.
 *
 * ## 표면 규칙 (docs/design/ticket-completion-reference-2026-09.md §1)
 * 줄마다 테두리를 두르지 않는다. 줄들은 **카드 한 장 안**에 들어가고 사이만 `border-rule`.
 * 색은 토큰만 — 툴킷 기본 초록·빨강을 hex 로 직접 적지 말 것(그게 "AI 같다"의 정체였다).
 */
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { TicketStubIcon, ClockIcon } from '@/components/icons/urdeal-icons'
import { safeDate } from '@/utils/safe-date'
import type { Voucher } from './types'

/** 🔴 '곧 끝난다' 의 기준(남은 일수 이하). 접힌 줄의 빨간 D-N 과 지갑 위 만료 임박 줄이 **같은 값**을 쓴다
 *   — 둘이 갈리면 위에선 "곧 끝나요" 라는데 줄은 회색인 화면이 된다. */
export const URGENT_DAYS = 2

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
  const urgent = v.status === 'unused' && d !== null && d <= URGENT_DAYS

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
    >
      <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-brand-tint">
        {v.product_image
          ? <img src={cfImage(v.product_image, { width: 168, quality: 82, format: 'auto' }) || v.product_image} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => cfImageOnError(e.currentTarget, v.product_image)} />
          : <TicketStubIcon className="w-5 h-5 text-brand-text opacity-45" aria-hidden />}
      </div>

      <div className="flex-1 min-w-0">
        {v.restaurant_name && (
          <div className="text-[13px] text-gray-500 dark:text-gray-400 truncate">{v.restaurant_name}</div>
        )}
        <div className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-white truncate">{v.product_name}</div>
        {/* 🎫 2026-10-14 안 B: 남은 기간은 이름 아래 한 줄로 내려왔다(오른쪽은 [사용] 자리). 값과 임박 색은 그대로. */}
        <div className={`mt-1 flex items-center gap-1 text-[12px] tabular-nums ${urgent ? 'font-medium text-tone-bad' : 'text-gray-500 dark:text-gray-400'}`}>
          <ClockIcon className="w-[13px] h-[13px] shrink-0" aria-hidden />
          {d === null ? t('voucher.noExpiry', { defaultValue: '기한 없음' }) : d === 0 ? 'D-DAY' : `D-${d}`}
        </div>
      </div>

      {/* 줄 전체가 버튼이라 이 알약은 그림이다 — 누를 곳이 어딘지 말해 준다. */}
      {v.status === 'unused' && (
        <span aria-hidden className="shrink-0 inline-flex items-center h-8 px-3 rounded-full bg-brand text-white text-[13px] font-medium">
          {t('voucher.use', { defaultValue: '사용' })}
        </span>
      )}
    </button>
  )
}
