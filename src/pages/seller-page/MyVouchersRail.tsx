/**
 * 🧮 내 이용권 — 홈 셋째 블록, D3 표 (2026-09-15 대표 확정). 종전 가로 카드 레일 → 행 표(이용권·판매·매출, PC 는 정가·판매가·상태까지).
 *   이름(파일)은 유지 — 홈·가드·라우트 참조가 이 이름을 본다. 사진은 28px 썸네일 한 칸(인식용).
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber, formatWon } from '@/utils/format'
import type { HomeVoucher } from './useSellerHome'

const TH = 'border-b border-rule px-3 py-2 text-[11px] font-semibold text-gray-500'
const TD = 'px-3 py-2.5 align-middle'

export default function MyVouchersRail({ vouchers, loaded }: { vouchers: HomeVoucher[]; loaded: boolean }) {
  const { t } = useTranslation()
  const top = vouchers.slice(0, 5)
  return (
    <section>
      <h2 className="mb-1.5 flex items-baseline justify-between px-1 text-[13px] font-extrabold text-gray-900">
        {t('seller.home.myVouchers', { defaultValue: '내 이용권' })}
        <span className="flex items-center gap-3">
          {vouchers.length > 0 && (
            <Link to="/seller/group-buy" className="text-[12px] font-bold text-gray-500">{t('seller.home.manageAll', { defaultValue: '전체 관리', count: vouchers.length })}</Link>
          )}
          <Link to="/seller/meal-voucher/new" className="flex items-center gap-0.5 text-[12px] font-bold text-brand-text">
            <Plus size={13} strokeWidth={2.6} />{t('seller.home.register', { defaultValue: '등록' })}
          </Link>
        </span>
      </h2>
      <div className="overflow-hidden rounded-[var(--dash-radius,16px)] border border-rule bg-white">
        {loaded && vouchers.length === 0 ? (
          <p className="px-4 py-4 text-[12.5px] leading-relaxed text-gray-500">
            {t('seller.home.noVouchers', { defaultValue: '아직 등록한 이용권이 없어요. 첫 이용권을 만들면 여기에 보여요.' })}
          </p>
        ) : (
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className={`${TH} text-left`}>{t('seller.home.voucher', { defaultValue: '이용권' })}</th>
                <th className={`${TH} hidden text-right sm:table-cell`}>{t('seller.home.listPrice', { defaultValue: '정가 ₩' })}</th>
                <th className={`${TH} hidden text-right sm:table-cell`}>{t('seller.home.salePrice', { defaultValue: '판매가 ₩' })}</th>
                <th className={`${TH} text-right`}>{t('seller.home.soldHead', { defaultValue: '판매' })}</th>
                <th className={`${TH} text-right`}>{t('seller.home.revenueWon', { defaultValue: '매출 ₩' })}</th>
                <th className={`${TH} hidden text-right sm:table-cell`}>{t('seller.home.status', { defaultValue: '상태' })}</th>
              </tr>
            </thead>
            <tbody>
              {top.map((v) => (
                <tr key={v.id} className="[&+&>td]:border-t [&+&>td]:border-rule hover:bg-gray-50">
                  <td className={TD}>
                    <Link to="/seller/group-buy" className="flex min-w-0 items-center gap-2.5">
                      <span className="h-7 w-7 shrink-0 overflow-hidden rounded-md bg-brand-tint">
                        {v.image_url && (
                          <img src={cfImage(v.image_url, { width: 120 })} alt="" loading="lazy" className={`h-full w-full object-cover ${v.is_active ? '' : 'opacity-50'}`} onError={(e) => cfImageOnError(e.currentTarget, v.image_url)} />
                        )}
                      </span>
                      <span className="truncate font-semibold text-gray-900">{v.name}</span>
                    </Link>
                  </td>
                  <td className={`${TD} dash-num hidden text-right text-gray-400 sm:table-cell`}>{v.original_price ? formatNumber(v.original_price) : '–'}</td>
                  <td className={`${TD} dash-num hidden text-right text-gray-900 sm:table-cell`}>{formatNumber(v.price)}</td>
                  <td className={`${TD} dash-num text-right text-gray-900`}>{formatNumber(v.sold)}</td>
                  <td className={`${TD} dash-num text-right font-bold text-gray-900`}>{formatNumber(v.price * v.sold)}</td>
                  <td className={`${TD} hidden text-right sm:table-cell`}>
                    {v.is_active
                      ? <span className="text-[11.5px] font-bold text-tone-ok">{t('seller.vouchers.selling', { defaultValue: '판매 중' })}</span>
                      : <span className="text-[11.5px] font-semibold text-gray-400">{t('seller.vouchers.paused', { defaultValue: '판매 중지' })}</span>}
                  </td>
                </tr>
              ))}
              {!loaded && top.length === 0 && (
                <tr><td className={`${TD} text-gray-400`} colSpan={6}><span className="inline-block h-4 w-32 animate-pulse rounded bg-gray-100" /></td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {vouchers.length > 5 && (
        <p className="mt-1 px-1 text-[11.5px] text-gray-400">{t('seller.home.moreVouchers', { defaultValue: '외 {{count}}개', count: vouchers.length - 5 })} · <span className="sr-only">{formatWon(0)}</span></p>
      )}
    </section>
  )
}
