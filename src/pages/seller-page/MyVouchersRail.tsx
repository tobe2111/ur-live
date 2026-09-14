/**
 * 🎟️ 내 이용권 — 홈 셋째 블록 (M2 시안 · 2026-09-14).
 *   폰: 가로 스크롤 카드(사진 · 이름 · N건 · 매출) 끝에 `＋ 등록` 카드. PC: 4열 격자(P-홈).
 *   누르면 이용권 탭(M4)으로 — 홈은 "있다"까지만 말하고 관리는 그 탭이 한다. 0개면 등록 카드 하나만 남는다.
 *   사진은 `cfImage` + `cfImageOnError`(깨진 아이콘 노출 차단 SSOT) — 실패하면 카테고리 톤 면이 남는다.
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatWon } from '@/utils/format'
import type { HomeVoucher } from './useSellerHome'

const CARD = 'w-[150px] shrink-0 overflow-hidden rounded-2xl border border-rule bg-white lg:w-auto'

export default function MyVouchersRail({ vouchers, loaded }: { vouchers: HomeVoucher[]; loaded: boolean }) {
  const { t } = useTranslation()
  const top = vouchers.slice(0, 3)
  return (
    <section>
      <h2 className="mb-1.5 flex items-baseline justify-between px-1 text-[13px] font-extrabold text-gray-900">
        {t('seller.home.myVouchers', { defaultValue: '내 이용권' })}
        <Link to="/seller/group-buy" className="text-[12px] font-bold text-brand-text">
          {vouchers.length > 0 ? t('seller.home.manageAll', { defaultValue: '전체 관리', count: vouchers.length }) : t('seller.nav.voucherManage', { defaultValue: '이용권 관리' })}
        </Link>
      </h2>
      <div className="-mx-3 flex gap-2.5 overflow-x-auto px-3 pb-1 scrollbar-hide sm:-mx-5 sm:px-5 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
        {top.map((v) => (
          <Link key={v.id} to="/seller/group-buy" className={CARD}>
            <div className="h-[92px] bg-brand-tint">
              {v.image_url && (
                <img
                  src={cfImage(v.image_url, { width: 300 })}
                  alt=""
                  loading="lazy"
                  className={`h-full w-full object-cover ${v.is_active ? '' : 'opacity-50'}`}
                  onError={(e) => cfImageOnError(e.currentTarget, v.image_url)}
                />
              )}
            </div>
            <div className="px-3 py-2.5">
              <p className="truncate text-[13px] font-bold leading-snug text-gray-900">{v.name}</p>
              <p className="mt-1 truncate text-[12px] text-gray-400">
                {v.is_active
                  ? <>{t('seller.home.soldCount', { defaultValue: '{{count}}건', count: v.sold })} · <em className="not-italic font-extrabold text-brand-text">{formatWon(v.price * v.sold)}</em></>
                  : t('seller.vouchers.paused', { defaultValue: '판매 중지' })}
              </p>
            </div>
          </Link>
        ))}
        <Link
          to="/seller/meal-voucher/new"
          className={`${CARD} flex min-h-[150px] items-center justify-center gap-1 !border-brand-tint bg-brand-tint text-[14px] font-extrabold text-brand-text`}
        >
          <Plus size={16} strokeWidth={2.6} />
          {t('seller.home.register', { defaultValue: '등록' })}
        </Link>
        {loaded && vouchers.length === 0 && (
          <p className="self-center pl-1 text-[12.5px] leading-snug text-gray-400 lg:col-span-3">
            {t('seller.home.noVouchers', { defaultValue: '아직 등록한 이용권이 없어요. 첫 이용권을 만들면 여기에 보여요.' })}
          </p>
        )}
      </div>
      {vouchers.length > 3 && (
        <p className="mt-1 px-1 text-[11.5px] text-gray-400">{t('seller.home.moreVouchers', { defaultValue: '외 {{count}}개', count: vouchers.length - 3 })}</p>
      )}
    </section>
  )
}
