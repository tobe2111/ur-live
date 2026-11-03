import { lazy, Suspense, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import Sheet from '../seller-section/Sheet'
import SegmentedTabs from '@/components/ui/segmented-tabs'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber, formatWon, safeNum } from '@/utils/format'
import { isAgencySeatToken } from '@/shared/agency-seat-token'
import { useSellerStats, useSellerVouchers, useSellerDeletedVouchers, useSellerWithdrawable, monthRevenue, type HomeVoucher } from '@/pages/seller-page/useSellerHome'
import { BigNumberCard, Card, PlateLoading, PlateRow, SaleSwitch } from './ui'
import { copyStoreLink, deleteVoucher, resendStoreLink, setVoucherSale } from './voucher-actions'

const BranchCopySheet = lazy(() => import('@/pages/seller-group-buy/BranchCopySheet'))

/**
 * 🎟️ 마이 — **이용권 관리** (시안 M1) + **한 줄 눌렀을 때** (M2). 2026-11-03 대표 확정 *"좋다 다 해줘"*.
 *
 * 종전엔 PC 셀러 대시보드 화면(`SellerGroupBuyPage`)을 시트 안에 그대로 띄웠다(`ToolPageSheet`) —
 *   대표 *"이런 페이지들 너무 붕 떠보이잖아"*: 머리(테마)와 몸통(라이트 고정)이 두 조각 · 흰 바탕 위 테두리 카드 · PC 비율의 빈 아래.
 * 데이터·서버 호출은 그 화면과 **같은 훅·같은 경로**다(`useSellerHome` · `voucher-actions`). 화면만 마이용이다.
 * 고치기(가격·수량·기간·사진)·재발행은 폼이 크고 이미 있으므로 **그 화면을 시트로** 연다(`onOpenPage`) — 폼을 두 벌 만들지 않는다.
 * 🤝 에이전시 좌석은 매장 전체 숫자를 못 본다(서버가 막는다) — 막힌 값을 0 으로 그리지 않고 판매 건수만 말한다.
 */
type Seg = 'on' | 'off' | 'ended' | 'deleted'
interface VoucherStat { product_id: number; total: number; used: number; unused: number; expired: number }

