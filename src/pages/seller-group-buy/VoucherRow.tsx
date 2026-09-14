/**
 * 🎟️ 이용권 한 줄 — M4 시안 (2026-09-14). [사진 · 이름/가격 · N건·매출 · 판매 스위치 · 펼침].
 *   폰은 행, PC(md+)는 같은 부품이 표의 한 줄로 늘어난다(열: 이용권 · 가격 · 판매 · 매출 · 판매중 · 편집).
 *   펼치면 그 이용권의 나머지 일이 나온다 — 수정 · 재발행 · 사장님 링크 복사 · 알림톡 · 바우처 사용 현황.
 *   스위치는 `PUT /api/seller/products/:id { is_active, status }` — 상품 관리 화면과 같은 계약
 *   (서버 허용 status 는 ACTIVE/HIDDEN — 'PAUSED' 는 400, 2026-07-02 실측).
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ChevronDown, Copy, Pencil, RefreshCw, Send } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber, formatWon, safeNum } from '@/utils/format'
import { GB_ENGINE_ENABLED } from '@/shared/feature-flags'
import type { HomeVoucher } from '../seller-page/useSellerHome'
import GroupBuyOpenPanel from './GroupBuyOpenPanel'

export interface VoucherStat { product_id: number; total: number; used: number; unused: number; expired: number }

interface Props {
  v: HomeVoucher
  stat?: VoucherStat
  commissionRate: number
  onChanged: () => void
}

const GHOST = 'inline-flex items-center gap-1 rounded-lg border border-rule bg-white px-3 py-2 text-[12px] font-bold text-gray-700 hover:bg-gray-50'

export default function VoucherRow({ v, stat, commissionRate, onChanged }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const headers = { Authorization: `Bearer ${localStorage.getItem('seller_token')}` }

  const gross = safeNum(v.price) * safeNum(v.sold)
  const net = gross - Math.round(gross * safeNum(commissionRate))
  const discounted = v.original_price != null && v.original_price > v.price

  async function toggleActive(next: boolean) {
    if (busy) return
    setBusy(true)
    try {
      const r = await api.put(`/api/seller/products/${v.id}`, { is_active: next, status: next ? 'ACTIVE' : 'HIDDEN' }, { headers })
      if (r.data?.success) { toast.success(t('seller.productStatusChanged')); onChanged() }
      else toast.error(r.data?.error || t('seller.productStatusChangeFailed'))
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || t('seller.productStatusChangeFailed'))
    } finally { setBusy(false) }
  }

  // 🛡️ 2026-04-27: 사장님께 알림톡 재발송 (Magic Link)
  async function resendStoreLink(rotate: boolean) {
    try {
      const res = await api.post(`/api/seller/products/${v.id}/resend-store-link`, { rotate }, { headers })
      if (res.data.success) {
        toast.success(rotate ? t('seller.groupBuy.linkRotated', { defaultValue: '새 링크로 재발송되었습니다 (이전 링크 만료)' }) : t('seller.groupBuy.alimtalkSent', { defaultValue: '사장님께 알림톡이 발송되었습니다' }))
        onChanged()
      } else toast.error(res.data.error || '발송 실패')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '발송 실패')
    }
  }
  function copyStoreLink() {
    const url = v.store_owner_token
      ? `${window.location.origin}/store/stats/${v.id}?t=${v.store_owner_token}`
      : `${window.location.origin}/store/stats/${v.id}`
    navigator.clipboard.writeText(url)
    toast.success(t('seller.groupBuy.linkCopied'))
  }

  return (
    <div className="border-b border-rule last:border-b-0">
      <div className={`flex items-center gap-3 px-3 py-3 md:grid md:grid-cols-[56px_minmax(0,1.6fr)_1fr_.7fr_1fr_60px_90px] md:gap-4 md:px-5 ${v.is_active ? '' : 'opacity-70'}`}>
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-brand-tint">
          {v.image_url && (
            <img src={cfImage(v.image_url, { width: 160 })} alt="" loading="lazy" className="h-full w-full object-cover"
              onError={(e) => cfImageOnError(e.currentTarget, v.image_url)} />
          )}
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
          <p className="truncate text-[15px] font-extrabold text-gray-900">{v.name}</p>
          <p className="mt-0.5 truncate text-[12.5px] text-gray-500 md:hidden">
            {discounted && <s className="mr-1 text-gray-400">{formatWon(v.original_price)}</s>}{formatWon(v.price)}
          </p>
          <p className="mt-0.5 text-[13px] text-gray-700 md:hidden">
            {t('seller.home.soldCount', { defaultValue: '{{count}}건', count: v.sold })} · <em className="not-italic font-extrabold text-brand-text">{formatWon(gross)}</em>
          </p>
          {v.restaurant_name && <p className="hidden truncate text-[12px] text-gray-400 md:block">{v.restaurant_name}</p>}
        </button>
        <p className="hidden text-[13px] text-gray-500 md:block">
          {discounted && <s className="mr-1 text-gray-400">{formatWon(v.original_price)}</s>}{formatWon(v.price)}
        </p>
        <p className="hidden text-[13px] font-semibold text-gray-900 md:block">{formatNumber(v.sold)}</p>
        <p className="hidden text-[13px] font-extrabold text-brand-text md:block">{formatWon(gross)}</p>
        {/* 판매 스위치 — 켜짐 = 브랜드 면, 꺼짐 = 회색. 이 줄에서 색이 있는 자리는 여기와 매출 숫자뿐이다. */}
        <button
          type="button" role="switch" aria-checked={v.is_active} disabled={busy}
          aria-label={v.is_active ? t('seller.vouchers.onSale', { defaultValue: '판매 중' }) : t('seller.vouchers.paused', { defaultValue: '판매 중지' })}
          onClick={() => toggleActive(!v.is_active)}
          className={`relative h-[26px] w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${v.is_active ? 'bg-brand' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all ${v.is_active ? 'left-[21px]' : 'left-[3px]'}`} />
        </button>
        <button type="button" onClick={() => navigate(`/seller/products/${v.id}/edit`)} className={`hidden md:inline-flex ${GHOST}`}>
          <Pencil size={13} /> {t('seller.vouchers.edit', { defaultValue: '편집' })}
        </button>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t('seller.vouchers.more', { defaultValue: '더 보기' })} className="shrink-0 p-1 text-gray-400 md:hidden">
          <ChevronDown size={18} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="space-y-3 bg-gray-50 px-4 py-3 md:px-5">
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div>
              <p className="text-gray-500">{t('seller.vouchers.expectedNet', { defaultValue: '예상 정산액' })}</p>
              <p className="mt-0.5 text-[14px] font-extrabold text-gray-900">{formatWon(net)}</p>
              <p className="text-[11px] text-gray-400">{t('seller.vouchers.feeNote', { defaultValue: '수수료 {{pct}}% 차감', pct: (safeNum(commissionRate) * 100).toFixed(1) })}</p>
            </div>
            <div>
              <p className="text-gray-500">{t('seller.vouchers.usage', { defaultValue: '바우처 사용' })}</p>
              <p className="mt-0.5 text-[14px] font-extrabold text-gray-900">{stat ? `${formatNumber(stat.used)} / ${formatNumber(stat.total)}` : '0 / 0'}</p>
              {stat && stat.expired > 0 && <p className="text-[11px] text-tone-warn">{t('seller.vouchers.expired', { defaultValue: '만료 {{count}}', count: stat.expired })}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate(`/seller/products/${v.id}/edit`)} className={`md:hidden ${GHOST}`}><Pencil size={13} /> {t('seller.vouchers.edit', { defaultValue: '편집' })}</button>
            {/* 🧭 2026-06-10 (재방문 루프 갭): 1탭 복사 재발행 */}
            <button type="button" onClick={() => navigate(`/seller/meal-voucher/new?copyFrom=${v.id}`)} className={GHOST}><RefreshCw size={13} /> {t('seller.groupBuy.reissue', { defaultValue: '같은 내용으로 재발행' })}</button>
            <button type="button" onClick={copyStoreLink} className={GHOST}><Copy size={13} /> {t('seller.vouchers.copyStoreLink', { defaultValue: '사장님 링크 복사' })}</button>
            {v.restaurant_phone ? (
              <>
                <button type="button" onClick={() => resendStoreLink(false)} className={GHOST}><Send size={13} /> {t('seller.vouchers.sendAlimtalk', { defaultValue: '사장님께 알림톡' })}</button>
                <button type="button" title={t('seller.vouchers.rotateLink', { defaultValue: '새 링크 발급 (이전 링크 무효화)' })} onClick={async () => { if (await confirmDialog(t('seller.vouchers.rotateConfirm', { defaultValue: '이전 링크가 만료되고 새 링크가 발송됩니다. 진행하시겠습니까?' }))) resendStoreLink(true) }} className={GHOST}><RefreshCw size={13} /></button>
              </>
            ) : (
              <button type="button" onClick={() => navigate(`/seller/products/${v.id}/edit`)} className={`${GHOST} text-tone-warn`}>
                <AlertCircle size={13} /> {t('seller.vouchers.noContact', { defaultValue: '식당 연락처 미등록 — 등록하기' })}
              </button>
            )}
          </div>
          {/* 🎟️ 2026-07-06 (§2-A 방향 A): 매장이 공구 열기 — GB_ENGINE_ENABLED 게이트(기본 OFF). 숨기는 것과 없애는 것은 다르다. */}
          {GB_ENGINE_ENABLED && (
            <GroupBuyOpenPanel productId={v.id} listPrice={safeNum(v.price)} category={v.category || 'meal_voucher'} headers={headers} />
          )}
        </div>
      )}
    </div>
  )
}
