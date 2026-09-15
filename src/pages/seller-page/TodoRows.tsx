/**
 * ✅ 지금 처리할 일 — 홈 둘째 블록 (M2 시안 · 2026-09-14).
 *   행 하나 = [점 · 제목/설명 · 행동 칩]. 점 색이 곧 종류다(브랜드 = 새 주문, 초록 = 돈, 회색 = 그 외).
 *   할 일이 없을 때는 자리를 없애지 않고 **무엇을 하면 채워지는지**를 적는다(Rinda 시안 §1 마지막 줄).
 *   🎨 강조는 브랜드 틴트 칩 하나 — 검은 타일(2026-09-14 오전에 걷어낸 것)은 여기로 돌아오지 않는다.
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatWon } from '@/utils/format'

interface Props {
  pendingOrders: number
  withdrawable: number
  /** 이용권이 0개면 빈 상태 문구가 "이용권을 등록하면"이 된다. */
  hasVouchers: boolean
}

/** 행동 칩 — 브랜드 틴트 한 가지. (seller-dashboard-b 가드가 이 클래스를 고정한다.) */
const ACT = 'rounded-lg bg-brand-tint px-3 py-2 text-xs font-bold text-brand-text'

export default function TodoRows({ pendingOrders, withdrawable, hasVouchers }: Props) {
  const { t } = useTranslation()
  const rows: Array<{ key: string; to: string; dot: string; title: string; sub: string; act: string }> = []
  if (pendingOrders > 0) {
    rows.push({
      key: 'orders', to: '/seller/orders', dot: 'bg-brand',
      title: t('seller.home.newOrders', { defaultValue: '새 주문 {{count}}건', count: pendingOrders }),
      sub: t('seller.home.newOrdersSub', { defaultValue: '확인하고 준비를 시작하세요' }),
      act: t('seller.home.confirm', { defaultValue: '확인' }),
    })
  }
  if (withdrawable > 0) {
    rows.push({
      key: 'settle', to: '/seller/settlements', dot: 'bg-emerald-500',
      // 💸 금액 키 — 돈을 건수({{count}}건)로 말하던 2026-09-14 오전의 버그 자리. 금액은 금액 키로만.
      title: t('seller.settlementAvailableAmount', { amount: formatWon(withdrawable), defaultValue: '정산 가능 {{amount}}' }),
      sub: t('seller.home.settleSub', { defaultValue: '지금 출금 신청할 수 있어요' }),
      act: t('seller.home.withdraw', { defaultValue: '출금' }),
    })
  }
  return (
    <section>
      <h2 className="mb-1.5 flex items-baseline justify-between px-1 text-[13px] font-extrabold text-gray-900">
        {t('seller.home.todoTitle', { defaultValue: '지금 처리할 일' })}
        {rows.length > 0 && <Link to="/seller/orders" className="text-[12px] font-bold text-brand-text">{t('seller.all')}</Link>}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-rule bg-white">
        {rows.length === 0 ? (
          <p className="px-4 py-4 text-[13px] leading-relaxed text-gray-500">
            {hasVouchers
              ? t('seller.home.todoEmpty', { defaultValue: '지금 처리할 일이 없어요. 새 주문과 정산이 여기에 모입니다.' })
              : t('seller.actionItemsEmpty', { defaultValue: '지금 처리할 일이 없어요. 이용권을 등록하면 주문과 정산이 여기에 모입니다.' })}
          </p>
        ) : rows.map((r) => (
          <Link key={r.key} to={r.to} className="flex items-center gap-3 px-4 py-3.5 [&+&]:border-t [&+&]:border-rule active:bg-gray-50">
            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${r.dot}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-extrabold text-gray-900">{r.title}</span>
              <span className="block truncate text-[12px] text-gray-400">{r.sub}</span>
            </span>
            <span className={ACT}>{r.act}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