export default function MyVouchersSheet({ onClose, onOpenPage, onNew }: {
  onClose: () => void
  /** 셀러 화면을 시트로 연다(고치기·재발행). 닫으면 이 시트로 돌아온다 — 호출부가 정한다. */
  onOpenPage: (path: string, title: string) => void
  onNew: () => void
}) {
  const agencySeat = isAgencySeatToken(localStorage.getItem('seller_token'))
  const vouchersQ = useSellerVouchers()
  const deletedQ = useSellerDeletedVouchers()
  const statsQ = useSellerStats()
  const balanceQ = useSellerWithdrawable()
  const products = vouchersQ.data ?? []
  const ids = products.map((p) => p.id).join(',')
  const statQ = useApiQuery<Record<number, VoucherStat>>(['seller', 'gb-voucher-stats', ids], '/api/group-buy/seller-voucher-stats', {
    params: { product_ids: ids }, headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` }, enabled: products.length > 0 && !agencySeat,
    select: (r: unknown) => { const m: Record<number, VoucherStat> = {}; const d = r as { success?: boolean; data?: VoucherStat[] }; if (d?.success) for (const s of d.data ?? []) m[s.product_id] = s; return m },
  })
  const [seg, setSeg] = useState<Seg>('on')
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [copying, setCopying] = useState<HomeVoucher | null>(null)

  const deleted = deletedQ.data ?? []
  const buckets = useMemo(() => {
    const ended = products.filter((p) => p.group_buy_status === 'closed' || p.group_buy_status === 'achieved')
    const endedIds = new Set(ended.map((p) => p.id))
    return {
      on: products.filter((p) => p.is_active && !endedIds.has(p.id)),
      off: products.filter((p) => !p.is_active && !endedIds.has(p.id)),
      ended, deleted,
    }
  }, [products, deleted])
  const refresh = () => { void vouchersQ.refetch(); void deletedQ.refetch(); void statQ.refetch() }
  const picked = pickedId == null ? null : [...products, ...deleted].find((p) => p.id === pickedId) ?? null

  const totalSold = products.reduce((s, p) => s + safeNum(p.sold), 0)
  const unused = statQ.data ? Object.values(statQ.data).reduce((s, x) => s + safeNum(x.unused), 0) : null
  const month = statsQ.data ? monthRevenue(statsQ.data.daily ?? []) : null

  async function sale(v: HomeVoucher, next: boolean, msg: string) {
    if (busy) return
    setBusy(true)
    if (await setVoucherSale(v, next, msg)) refresh()
    setBusy(false)
  }

  const footer = !picked && products.length > 0 ? (
    <button type="button" onClick={onNew} className="ur-btn ur-btn-lg ur-btn-primary w-full" data-testid="my-vouchers-new">
      <Plus className="h-4 w-4" aria-hidden="true" /> 이용권 등록
    </button>
  ) : undefined

  return (
    <Sheet title={picked ? '이용권' : '이용권'} onClose={onClose} onBack={picked ? () => setPickedId(null) : undefined} tall footer={footer}>
      <div className="pb-8" data-testid="my-vouchers-sheet">
        {picked ? (
          <VoucherDetail
            v={picked} stat={statQ.data?.[picked.id]} busy={busy}
            onSale={(next) => sale(picked, next, next ? '판매를 다시 시작했어요' : '판매를 멈췄어요')}
            onRestore={() => sale(picked, true, '이용권을 다시 판매합니다')}
            onEdit={() => onOpenPage(`/seller/products/${picked.id}/edit`, '이용권 고치기')}
            onReissue={() => onOpenPage(`/seller/meal-voucher/new?copyFrom=${picked.id}`, '같은 내용으로 재발행')}
            onCopyBranches={() => setCopying(picked)}
            onDelete={async () => { if (await deleteVoucher(picked)) { setPickedId(null); refresh() } }}
          />
        ) : (
          <>
            {agencySeat ? (
              <BigNumberCard caption="우리가 맡은 이용권" value={`판매 ${formatNumber(totalSold)}건`} testId="my-vouchers-summary" />
            ) : (
              <BigNumberCard
                caption="이번 달 판매" testId="my-vouchers-summary"
                value={month == null ? '—' : formatWon(month)}
                cells={[
                  { label: '판매', value: `${formatNumber(totalSold)}건` },
                  { label: '사용 대기', value: unused == null ? '—' : `${formatNumber(unused)}건`, hot: (unused ?? 0) > 0 },
                  { label: '정산 예정', value: balanceQ.data == null ? '—' : formatWon(balanceQ.data) },
                ]}
              />
            )}
            <div className="mx-3 mt-3">
              <SegmentedTabs<Seg>
                value={seg} onChange={setSeg}
                items={[
                  { id: 'on', label: '판매 중', count: buckets.on.length },
                  { id: 'off', label: '중지', count: buckets.off.length },
                  { id: 'ended', label: '종료', count: buckets.ended.length },
                  ...(buckets.deleted.length > 0 ? [{ id: 'deleted' as Seg, label: '삭제', count: buckets.deleted.length }] : []),
                ]}
              />
            </div>
            {vouchersQ.isLoading ? <PlateLoading /> : products.length === 0 ? (
              <Card className="px-5 py-8 text-center">
                <p className="text-[16px] font-semibold text-gray-900 dark:text-white">아직 이용권이 없어요</p>
                <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">첫 이용권을 올리면 여기서 판매를 관리해요</p>
                <button type="button" onClick={onNew} className="mt-4 ur-btn ur-btn-md ur-btn-primary">이용권 등록하기</button>
              </Card>
            ) : buckets[seg].length === 0 ? (
              <Card className="px-5 py-8 text-center"><p className="text-[13px] text-gray-500 dark:text-gray-400">이 상태의 이용권이 없어요</p></Card>
            ) : (
              <Card className="px-5 py-1" testId="my-vouchers-list">
                {buckets[seg].map((v) => (
                  <div key={v.id} className="flex items-center gap-3 py-3 border-b border-rule last:border-b-0">
                    <button type="button" onClick={() => setPickedId(v.id)} className="flex-1 min-w-0 flex items-center gap-3 text-left active:opacity-70">
                      <Thumb v={v} />
                      <span className="flex-1 min-w-0">
                        <span className={`block truncate text-[16px] font-semibold ${v.status === 'DELETED' ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{v.name}</span>
                        <span className="mt-1 block truncate text-[13px] text-gray-500 dark:text-gray-400 tabular-nums">
                          <PriceLine v={v} /> · {formatNumber(v.sold)}건 판매
                        </span>
                      </span>
                    </button>
                    {v.status !== 'DELETED' && (
                      <SaleSwitch on={!!v.is_active} busy={busy} label={v.is_active ? '판매 중' : '판매 중지'}
                        onChange={(next) => sale(v, next, next ? '판매를 다시 시작했어요' : '판매를 멈췄어요')} />
                    )}
                  </div>
                ))}
              </Card>
            )}
            {buckets[seg].length > 0 && <p className="px-5 pt-4 text-[13px] text-gray-500 dark:text-gray-400">이용권을 누르면 가격·수량·기간을 고칠 수 있어요</p>}
          </>
        )}
      </div>
      {copying && (
        <Suspense fallback={null}>
          <BranchCopySheet productId={copying.id} productName={copying.name} onClose={() => setCopying(null)} />
        </Suspense>
      )}
    </Sheet>
  )
}

