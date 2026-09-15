/**
 * 🎟️ **이용권 탭 = M4** (2026-09-14 대표 승인 — 모바일 우선 재설계). 시안: `docs/design/seller-dashboard-mobile-first-2026-09.md`.
 *   [이번 달 매출 한 줄] → [판매 중 / 판매 중지 / 종료 세그먼트] → [내 이용권 행(판매수·매출·스위치)] → [하단 고정 등록 버튼].
 *   대표가 꼽은 셋(등록·관리·매출)을 한 화면에 직접 놓는다. PC 는 같은 행이 표로 늘어나고 등록 버튼은 헤더로 간다.
 *
 *   지운 것: 검은 그라디언트 '예상 정산' 카드(표면 규칙 ⑥ 그라디언트 0 · 검은 면) → 각 행의 펼침 안으로. 요약 카드 셋 → 세그먼트 숫자로.
 *   '최근 7일 사용 시도' 카드 → PIN 오류가 성공보다 많을 때만 한 줄 경고(그때만 의미가 있는 정보다).
 *   공구 엔진 패널(`GB_ENGINE_ENABLED`, 기본 OFF)은 그대로 게이트 뒤에 둔다.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Plus, Ticket } from 'lucide-react'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import SellerLayout from '@/components/SellerLayout'
import BrandLoader from '@/components/brand/BrandLoader'
import { SELLER_TABBAR_H } from '@/components/seller-layout/SellerBottomTabs'
import { GB_ENGINE_ENABLED } from '@/shared/feature-flags'
import { formatNumber, formatWon, safeNum } from '@/utils/format'
import { useSellerStats, useSellerVouchers, useSellerWithdrawable, monthRevenue } from './seller-page/useSellerHome'
import VoucherRow, { type VoucherStat } from './seller-group-buy/VoucherRow'
import GbProposalsPanel from './seller-group-buy/GbProposalsPanel'

type Seg = 'on' | 'off' | 'ended'
interface VoucherLogSummary { total: number; success_count: number; pin_errors: number; expired_errors: number; already_used_errors: number }

export default function SellerGroupBuyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const headers = { Authorization: `Bearer ${localStorage.getItem('seller_token')}` }

  const vouchersQ = useSellerVouchers()
  const statsQ = useSellerStats()
  const balanceQ = useSellerWithdrawable()
  const products = vouchersQ.data ?? []
  const productIds = products.map((p) => p.id).join(',')
  const statsByIdQ = useApiQuery<Record<number, VoucherStat>>(['seller', 'gb-voucher-stats', productIds], '/api/group-buy/seller-voucher-stats', {
    params: { product_ids: productIds }, headers, enabled: products.length > 0,
    select: (r: any) => { const map: Record<number, VoucherStat> = {}; if (r?.success) for (const s of (r.data || [])) map[s.product_id] = s; return map },
  })
  const voucherLogsQ = useApiQuery<VoucherLogSummary | null>(['seller', 'gb-voucher-logs'], '/api/group-buy/voucher-logs', { headers, select: (r: any) => (r?.data?.summary ?? null) })
  const commissionQ = useApiQuery<number>(['seller', 'gb-commission-rate'], '/api/group-buy/commission-rate', { select: (r: any) => (r?.rate ? Number(r.rate) : 0.05) })
  const commissionRate = commissionQ.data ?? 0.05
  const logs = voucherLogsQ.data

  const [seg, setSeg] = useState<Seg>('on')
  const buckets = useMemo(() => {
    const ended = products.filter((p) => p.group_buy_status === 'closed' || p.group_buy_status === 'achieved')
    const endedIds = new Set(ended.map((p) => p.id))
    const on = products.filter((p) => p.is_active && !endedIds.has(p.id))
    const off = products.filter((p) => !p.is_active && !endedIds.has(p.id))
    return { on, off, ended }
  }, [products])
  const rows = buckets[seg]
  const totalSold = products.reduce((s, p) => s + safeNum(p.sold), 0)
  const month = monthRevenue(statsQ.data?.daily ?? [])

  if (vouchersQ.isLoading) {
    return <SellerLayout title={t('seller.nav.voucherManage', { defaultValue: '이용권 관리' })}><BrandLoader /></SellerLayout>
  }

  const registerBtn = (cls: string) => (
    <button type="button" onClick={() => navigate('/seller/meal-voucher/new')} className={cls}>
      <Plus className="h-4 w-4" /> {t('seller.registerVoucher', { defaultValue: '이용권 등록' })}
    </button>
  )

  return (
    <SellerLayout title={t('seller.nav.voucherManage', { defaultValue: '이용권 관리' })}>
      <div className="mx-auto max-w-5xl space-y-4">
        {/* ── 이번 달 한 줄 — 숫자가 주인공. PC 는 오른쪽에 등록 버튼. ── */}
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-gray-400">{t('seller.vouchers.thisMonth', { defaultValue: '이번 달' })}</p>
            <p className="text-[28px] font-extrabold leading-tight tracking-tight text-gray-900 lg:text-[32px]">{formatWon(month)}</p>
            <p className="mt-1 text-[12.5px] text-gray-500">
              {t('seller.vouchers.soldTotal', { defaultValue: '판매 {{count}}건', count: totalSold })} · {t('seller.home.settleAvail', { defaultValue: '정산 가능' })} <b className="text-gray-900">{formatWon(balanceQ.data ?? 0)}</b>
            </p>
          </div>
          {registerBtn('ur-btn ur-btn-md ur-btn-primary hidden md:inline-flex')}
        </div>

        {/* ── 세그먼트 — 안 고른 것도 흰 면 위 글자다(테두리 박스로 그리지 않는다). ── */}
        <div className="flex rounded-xl bg-white p-1 border border-rule md:w-fit">
          {([['on', t('seller.vouchers.onSale', { defaultValue: '판매 중' }), buckets.on.length], ['off', t('seller.vouchers.paused', { defaultValue: '판매 중지' }), buckets.off.length], ['ended', t('seller.vouchers.ended', { defaultValue: '종료' }), buckets.ended.length]] as Array<[Seg, string, number]>).map(([k, label, n]) => (
            <button key={k} type="button" onClick={() => setSeg(k)} aria-pressed={seg === k}
              className={`flex-1 rounded-lg px-4 py-2 text-[13.5px] font-bold transition-colors md:flex-none ${seg === k ? 'bg-brand text-white' : 'text-gray-400 hover:text-gray-700'}`}>
              {label} {formatNumber(n)}
            </button>
          ))}
        </div>

        {logs && logs.total > 5 && logs.pin_errors > logs.success_count && (
          <p className="flex items-center gap-1.5 rounded-lg bg-tone-warn-bg px-3 py-2 text-[12px] font-semibold text-tone-warn">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {t('seller.vouchers.pinWarn', { defaultValue: '최근 7일 PIN 오류 {{errors}}건이 성공 {{ok}}건보다 많아요. 가게에 안내된 PIN 을 확인해 주세요.', errors: logs.pin_errors, ok: logs.success_count })}
          </p>
        )}

        {/* 🎟️ 2026-07-06 (§2-B): 공구 제안 인박스 — 게이트 OFF */}
        {GB_ENGINE_ENABLED && products.length > 0 && (
          <GbProposalsPanel products={products.map((p) => ({ id: p.id, name: p.name, price: safeNum(p.price) }))} headers={headers} />
        )}

        {/* ── 행 목록 ── */}
        <div className="overflow-hidden rounded-2xl border border-rule bg-white">
          <div className="hidden grid-cols-[56px_minmax(0,1.6fr)_1fr_.7fr_1fr_60px_90px] gap-4 border-b border-rule px-5 py-2.5 text-[11.5px] font-bold text-gray-400 md:grid">
            <span /><span>{t('seller.tab.vouchers', { defaultValue: '이용권' })}</span><span>{t('seller.vouchers.price', { defaultValue: '가격' })}</span><span>{t('seller.vouchers.sold', { defaultValue: '판매' })}</span><span>{t('seller.sales')}</span><span>{t('seller.vouchers.onSaleShort', { defaultValue: '판매' })}</span><span />
          </div>
          {rows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Ticket className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              {products.length === 0 ? (
                <>
                  <p className="font-bold text-gray-900">{t('seller.groupBuy.noVouchers')}</p>
                  <p className="mt-1 text-[13px] text-gray-500">{t('seller.groupBuy.noVouchersDesc')}</p>
                  <div className="mt-4 flex justify-center">{registerBtn('ur-btn ur-btn-md ur-btn-primary')}</div>
                </>
              ) : (
                <p className="text-[13px] text-gray-500">{t('seller.vouchers.segEmpty', { defaultValue: '이 상태의 이용권이 없어요' })}</p>
              )}
            </div>
          ) : rows.map((v) => (
            <VoucherRow key={v.id} v={v} stat={statsByIdQ.data?.[v.id]} commissionRate={commissionRate} onChanged={() => { vouchersQ.refetch(); statsByIdQ.refetch() }} />
          ))}
        </div>

        {/* 📱 폰: 하단 탭 바로 위에 고정 등록 버튼 — 스크롤 어디서든 한 번에. spacer 가 마지막 행을 가리지 않게 한다. */}
        <div className="md:hidden" aria-hidden style={{ height: 64 }} />
        <div className="fixed inset-x-0 z-[40] px-4 pb-3 pt-2 md:hidden" style={{ bottom: `calc(${SELLER_TABBAR_H}px + env(safe-area-inset-bottom))`, background: 'linear-gradient(180deg, rgba(248,247,252,0), #F8F7FC 40%)' }}>
          {registerBtn('ur-btn ur-btn-lg ur-btn-primary w-full')}
        </div>
      </div>
    </SellerLayout>
  )
}
