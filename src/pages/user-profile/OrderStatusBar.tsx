/**
 * 🎟️ 2026-09-02 (대표 "주문현황도 배송 형태는 아니고, 이용권 현황에 맞게 변경해야지")
 *
 * 이 바는 쇼핑몰에서 그대로 옮겨온 **배송 5단계**(결제완료 → 배송준비 → 배송중 → 배송완료 → 리뷰)였다.
 * 그런데 유어딜이 파는 것은 **매장에서 쓰는 이용권**과 **문자로 오는 교환권**이라 배송이 아예 없다 —
 * 다섯 칸 중 셋은 이 서비스에서 **영원히 0** 이다(쇼핑탭은 2026-07-10 부터 숨김).
 * 심지어 아래 `hasAnyOrder` 가 "0이면 숨긴다" 로 그 사실을 가리고 있었다 — 바가 안 보이는 게
 * 정상이 된 지 오래였다는 뜻이다.
 *
 * ⇒ 이용권의 실제 생애로 바꾼다: **구매완료 → 사용가능 → 사용완료 → 만료·환불**.
 *   숫자는 주문(orders)이 아니라 **이용권(vouchers)** 에서 센다 — 사람이 세는 단위가 그것이다
 *   ("내 이용권 몇 장 남았나"). 데이터는 `/my-vouchers` 지갑과 **같은 훅**을 쓰므로 두 화면이 갈릴 수 없다.
 *
 * ⚠️ 기존 5칸의 배송 필터(`/my-orders?status=`)는 **지우지 않았다** — 쇼핑을 다시 열면 그 화면이
 *   그대로 필요하다. 여기(마이페이지 요약)에서만 이용권 기준으로 바꾼다.
 *
 * 🩸 2026-09-03 (대표 신고 — *"이용권 구매완료 사용가능 되어있는데 잘못됐어"*): 이 바가 **한 화면 안에서
 *   자기 자신과 모순**돼 있었다 — 위에서는 "이용권 현황 · 구매완료 1 · 사용가능 1" 인데 바로 아래
 *   "내 이용권" 행은 **0** 이었다. 실측한 그 1건의 정체:
 *
 *     `voucher_orders` id 1 · KT-알파 **교환권** · `status='failed'`(발송 실패, `sent_at` 없음)
 *
 *   두 가지가 겹쳤다.
 *   ① **지갑을 안 나눴다.** `/api/vouchers/my` 는 이용권(내부)과 교환권(KT)을 **한 배열**로 준다.
 *      아래 "내 이용권"/"내 교환권" 두 행은 `useMyCounts` 가 `voucher-wallet` SSOT 로 갈라 세는데,
 *      이 바만 통째로 세고 있었다. 그래서 **교환권 한 장이 '이용권'으로 둔갑**했다.
 *   ② **모르는 상태를 '사용가능' 으로 셌다.** 아래 분류가 `used`/`refunded`/`expired` 만 알고
 *      나머지를 전부 `else → usable` 로 떨어뜨렸다. 그런데 KT 병합은 발송 실패를 `status:'unused'`
 *      + `kt_status:'failed'` 로 실어 보낸다(카드가 실패 UI 를 그리라고 — 2026-06-17). 그 결과
 *      **발송조차 안 된 교환권이 "지금 쓸 수 있음" 으로 집계**됐다.
 *
 *   ⇒ ① 이 바는 **이용권만** 센다(`isStoreVoucher` — 라벨도 목적지(`/my-vouchers`)도 이용권이다).
 *      ② '사용가능' 은 **허용목록**으로만 — `unused` 일 때만. 모르는 상태는 어느 칸에도 안 넣는다
 *         (구매완료는 총계라 나머지 셋의 합과 달라도 된다. **틀린 칸에 넣느니 안 세는 게 낫다.**)
 *
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 주문 현황 바.
 * 🛡️ 2026-07-02: ① 별도 api.get → 공유 훅 재사용(RQ 캐시 공유). ⚠️ 그때는 주문 훅이었으나
 *   2026-09-02 에 이용권 훅으로 바뀌었다(위 참조) — 이 줄은 '직접 fetch 하지 않는다' 는 계약만 남긴다.
 *   ② 5칸이 전부 무필터 /my-orders 로 가던 것 → 상태 필터(?status=) 전달, '리뷰'는 /my-reviews 로.
 *   ③ '리뷰' 카운트가 항상 0이던 죽은 지표 → 리뷰 작성 가능 주문 수(배송완료·구매확정 — /my-reviews 와 동일 기준).
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMyVouchers } from '@/hooks/queries/useMyData'
import { parseUTCDate } from '@/utils/date'
import { isStoreVoucher } from '@/shared/voucher-wallet'

/** `source`/`deal_only` 는 지갑 판정(`voucher-wallet` SSOT)이 읽는 필드다. */
interface VoucherRow { status?: string | null; expires_at?: string | null; source?: unknown; deal_only?: unknown }

