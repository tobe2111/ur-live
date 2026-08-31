/**
 * 🎟️ 2026-08-31 (대표 지시 — "교환권을 사면 이용권 페이지에서 확인되는데, 교환권 페이지에서 볼 수 있게"):
 *   내 교환권(기프티콘) 보관함. `/vouchers`(교환권 카탈로그)에서 산 것이 여기로 쌓인다.
 *
 * 왜 페이지를 나눴나: 산 곳과 보관되는 곳이 어긋나 있었다 — 교환권은 `/vouchers` 에서 사는데
 *   확인은 '이용권' 탭 안의 세그먼트에서 해야 했다. 이제 축마다 자기 보관함을 갖는다
 *   (이용권 = `/my-vouchers`, 교환권 = 여기). 판정은 `shared/voucher-wallet` SSOT 한 곳.
 *
 * 이용권 지갑과 다른 점(그래서 별도 페이지가 맞다):
 *   - 만료일·매장 좌표가 없다 → D-N 배지도, 지도 뷰도, QR 모달도 없다.
 *   - 결제가 딜이라 금액 단위가 '딜'이고, 사용은 문자로 온 쿠폰(또는 인앱 바코드)으로 한다.
 *   - '발송 중' 이라는 중간 상태가 있다(결제 직후) — 이용권엔 없는 상태라 별도 섹션으로 보여준다.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { useMyVouchers } from '@/hooks/queries'
import { WalletPageWrapper } from '@/components/wallet/WalletAtoms'
import BrandLoader from '@/components/brand/BrandLoader'
import WalletHeader from './my-vouchers/WalletHeader'
import WalletArchive from './my-vouchers/WalletArchive'
import VoucherTicket from './my-vouchers/VoucherTicket'
import { EmptyVouchers } from './my-vouchers/WalletEmpty'
import { isGifticonVoucher } from '@/shared/voucher-wallet'
import type { Voucher } from './my-vouchers/types'

export default function MyGifticonsPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  // 이용권 지갑과 **같은 React Query 캐시**(queryKeys.myVouchers)를 읽는다 — 두 페이지를 오가도 재요청 0.
  const { data: raw, isLoading: loading, isError, refetch } = useMyVouchers()
  const [showAllSending, setShowAllSending] = useState(false)

  const items = useMemo(() => ((raw ?? []) as unknown as Voucher[]).filter(isGifticonVoucher), [raw])
  const locale = i18n.language?.startsWith('ko') ? 'ko-KR' : i18n.language || 'en-US'

  const usable = items.filter(v => v.status === 'unused')
  const sending = items.filter(v => v.status === 'processing')
  const used = items.filter(v => v.status === 'used')
  const archived = items.filter(v => v.status === 'expired' || v.status === 'refunded')

  // 교환권은 딜로만 결제 → 단위 '딜' (utils/format.ts formatProductPrice 의 deal_only 규칙과 동일).
  const heroTotal = usable.reduce((s, v) => s + (v.applied_price ?? v.product_price ?? 0), 0)

  // 🛡️ 2026-04-30 CLAUDE.md 테마 룰: 지갑 계열은 화이트 테마(다크 토글 지원).
  const theme = 'light' as const
  const sendingShown = showAllSending ? sending : sending.slice(0, 3)

  return (
    <WalletPageWrapper theme={theme}>
      <SEO
        title={t('voucher.gifticonSeoTitle', { defaultValue: '내 교환권 - 유어딜' })}
        description={t('voucher.gifticonSeoDescription', { defaultValue: '구매한 교환권(기프티콘)을 확인하고 매장에서 사용하세요' })}
        url="/my-gifticons"
        noindex
      />

      <WalletHeader
        title={t('voucher.myGifticons', { defaultValue: '내 교환권' })}
        amount={items.length > 0 ? heroTotal : null}
        unit={t('voucher.deal', { defaultValue: '딜' })}
        /* 교환권은 만료일·할인율을 안 갖고 온다 → 지표는 '사용 가능' 하나뿐이고, 없으면 줄 자체를 안 그린다. */
        stats={items.length > 0 ? [
          { label: t('voucher.heroUsable', { defaultValue: '사용 가능' }), value: `${usable.length}${t('voucher.heroCountUnit', { defaultValue: '장' })}` },
          { label: t('voucher.totalCountLabel', { defaultValue: '전체' }), value: `${items.length}${t('voucher.heroCountUnit', { defaultValue: '장' })}` },
        ] : []}
        onBack={() => navigate('/vouchers')}
        backLabel={t('common.back', { defaultValue: '뒤로가기' })}
      />

      <div className="ur-content-narrow px-4 lg:px-8 pb-2">
        {loading ? (
          <BrandLoader />
        ) : isError ? (
          /* 🛡️ 네트워크 실패를 "빈 보관함"으로 위장하지 않음 — 에러 + 재시도(이용권 지갑과 동일 규약). */
          <div className="text-center py-16">
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">{t('voucher.loadFailedGift', { defaultValue: '교환권을 불러오지 못했어요' })}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t('common.checkNetworkRetry', { defaultValue: '네트워크 상태를 확인한 뒤 다시 시도해주세요' })}</p>
            <button
              onClick={() => refetch()}
              className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-sm font-bold"
            >
              {t('common.retry', { defaultValue: '다시 시도' })}
            </button>
          </div>
        ) : items.length === 0 ? (
          <EmptyVouchers mode="gift" onExplore={() => navigate('/vouchers')} t={t} />
        ) : (
          <>
            {/* 발송 중 — 결제 직후 문자가 도착하기 전 구간. 여기 없으면 "결제했는데 아무것도 없다"가 된다. */}
            {sending.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-semibold text-gray-500 dark:text-gray-400">
                    {t('voucher.status.processing', { defaultValue: '발송 중' })} <span className="text-gray-400 dark:text-gray-500">{sending.length}</span>
                  </span>
                  {sending.length > sendingShown.length && (
                    <button type="button" onClick={() => setShowAllSending(true)}
                      className="text-[13px] font-semibold text-gray-900 dark:text-white active:opacity-60">
                      {t('common.seeAll', { defaultValue: '전체 보기' })}
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {sendingShown.map(v => <VoucherTicket key={v.id} v={v} muted locale={locale} t={t} onShowQr={() => {}} />)}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-semibold text-gray-500 dark:text-gray-400">
                {t('voucher.groupUnused', { defaultValue: '사용 가능' })} <span className="text-gray-400 dark:text-gray-500">{usable.length}</span>
              </span>
            </div>

            {usable.length > 0 ? (
              <div className="space-y-3">
                {usable.map(v => <VoucherTicket key={v.id} v={v} muted={false} locale={locale} t={t} onShowQr={() => {}} />)}
              </div>
            ) : (
              <p className="py-8 text-center text-[13px] text-gray-400 dark:text-gray-500">{t('voucher.noUnusedGift', { defaultValue: '사용 가능한 교환권이 없어요' })}</p>
            )}

            <WalletArchive used={used} archived={archived} locale={locale} t={t} />
          </>
        )}
      </div>
    </WalletPageWrapper>
  )
}
