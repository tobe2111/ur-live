/**
 * 🎟️ **이 주문으로 발급된 이용권** — 코드와 사용 여부.
 *
 * 대표 신고 2026-09-21: *"어떤 이용권인지도 나와야지"*. 이용권 주문에서 셀러가 할 일은
 * **사용처리** 하나인데, 주문 상세가 그 대상(코드)을 한 글자도 안 보여 줬다. 손님은
 * `UR-LUBA-RCP5` 를 들고 오는데 화면엔 상품명 `테스트1` 만 있었다.
 *
 * ## 모르는 것과 없는 것을 구분한다
 * - `vouchers` 가 **undefined** = 서버가 안 실어 준 것(구 응답·조회 실패) → **아무 말도 안 한다.**
 * - 빈 배열 = 정말 0장 → "발급된 이용권이 없습니다" 라고 말해도 된다.
 * 이걸 합치면 조회가 한 번 실패한 날 화면이 "이용권 없음"이라고 **단언**하게 된다.
 */
import { useTranslation } from 'react-i18next'
import { formatKSTDate } from '@/utils/date'
import type { OrderVoucher } from './types'

export function VoucherCodes({ vouchers }: { vouchers?: OrderVoucher[] }) {
  const { t } = useTranslation()

  /** `unused` / `used` / 그 외(환불·만료 등)를 셀러가 읽는 말로. */
  const statusLabel = (v: OrderVoucher): { text: string; cls: string } => {
    if (v.status === 'used') return { text: t('seller.voucherUsed', { defaultValue: '사용완료' }), cls: 'bg-gray-100 text-gray-600 border-gray-200' }
    if (v.status === 'unused') return { text: t('seller.voucherUnused', { defaultValue: '미사용' }), cls: 'bg-white text-tone-ok border-rule' }
    // 모르는 상태를 '미사용'으로 보여 주면 셀러가 손님을 받아 버린다 — 원문을 그대로 둔다.
    return { text: v.status, cls: 'bg-white text-tone-warn border-rule' }
  }

  if (!vouchers) return null
  if (vouchers.length === 0) {
    return <p className="text-sm text-gray-500">{t('seller.voucherNone', { defaultValue: '아직 발급된 이용권이 없습니다.' })}</p>
  }

  return (
    <ul className="space-y-2">
      {vouchers.map((v) => {
        const s = statusLabel(v)
        return (
          <li
            key={v.code}
            className="flex items-center justify-between gap-3 rounded-lg border border-rule bg-white px-3 py-2.5"
          >
            <div className="min-w-0">
              {/* 손님이 불러 주는 값이라 크고 또렷하게 — 여기가 이 화면의 주인공이다 */}
              <p className="font-mono text-[15px] font-bold tracking-wide text-gray-900">{v.code}</p>
              {v.used_at ? (
                <p className="text-[11.5px] text-gray-500 mt-0.5">{t('seller.voucherUsedAt', { defaultValue: '{{d}} 사용', d: formatKSTDate(v.used_at) })}</p>
              ) : v.expires_at ? (
                <p className="text-[11.5px] text-gray-500 mt-0.5">{t('seller.voucherUntil', { defaultValue: '{{d}}까지', d: formatKSTDate(v.expires_at) })}</p>
              ) : null}
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${s.cls}`}>
              {s.text}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
