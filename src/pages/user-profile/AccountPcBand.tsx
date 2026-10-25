/**
 * 🎗️ PC 마이의 **머리 한 줄 띠** — 대표 확정 **안 5**(2026-10-11, *"안 5로 진행하자"*).
 *
 * 대표: *"PC버전에서 보는 마이페이지 형태가 너무 옹졸해.. 전체적인 PC버전의 UI 변경도 필요해"*
 * → 시안 넷(안 2~5) 중 **안 5 — "일 먼저 · 판은 파는 쪽에만"** 확정.
 *
 * ## 무엇을 대체했나
 * 종전 PC 는 같은 머리 정보가 **두 군데로 흩어져** 있었다:
 *   · 프로필(아바타·이름·이메일·편집·벨) = `AccountPcPane` 의 **흰 판 카드** — 좁은 오른쪽 칸 안
 *   · 숫자 넷(딜·이용권·교환권·쿠폰) = 페이지 맨 위 `MyStats` 한 줄 — 전폭
 * 그래서 "나는 누구이고 무엇을 갖고 있나" 를 읽으려면 눈이 두 번 움직여야 했고, 프로필 카드가
 * 손님 칸에 **판**으로 떠 있어 2026-09-28 의 *"판이 곧 파는 쪽 표시자"* 규칙을 깨고 있었다.
 *
 * ⇒ 둘을 **카드 없는 한 줄**로 합친다. 왼쪽이 사람, 오른쪽이 숫자, 아래 hairline 하나.
 *   이 띠에는 **판이 없다**(표면 규칙 ①의 예외가 아니라, 띠는 카드가 아니다 — 유어샵 한 톤과 같은 판단).
 *
 * ## 🔢 숫자는 두 벌로 만들지 않는다
 * 여기 숫자는 **`MyStats` 그 부품**이다(`inline` 모드). 따로 그리면 폰과 PC 가 다른 값을 말하는
 * 날이 오고, 그건 에러가 안 나서 아무도 신고하지 않는다. 호출부는 둘(폰=페이지, PC=여기)이지만
 * **넘기는 prop 세 개가 같아야 한다** — 시험이 그 동일성을 대조한다.
 *
 * ## ⚠️ 모바일은 이 파일을 마운트하지 않는다
 * 페이지의 `isPc` 분기 밖이다. 폰 헤더는 `UserProfilePage` 가 그대로 그린다(손대지 않았다).
 * 다만 **헤더 문법은 둘이 같아야 한다**(09-28 에 한쪽만 고쳐 갈렸던 클래스) —
 * `my-icon-system-2026-09-28` 이 두 파일의 라벨·이메일 크기를 대조한다.
 */
import { useTranslation } from '@/lib/i18n-lite'
import { ChevronRight } from 'lucide-react'
import { BellIcon } from '@/components/icons/urdeal-icons'
import { profileAvatarSrc, profileAvatarOnError, profileAvatarFitCls } from '@/pages/user-profile/profile-avatar'
import MyStats from './MyStats'
import SellerSwitchInline from './SellerSwitchInline'
import type { MyStoresState } from './useMyStores'
import type { MyCounts } from './types'

export default function AccountPcBand({ counts, userName, profileImage, onEditProfile, onBell, sellerSeats }: {
  counts: MyCounts
  userName: string
  profileImage?: string
  onEditProfile: () => void
  /** 🔔 2026-10-11: 벨은 **올라오는 시트**를 연다 — 페이지로 떠나지 않는다(같은 날 대표 지시). */
  onBell: () => void
  /** 🪑 좌석은 페이지가 한 번만 묻는다 — 여기서 또 부르면 같은 화면이 두 답을 말한다(§15-2). */
  sellerSeats: MyStoresState
}) {
  const { t } = useTranslation()

  return (
    /* 🗂️ 2026-10-14 **PC 마이 B**(대표 *"PC 마이는 B"*) — 띠가 **카드 한 장**이 됐다.
       안 5 의 hairline 띠는 아래 블록들이 떠 있는 동안 혼자 선만 긋고 있어 *"정돈된 느낌이 부족"* 했다
       (대표). B 는 이 머리를 포함해 **모든 블록을 카드에 담고 같은 왼쪽 선**을 쓴다.
       ⚠️ 카드 모양은 `ur-pc-card`(index.css, lg 전용) 한 곳 — 아래 구역들과 같은 클래스다.
       🧱 안쪽 패딩은 그 클래스가 `.px-4` 를 넓혀 준다(카드 안 줄들과 같은 값). */
    <div className="ur-pc-card flex items-center gap-5 px-4 py-5">
      <img
        src={profileAvatarSrc(profileImage, 128)}
        alt=""
        width={64}
        height={64}
        loading="lazy"
        decoding="async"
        className={`w-16 h-16 rounded-full shrink-0 ${profileAvatarFitCls(profileImage)}`}
        onError={(e) => profileAvatarOnError(e.currentTarget, profileImage)}
      />
      {/* 👤 폰 헤더와 **같은 문법**: 줄 전체가 눌리고, 오른쪽 끝에 `프로필 편집 ›`.
          ⚠️ 벨·좌석 전환은 이 버튼 **밖**이다 — 안에 넣으면 그 둘이 편집을 여는 셈이 된다. */}
      <button
        type="button"
        onClick={onEditProfile}
        aria-label={t('userProfile.editProfile', { defaultValue: '프로필 편집' })}
        className="min-w-0 flex items-center gap-2 text-left active:opacity-70 transition-opacity"
      >
        <span className="min-w-0">
          <span className="block text-[24px] font-bold text-gray-900 dark:text-white truncate tracking-[-0.02em] leading-tight">{userName}</span>
          <span className="block text-[13px] text-gray-500 dark:text-gray-400 truncate mt-1">{localStorage.getItem('user_email') || ''}</span>
        </span>
        <span className="shrink-0 text-[12px] font-medium text-gray-500 dark:text-gray-400">{t('userProfile.editProfile', { defaultValue: '프로필 편집' })}</span>
        <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
      </button>
      <SellerSwitchInline seats={sellerSeats} />
      {/* 🔢 숫자는 오른쪽 끝에 붙는다 — 사람(왼쪽)과 자산(오른쪽)이 한 줄에서 갈린다.
          ⚠️ `min-w-0` 이 없으면 긴 숫자가 이름 칸을 밀어낸다. */}
      <div className="ml-auto min-w-0 pl-5 border-l border-rule">
        <MyStats inline voucher={counts.voucher} coupon={counts.coupon} />
      </div>
      <button
        type="button"
        onClick={onBell}
        aria-label={t('userProfile.ariaNotifications')}
        className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/[0.12] transition-colors flex items-center justify-center text-gray-700 dark:text-white shrink-0"
      >
        <BellIcon className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  )
}
