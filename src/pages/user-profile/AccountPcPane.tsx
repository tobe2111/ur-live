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
 *   남은 것: ④ 곧 쓸 이용권. (③ 이용권 현황은 2026-10-19 에 걷었다 — 맨 위 숫자 줄이 같은 말을 한다.)
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
import { parseUTCDate } from '@/utils/date'
import { useMyVouchers } from '@/hooks/queries/useMyData'
import { isStoreVoucher } from '@/shared/voucher-wallet'
// 🎫 2026-10-14 **PC 마이 B**: 곧 쓸 이용권이 티켓 카드 셋 → **지갑과 같은 줄**(`WalletRow`).
//    같은 날 대표가 지갑을 안 B(전부 같은 줄 + [사용])로 확정했다 — 같은 이용권이 지갑에선 줄,
//    PC 마이에선 파란 밴드 티켓이면 한 서비스 안에서 두 모양이 된다. 부품을 공유하면 갈릴 수가 없다.
import WalletRow from '@/pages/my-vouchers/WalletRow'
import type { Voucher } from '@/pages/my-vouchers/types'
import { SECTION_TITLE_CLS } from './list-grammar'

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

  /* 🗂️ 2026-10-14 **PC 마이 B**(대표 *"PC 마이는 B"*) — 이 칸이 **카드 한 장**이 됐다.
     [곧 쓸 이용권 · 전체 ›] → 줄 셋(2026-10-19 이용권 현황 제거). 종전엔 티켓 카드 셋과 현황 숫자가
     각자 떠 있어 왼쪽 선이 서로 안 맞았다(대표 스크린샷 실측: 제목 1070 ↔ 현황 1088).
     ⚠️ 카드 모양은 **`ur-pc-card` 클래스 한 곳**(index.css, lg 전용)에서 온다 — 손으로 `shadow-lift` 를
        적지 않는다. 같은 클래스를 판매·설정·내가 산 것 구역이 함께 쓴다(한 칸만 다른 그림자면 두 벌이다). */
  // 🧹 2026-10-19 — 현황 숫자를 걷어 카드의 내용이 '곧 쓸 이용권' 하나뿐이다 → 쓸 것이 없으면 카드째 접는다.
  //   ⚠️ 응답 전에도 접힌다 — 그 사이 빈 흰 판을 세우면 내용 없는 카드가 떠 있다. 이용권 목록은 기기 캐시
  //   (`useMyVouchers` initialData)가 있어 다시 온 사람에겐 첫 렌더에 이미 값이 있다.
  if (soon.length === 0) return null

  return (
    <div className="ur-pc-card">
      <div className="flex items-center justify-between px-4 pt-5 pb-1">
        <h2 className={SECTION_TITLE_CLS}>{t('my.soonVouchers', { defaultValue: '곧 쓸 이용권' })}</h2>
        <button type="button" onClick={() => navigate('/my-vouchers')} className="text-[13px] text-gray-500 dark:text-gray-400 active:opacity-70">
          {t('common.seeAll', { defaultValue: '전체 보기' })} ›
        </button>
      </div>
      <div className="divide-y divide-rule">
        {soon.map(v => (
          <WalletRow key={String(v.id)} v={v as unknown as Voucher} t={t} onOpen={() => navigate('/my-vouchers')} />
        ))}
      </div>
    </div>
  )
}