function Thumb({ v, size = 56 }: { v: HomeVoucher; size?: number }) {
  return (
    <span className="shrink-0 overflow-hidden rounded-xl bg-wash" style={{ width: size, height: size }}>
      {v.image_url && (
        <img src={cfImage(v.image_url, { width: 160 })} alt="" loading="lazy" width={size} height={size}
          className="h-full w-full object-cover" style={{ filter: v.is_active ? undefined : 'grayscale(1)' }}
          onError={(e) => cfImageOnError(e.currentTarget, v.image_url)} />
      )}
    </span>
  )
}

function PriceLine({ v }: { v: HomeVoucher }) {
  const orig = safeNum(v.original_price), price = safeNum(v.price)
  const pct = orig > price && orig > 0 ? Math.round((1 - price / orig) * 100) : 0
  return <>{pct > 0 && <b className="font-bold text-sale">{pct}% </b>}<b className="font-semibold text-gray-900 dark:text-white">{formatWon(price)}</b></>
}

/** M2 — 한 줄 눌렀을 때. 고칠 것은 한 판에, 위험한 것(삭제)은 아래 판에. */
function VoucherDetail({ v, stat, busy, onSale, onRestore, onEdit, onReissue, onCopyBranches, onDelete }: {
  v: HomeVoucher; stat?: VoucherStat; busy: boolean
  onSale: (next: boolean) => void; onRestore: () => void; onEdit: () => void; onReissue: () => void; onCopyBranches: () => void; onDelete: () => void
}) {
  const isDeleted = v.status === 'DELETED'
  const orig = safeNum(v.original_price)
  return (
    <div data-testid="my-voucher-detail">
      <Card className="px-5 py-4 flex items-center gap-3">
        <Thumb v={v} size={64} />
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-semibold text-gray-900 dark:text-white line-clamp-2">{v.name}</p>
          <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400 tabular-nums">
            {isDeleted ? '삭제됨 · 새 판매만 멈췄어요' : `${v.is_active ? '판매 중' : '판매 중지'} · ${formatNumber(v.sold)}건 판매`}
          </p>
        </div>
      </Card>
      {isDeleted ? (
        <Card className="px-5 py-1"><PlateRow label="다시 판매하기(복구)" onClick={onRestore} /></Card>
      ) : (
        <>
          <Card className="px-5 py-1">
            <PlateRow label="판매" right={<SaleSwitch on={!!v.is_active} busy={busy} label={v.is_active ? '판매 중' : '판매 중지'} onChange={onSale} />} />
            <PlateRow label="가격" value={orig > safeNum(v.price) ? `${formatWon(orig)} → ${formatWon(v.price)}` : formatWon(v.price)} onClick={onEdit} />
            <PlateRow label="수량 · 사용 기간 · 사진 · 설명" onClick={onEdit} />
            {stat && <PlateRow label="사용" value={`${formatNumber(stat.used)} / ${formatNumber(stat.total)}장${stat.expired > 0 ? ` · 만료 ${formatNumber(stat.expired)}` : ''}`} />}
          </Card>
          <Card className="px-5 py-1">
            <PlateRow label="같은 내용으로 재발행" onClick={onReissue} />
            <PlateRow label="다른 지점에 복사" onClick={onCopyBranches} />
            <PlateRow label="사장님 링크 복사" onClick={() => copyStoreLink(v)} />
            {v.restaurant_phone && <PlateRow label="사장님께 알림톡" onClick={() => { void resendStoreLink(v) }} />}
          </Card>
          <Card className="px-5 py-1"><PlateRow label="이용권 삭제" danger onClick={onDelete} /></Card>
        </>
      )}
    </div>
  )
}
