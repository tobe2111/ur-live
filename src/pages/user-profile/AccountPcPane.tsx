/**
 * 🖥️ 2026-09-02 (대표 확정 — "PC 마이: 왼쪽 메뉴 + 오른쪽은 내용"): PC(lg+) 마이의 **우측 칸 상단**.
 *
 *   대표: *"PC 모드 답지 않은 페이지야. PC모드에선 이렇게 나오면 안돼."* — 종전 PC 는 모바일 '마이'의
 *   메뉴 목록(내 이용권/내 교환권/쿠폰함/…)을 가운데 600px 에 그대로 세운 것이라, 왼쪽 메뉴와 오른쪽
 *   목록이 **같은 항목을 두 번** 보여 줬다. 오른쪽은 메뉴가 아니라 **내용**이어야 한다.
 *
 * ## 🎗️ 2026-10-11 **안 5** 로 이 칸이 둘을 잃었다 (대표 *"안 5로 진행하자"*)
 *   · ~~① 프로필 한 줄 카드~~ → **머리 띠**(`AccountPcBand`)로 올라갔다. 전폭 한 줄이 돼서 숫자와
 *     한눈에 읽히고, 손님 칸에 떠 있던 **판**이 하나 사라진다.
 *   · ~~⑤ 바로가기 타일 셋~~ → **`ShoppingGroup`**(폰과 **같은 부품**)으로 대체. 타일은
 *     `shadow-lift` 판이라 안 C 의 *"판은 파는 쪽에만"* 을 정면으로 깼고, 게다가 **폰 목록의
 *     부분집합을 손으로 다시 적은 두 번째 목록**이었다 — 셋뿐이라 숙소·찜·단골만 닿고 쿠폰함·
 *     주문 내역·배송지·리뷰는 PC 에서 갈 길이 없었다. 같은 부품을 쓰면 그 둘이 구조적으로 사라진다.
 *   남은 것: ④ 곧 쓸 이용권(티켓 카드) · ③ 이용권 현황(`OrderStatusBar`).
 *   그 아래(역할·설정·로그아웃)는 페이지가 모바일과 **같은 컴포넌트**를 이어 그린다.
 *
 *   모바일(<lg)에서는 이 컴포넌트가 마운트되지 않는다(페이지의 `isPc` 분기) — 모바일은 손대지 않는다.
 *   데이터는 전부 기존 훅/엔드포인트(`useMyCounts` · `useMyVouchers` · `/api/points/balance`) 재사용.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
// 🎨 2026-09-28: PC 칸도 모바일과 **같은 아이콘**을 써야 한 서비스로 읽힌다
//    (같은 줄이 기기마다 다른 그림이면 그게 곧 '덜 만든' 인상이다).
//    🎗️ 2026-10-11 안 5: 프로필 줄(아바타·화살표·벨)과 타일 셋이 이 파일을 떠나면서
//       `ChevronRight`·`cfImage`·`BellIcon`·타일 아이콘 셋·`SellerSwitchInline` 의 소비처가 0이 됐다.
import { parseUTCDate, formatKSTDate } from '@/utils/date'
import { useMyVouchers } from '@/hooks/queries/useMyData'
import { isStoreVoucher } from '@/shared/voucher-wallet'
import { TicketCard } from '@/components/ticket/TicketCard'
import OrderStatusBar from './OrderStatusBar'

type MyVoucher = NonNullable<ReturnType<typeof useMyVouchers>['data']>[number]

function dday(expiresAt?: string): number | null {
  if (!expiresAt) return null
  const ms = parseUTCDate(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

/**
 * 🎗️ 2026-10-11 안 5 — **prop 이 전부 사라졌다.** 프로필 넷(`userName`·`profileImage`·
 *   `onEditProfile`·`sellerSeats`)은 머리 띠로 갔고, `counts` 는 타일 셋의 찜 개수용이었는데
 *   타일이 `ShoppingGroup` 으로 대체되며 그 부품이 같은 값을 직접 받는다.
 *   ⇒ 같은 숫자를 두 경로로 내려보내지 않는다(그게 갈림의 시작이다).
 */
export default function AccountPcPane() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  /* 🔢 2026-09-29(안 C): 잔액 조회를 여기서 걷었다 — 같은 값을 `MyStats` 가 페이지 맨 위에서
     읽는다. 두 컴포넌트가 각자 `/api/points/balance` 를 부르면 **한 화면이 두 번 묻고**, 하나가
     실패하면 같은 숫자가 두 자리에서 달라진다. */
  const { data: vouchers } = useMyVouchers()
  // 곧 쓸 이용권 — 사용 가능(unused) 매장 이용권을 만료 임박순으로 3장. 기한 없는 건 뒤로.
  const soon = useMemo(() => {
    const list = ((vouchers ?? []) as MyVoucher[]).filter(v => v.status === 'unused' && isStoreVoucher(v))
    return [...list].sort((a, b) => (dday(a.expires_at) ?? 9e9) - (dday(b.expires_at) ?? 9e9)).slice(0, 3)
  }, [vouchers])

  return (
    <div className="space-y-5 pb-2">
      {/* 🔢 2026-09-29 (대표 확정 **안 C**) — **숫자 카드 넷을 걷었다.** 같은 넷이 이제 페이지
          맨 위 `MyStats` 한 줄에 있다(2열 래퍼 밖, 폰과 같은 부품). 여기 있던 카드들은 한 장에
          `p-5` + 28px 숫자 + 링크 줄이라 넷이 우측 칸의 절반을 먹었고, 실측상 **셋이 0** 이었다.
          목적지는 하나도 안 잃었다 — 네 경로 전부 그 줄의 칸이 그대로 들고 간다. */}

      {/* ④ 곧 쓸 이용권 — 티켓 카드 (지갑·결제 완료와 같은 부품). 없으면 이 절 자체를 그리지 않는다. */}
      {soon.length > 0 && (
        <div>
          <h5 className="text-[15px] font-extrabold text-gray-900 dark:text-white mb-3">{t('my.soonVouchers', { defaultValue: '곧 쓸 이용권' })}</h5>
          <div className="grid grid-cols-3 gap-4">
            {soon.map(v => {
              const d = dday(v.expires_at)
              const store = v.restaurant_name ? String(v.restaurant_name) : ''
              const name = String(v.product_name ?? '')
              return (
                <TicketCard
                  key={String(v.id)}
                  bandLeft={v.expires_at ? `${formatKSTDate(v.expires_at)}까지` : t('my.noExpiry', { defaultValue: '기한 없음' })}
                  bandRight={d == null ? undefined : `D-${d}`}
                  muted={d != null && d > 30}
                  onClick={() => navigate('/my-vouchers')}
                >
                  <div className="px-4 pt-3 pb-4">
                    {store && <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">{store}</p>}
                    <p className="text-[15px] font-bold text-gray-900 dark:text-white truncate">{name}</p>
                    <p className="mt-2 text-[13px] font-bold text-brand-text">{t('my.useVoucher', { defaultValue: '사용하기' })} ›</p>
                  </div>
                </TicketCard>
              )
            })}
          </div>
        </div>
      )}

      {/* ③ 이용권 현황 — 안 5 에서 **곧 쓸 이용권 다음**으로 내렸다. 그 위가 '지금 쓸 것',
          여기가 '지금까지 산 것의 요약', 아래 `ShoppingGroup` 이 전체 목록 — 구체 → 요약 → 전체 순이다.
          리뷰어 레벨 카드를 뺐으므로 2열 그리드도 함께 걷는다(혼자 남으면 반쪽 폭이 된다). */}
      <OrderStatusBar />
    </div>
  )
}