export default function OrderStatusBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: vouchersRaw = [] } = useMyVouchers()

  const counts = useMemo(() => {
    const c: Record<string, number> = { bought: 0, usable: 0, used: 0, gone: 0 }
    const now = Date.now()
    for (const v of vouchersRaw as VoucherRow[]) {
      // 🎟️ 교환권(KT·딜 전용)은 여기서 세지 않는다 — 아래 '내 교환권' 행이 맡는다.
      //   두 화면이 **같은 SSOT** 로 갈라야 마이페이지가 자기 자신과 안 어긋난다.
      if (!isStoreVoucher(v)) continue
      const st = String(v.status || '').toLowerCase()
      c.bought++                                    // 산 것 전체 — "내가 지금까지 몇 장 샀나"
      if (st === 'used') { c.used++; continue }
      if (st === 'refunded' || st === 'expired') { c.gone++; continue }
      // 🕐 만료 판정은 **SSOT** 로만(`utils/date`). 손으로 `+ 'Z'` 를 붙이면 이미 'Z' 가 붙어 온 값
      //   (KT-알파 병합 경로 등)에서 `...ZZ` → NaN → `NaN < now` 가 **false** 라 만료된 이용권이
      //   조용히 '사용가능' 으로 세어진다. `parseUTCDate` 가 두 형태를 모두 받는다.
      if (v.expires_at && parseUTCDate(v.expires_at).getTime() < now) { c.gone++; continue }
      // ✅ 허용목록 — `else c.usable++` 로 두면 **모르는 상태가 전부 '사용가능'** 이 된다(이번 사고).
      //   `''` 는 컬럼 DEFAULT('unused')와 같은 뜻이라 함께 받는다. 그 밖은 어느 칸에도 안 넣는다.
      if (st === 'unused' || st === '') c.usable++   // 미사용 + 기간 안 — 지금 쓸 수 있는 것
    }
    return c
  }, [vouchersRaw])

  // 산 적이 없으면 0 넷을 보여줄 이유가 없다(기존 동작 승계).
  if (!counts.bought) return null

  const items = [
    { label: t('voucherStatus.bought', { defaultValue: '구매완료' }), key: 'bought', path: '/my-vouchers' },
    { label: t('voucherStatus.usable', { defaultValue: '사용가능' }), key: 'usable', path: '/my-vouchers' },
    { label: t('voucherStatus.used', { defaultValue: '사용완료' }), key: 'used', path: '/my-vouchers' },
    { label: t('voucherStatus.gone', { defaultValue: '만료·환불' }), key: 'gone', path: '/my-vouchers' },
  ]

  return (
    <div className="ur-content-medium px-4 lg:px-8 pt-3">
      <p className="text-[12px] font-bold text-gray-900 dark:text-white mb-3">{t('voucherStatus.sectionTitle', { defaultValue: '이용권 현황' })}</p>
      <div className="flex items-center justify-between rounded-2xl px-2 py-4 bg-white dark:bg-[#1D1F29]">
        {items.map(o => (
          <button key={o.label} onClick={() => navigate(o.path)} className="flex-1 text-center">
            <p className={`text-[18px] font-extrabold ${counts[o.key] ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-white/20'}`} style={{ letterSpacing: '-0.02em' }}>
              {counts[o.key] || 0}
            </p>
            <p className="text-[9px] text-gray-900 dark:text-white/55 mt-0.5">{o.label}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
