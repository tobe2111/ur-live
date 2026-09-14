/**
 * 🎟️ 이용권 한 줄 — M4 시안 (2026-09-14). [사진 · 이름/가격 · N건·매출 · 판매 스위치 · 펼침].
 *   폰은 행, PC(md+)는 같은 부품이 표의 한 줄로 늘어난다(열: 이용권 · 가격 · 판매 · 매출 · 판매중 · 편집).
 *   편집은 행에 하나(조건 없음). 펼치면 나머지 일이 나온다 — 재발행 · 삭제 · 사장님 링크 복사 · 알림톡 · 바우처 사용 현황.
 *   스위치는 `PUT /api/seller/products/:id { is_active, status }` — 상품 관리 화면과 같은 계약
 *   (서버 허용 status 는 ACTIVE/HIDDEN — 'PAUSED' 는 400, 2026-07-02 실측).
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ChevronDown, Copy, Pencil, RefreshCw, Send, Trash2 } from 'lucide-react'
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

  // ✏️ 수정 진입점은 **하나**이고 조건이 없다. 종전(#1430 이전)엔 '연락처 미등록' 배너 안에만 있어
  //   연락처가 등록된 매장은 수정 화면에 닿을 방법이 없었다(라이브의 유일한 실제 매장이 그 경우였다).
  const goEdit = () => navigate(`/seller/products/${v.id}/edit`)

  // 🗑️ 2026-09-14 (#1430 대표 "이용권 관리 맡아서 해줘" — M4 행으로 이식): 삭제. 서버는 2026-05-15 부터
  //   준비돼 있었는데 버튼이 없어 셀러가 자기 이용권을 내릴 방법이 화면에 없었다. 서버가 소유권(`AND seller_id = ?`)과
  //   진행 중 공구(참여자 1명 이상이면 409)를 막으므로 여기서는 확인만 받는다. soft delete 라 발급된 이용권은 살아 있다.
  async function deleteVoucher() {
    if (!(await confirmDialog(t('seller.vouchers.deleteConfirm', { defaultValue: "'{{name}}' 이용권을 삭제할까요?\n이미 발급된 이용권은 그대로 사용할 수 있고, 새 판매만 중단됩니다.", name: v.name })))) return
    try {
      const res = await api.delete(`/api/seller/products/${v.id}`, { headers })
      if (res.data?.success) {
        toast.success(t('seller.groupBuy.deleted', { defaultValue: '이용권이 삭제되었습니다' }))
        onChanged()
      } else {
        toast.error(res.data?.error || t('seller.vouchers.deleteFailed', { defaultValue: '삭제 실패' }))
      }
    } catch (err: unknown) {
      // 409(진행 중 공구)는 서버가 쓴 이유를 그대로 보여준다 — "삭제 실패" 만으로는 할 수 있는 게 없다.
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || t('seller.vouchers.deleteFailed', { defaultValue: '삭제 실패' }))
    }
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
        {/* 편집은 행에 하나 — 폰은 아이콘만, PC 는 라벨까지. 펼침 안에 또 두지 않는다(진입점이 둘이면 한쪽이 조용히 죽는다). */}
        <button type="button" onClick={goEdit} aria-label={t('seller.vouchers.edit', { defaultValue: '편집' })} className={`${GHOST} px-2 md:px-3`}>
          <Pencil size={13} /> <span className="hidden md:inline">{t('seller.vouchers.edit', { defaultValue: '편집' })}</span>
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
            {/* 🧭 2026-06-10 (재방문 루프 갭): 1탭 복사 재발행 */}
            <button type="button" onClick={() => navigate(`/seller/meal-voucher/new?copyFrom=${v.id}`)} className={GHOST}><RefreshCw size={13} /> {t('seller.groupBuy.reissue', { defaultValue: '같은 내용으로 재발행' })}</button>
            <button type="button" onClick={() => deleteVoucher()} className={`${GHOST} text-tone-bad`}><Trash2 size={13} /> {t('common.delete', { defaultValue: '삭제' })}</button>
            <button type="button" onClick={copyStoreLink} className={GHOST}><Copy size={13} /> {t('seller.vouchers.copyStoreLink', { defaultValue: '사장님 링크 복사' })}</button>
            {v.restaurant_phone ? (
              <>
                <button type="button" onClick={() => resendStoreLink(false)} className={GHOST}><Send size={13} /> {t('seller.vouchers.sendAlimtalk', { defaultValue: '사장님께 알림톡' })}</button>
                <button type="button" title={t('seller.vouchers.rotateLink', { defaultValue: '새 링크 발급 (이전 링크 무효화)' })} onClick={async () => { if (await confirmDialog(t('seller.vouchers.rotateConfirm', { defaultValue: '이전 링크가 만료되고 새 링크가 발송됩니다. 진행하시겠습니까?' }))) resendStoreLink(true) }} className={GHOST}><RefreshCw size={13} /></button>
              </>
            ) : (
              <button type="button" onClick={goEdit} className={`${GHOST} text-tone-warn`}>
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
