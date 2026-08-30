/**
 * 🪧 유어샵 빈 상태 — 주인에겐 **다음 할 일**, 손님에겐 안내 (2026-08-26 CuratorPage 에서 추출)
 *
 * 추출 이유 두 가지:
 *   ① CuratorPage 가 file-size 래칫(713줄) 천장에 닿아 더 못 자란다 — 이런 자기완결 블록부터 뗀다.
 *   ② 대표 지시("가입 시 사장님인지 선택 → 그에 맞는 UI")를 받으려면 이 화면이 **의도별로 갈려야** 한다.
 *
 * 🧭 의도(`urshop-intent`)는 **신분이 아니라 첫 화면 힌트**다. 권한을 주지 않고, 반대쪽을 해도 막지 않는다.
 *   - `seller`  → "매장 등록하고 첫 이용권 올리기"(유어샵 = 이용권 진열대)
 *   - `curator` → "마음에 든 이용권 담기"
 *   - 없음      → 종전 중립 화면(고르지 않았거나 다른 기기 — 잃어도 사고가 아니다)
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getUrShopIntent } from '@/utils/urshop-intent'

export default function EmptyUrShop({ handle, isOwner, emptyType, curatorName, curatorId }: { handle: string; isOwner: boolean; emptyType?: 'shop' | 'voucher'; curatorName?: string; curatorId?: number }) {
  const { t } = useTranslation()
  // 🧭 사장님을 택한 사람에게는 '담기'가 아니라 '매장 등록'이 첫 할 일이다.
  const intent = curatorId != null ? getUrShopIntent(curatorId) : null
  // 🏁 2026-06-22 (대표 — 전용 추가 페이지): 빈 상태 CTA 도 전용 picker(/u/me/add)로 (browse/group-buy 흩어짐 통합).
  const sellerFirst = intent === 'seller'
  const browseLink = sellerFirst ? '/store/new' : (emptyType === 'voucher' ? '/u/me/add?tab=voucher' : '/u/me/add?tab=shop')
  const browseLabel = sellerFirst
    ? t('curator.registerStore', { defaultValue: '매장 등록하기' })
    : emptyType === 'voucher'
      ? t('curator.browseVouchers', { defaultValue: '동네딜 추가하기' })
      : t('curator.browseProducts', { defaultValue: '상품 추가하기' })
  // 방문자: 심플 메시지 (ghost 는 소유자 동기부여용).
  if (!isOwner) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{t('curator.emptyTitle', { defaultValue: '아직 추천이 없어요' })}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('curator.emptyOther', { defaultValue: `@${handle} 의 첫 추천을 기다리는 중`, handle })}</p>
      </div>
    )
  }
  // 🎨 2026-06-16 유어샵 시안: 온보딩 진행 카드 — 이름/주소/첫핀 3단계. 빈 상태(핀 0)라 첫핀은 항상 미완.
  const nameDone = !!curatorName && !/^user\d+$/i.test(curatorName.trim())
  const handleDone = !/^user\d+$/i.test(handle)
  const doneCount = (nameDone ? 1 : 0) + (handleDone ? 1 : 0)
  // 🎨 2026-06-16 유어샵 시안(A안): 흐릿한 샘플 ghost 핀(mask gradient 로 아래로 페이드, 비활성) + 떠있는 CTA.
  //   외부 이미지 핫링크 대신 스켈레톤 블록(프로덕션 안전) — "카드가 이렇게 채워진다" 미리보기.
  return (
    <div className="max-w-3xl mx-auto px-4 pt-4">
      {/* 온보딩 진행 카드 (시안) */}
      <div className="mb-3 rounded-2xl border border-[#FFE0D6] dark:border-[#3a2218] bg-[#f9fafb] dark:bg-[#1A1410] px-4 py-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-extrabold text-[#B4422A] dark:text-[#9ca3af]">{t('curator.stepsLeft', { defaultValue: '유어샵 완성까지 {{n}}단계', n: 3 - doneCount })}</span>
          <span className="text-[12px] font-bold text-[#B4422A] dark:text-[#9ca3af]">{doneCount}/3</span>
        </div>
        <div className="mt-2.5 h-[7px] rounded-full bg-[#FFE0D6] dark:bg-[#3a2218] overflow-hidden">
          <div className="h-full rounded-full bg-[#6b7280] transition-all" style={{ width: `${Math.round((doneCount / 3) * 100)}%` }} />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#7A4232] dark:text-[#c79a87]">
          <span className={nameDone ? '' : 'font-bold text-[#141A2E] dark:text-white'}>{nameDone ? '✓' : '○'} {t('curator.stepName', { defaultValue: '이름 설정' })}</span>
          <span className={handleDone ? '' : 'font-bold text-[#141A2E] dark:text-white'}>{handleDone ? '✓' : '○'} {t('curator.stepHandle', { defaultValue: '주소 설정' })}</span>
          <span className="font-bold text-[#141A2E] dark:text-white">○ {sellerFirst ? t('curator.stepRegisterStore', { defaultValue: '매장 등록' }) : t('curator.stepFirstProduct', { defaultValue: '첫 상품 추가' })}</span>
        </div>
      </div>
      <div className="relative overflow-hidden" style={{ height: 230 }}>
        <div
          className="grid grid-cols-2 gap-3 pointer-events-none select-none"
          style={{ filter: 'blur(3px) saturate(.9)', opacity: 0.55, WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,.85) 0%, rgba(0,0,0,.35) 45%, transparent 80%)', maskImage: 'linear-gradient(180deg, rgba(0,0,0,.85) 0%, rgba(0,0,0,.35) 45%, transparent 80%)' }}
          aria-hidden="true"
        >
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="rounded-xl overflow-hidden border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#1A2334]">
              <div className="aspect-[3/2] relative bg-gray-200 dark:bg-[#1A2334]">
                <span className="absolute top-0 left-0 min-w-[1.5rem] h-6 px-1.5 bg-[#6b7280] text-white text-[13px] font-extrabold flex items-center justify-center rounded-br-[11px]">{n}</span>
              </div>
              <div className="p-2.5">
                <div className="h-3 w-4/5 rounded bg-gray-200 dark:bg-[#1A2334]" />
                <div className="h-3.5 w-1/2 rounded bg-gray-200 dark:bg-[#1A2334] mt-2" />
                <div className="mt-2 pl-2 border-l-2 border-[#6b7280]"><div className="h-2.5 w-11/12 rounded bg-gray-100 dark:bg-[#161616]" /></div>
              </div>
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center px-6 pb-1">
          <div className="w-14 h-14 rounded-2xl bg-[#6b7280] flex items-center justify-center text-white" style={{ boxShadow: '0 10px 24px -8px rgba(255,86,52,.6)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h12v16l-6-4-6 4V4Z" /></svg>
          </div>
          <h2 className="text-[17px] font-extrabold text-gray-900 dark:text-white mt-3">{sellerFirst ? t('curator.emptyOwnerSellerTitle', { defaultValue: '매장을 등록하면 시작돼요' }) : t('curator.emptyOwnerTitle', { defaultValue: '첫 상품을 추가해 보세요' })}</h2>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1.5 max-w-[270px] leading-snug">{sellerFirst ? t('curator.emptyOwnerSellerDesc', { defaultValue: '매장을 등록하면 이용권을 올릴 수 있어요. 올린 이용권이 여기 진열됩니다.' }) : t('curator.emptyOwnerDesc', { defaultValue: '마음에 든 상품·동네딜을 추가하면 이렇게 나만의 스토어가 채워져요.' })}</p>
          <Link to={browseLink} className="mt-4 w-full max-w-xs py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-[#0F151D] text-[14px] font-bold">{browseLabel}</Link>
        </div>
      </div>
    </div>
  )
}
