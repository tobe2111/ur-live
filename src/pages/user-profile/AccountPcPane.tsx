/**
 * 🖥️ 2026-09-02 (대표 확정 — "PC 마이: 왼쪽 메뉴 + 오른쪽은 내용"): PC(lg+) 마이의 **우측 칸 상단**.
 *
 *   대표: *"PC 모드 답지 않은 페이지야. PC모드에선 이렇게 나오면 안돼."* — 종전 PC 는 모바일 '마이'의
 *   메뉴 목록(내 이용권/내 교환권/쿠폰함/…)을 가운데 600px 에 그대로 세운 것이라, 왼쪽 메뉴와 오른쪽
 *   목록이 **같은 항목을 두 번** 보여 줬다. 오른쪽은 메뉴가 아니라 **내용**이어야 한다:
 *     ① 프로필 한 줄 카드 ~~② 숫자 넷~~(2026-09-29 안 C — 페이지 맨 위 `MyStats` 한 줄로) ③ 주문 현황 + 리뷰어 레벨 한 줄
 *     ④ 곧 쓸 이용권(티켓 카드, 지갑·결제 완료와 같은 부품) ⑤ 바로가기 타일 넷.
 *   그 아래(수익·역할·설정·로그아웃)는 페이지가 모바일과 **같은 컴포넌트**를 이어 그린다.
 *
 *   모바일(<lg)에서는 이 컴포넌트가 마운트되지 않는다(페이지의 `isPc` 분기) — 모바일은 손대지 않는다.
 *   데이터는 전부 기존 훅/엔드포인트(`useMyCounts` · `useMyVouchers` · `/api/points/balance`) 재사용.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
// 🎨 2026-09-28: PC 칸도 모바일과 **같은 아이콘**을 써야 한 서비스로 읽힌다
//    (같은 줄이 기기마다 다른 그림이면 그게 곧 '덜 만든' 인상이다).
//    ⚠️ 이 import 에 있던 `BookOpen` 은 **참조 0인 죽은 이름**이라 함께 걷었다.
import { StayLineIcon, StarIcon, HeartIcon, BellIcon } from '@/components/icons/urdeal-icons'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { parseUTCDate, formatKSTDate } from '@/utils/date'
import { useMyVouchers } from '@/hooks/queries/useMyData'
import { isStoreVoucher } from '@/shared/voucher-wallet'
import { TicketCard } from '@/components/ticket/TicketCard'
import OrderStatusBar from './OrderStatusBar'
import ReviewLevelCard from './ReviewLevelCard'
import SellerSwitchInline from './SellerSwitchInline'
import type { MyStoresState } from './useMyStores'

type MyVoucher = NonNullable<ReturnType<typeof useMyVouchers>['data']>[number]
type Counts = { voucher: number | null; gifticon: number | null; coupon?: number | null; wish?: number | null }

const TILE_CLS = 'flex items-center gap-3 rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift px-4 py-3 text-left text-[13px] font-semibold text-gray-900 dark:text-white active:opacity-90'

function dday(expiresAt?: string): number | null {
  if (!expiresAt) return null
  const ms = parseUTCDate(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

export default function AccountPcPane({ counts, userName, profileImage, onEditProfile, sellerSeats }: {
  counts: Counts
  userName: string
  profileImage?: string
  onEditProfile: () => void
  /** 🪑 좌석은 페이지가 한 번만 묻는다 — 여기서 또 부르면 같은 화면이 두 답을 말한다(§15-2). */
  sellerSeats: MyStoresState
}) {
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

  const tiles = [
    { Icon: StayLineIcon, label: t('shopping.myStays', { defaultValue: '내 숙소 예약' }), path: '/my-stays' },
    { Icon: StarIcon, label: t('shopping.myFollows', { defaultValue: '내 단골 가게' }), path: '/my/follows' },
    { Icon: HeartIcon, label: t('shopping.wishlist', { defaultValue: '찜한 상품' }), path: '/wishlist', count: counts.wish ?? undefined },
  ]

  return (
    <div className="space-y-5 pb-2">
      {/* ① 프로필 한 줄 카드 — 보라 그라디언트 띠 대신 */}
      <div className="flex items-center gap-3 rounded-2xl bg-surface shadow-lift px-5 py-4">
        <img
          src={profileImage ? cfImage(profileImage, { width: 96 }) : `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=1C69EF&color=ffffff&size=96`}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          className="w-12 h-12 rounded-full object-cover shrink-0"
          onError={(e) => cfImageOnError(e.currentTarget, profileImage)}
        />
        {/* 👤 2026-09-28: **모바일과 같은 문법**으로 맞춘다 — 줄 전체가 눌리고 오른쪽에 화살표 하나.
            같은 날 모바일만 고치고 여기를 빠뜨려 헤더가 두 벌로 갈려 있었다(PC 는 별도 마크업이다).
            그게 이 화면이 계속 '허술해' 보이던 클래스 그 자체다 — 같은 뜻의 줄이 기기마다 다르게 생겼다.
            ⚠️ 알림 벨과 좌석 전환은 **버튼 밖**에 둔다(안에 넣으면 그 둘이 편집을 여는 셈이 된다). */}
        <button
          type="button"
          onClick={onEditProfile}
          aria-label={t('userProfile.editProfile', { defaultValue: '프로필 편집' })}
          className="min-w-0 flex-1 flex items-center gap-2 text-left active:opacity-70 transition-opacity"
        >
          <span className="flex-1 min-w-0">
            <span className="block text-[17px] font-extrabold text-gray-900 dark:text-white truncate tracking-[-0.01em]">{userName}</span>
            <span className="block text-[13px] text-gray-500 dark:text-gray-400 truncate mt-1">{localStorage.getItem('user_email') || ''}</span>
          </span>
          <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
        </button>
        <SellerSwitchInline seats={sellerSeats} />
        <button type="button" onClick={() => navigate('/notifications')} aria-label={t('userProfile.ariaNotifications')} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-700 dark:text-white shrink-0">
          <BellIcon className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* 🔢 2026-09-29 (대표 확정 **안 C**) — **숫자 카드 넷을 걷었다.** 같은 넷이 이제 페이지
          맨 위 `MyStats` 한 줄에 있다(2열 래퍼 밖, 폰과 같은 부품). 여기 있던 카드들은 한 장에
          `p-5` + 28px 숫자 + 링크 줄이라 넷이 우측 칸의 절반을 먹었고, 실측상 **셋이 0** 이었다.
          목적지는 하나도 안 잃었다 — 네 경로 전부 그 줄의 칸이 그대로 들고 간다. */}

      {/* ③ 주문 현황 + 리뷰어 레벨 — 한 줄 (기존 컴포넌트 재사용, 칸 안에서 폭 제한 무력화는 index.css) */}
      <div className="grid grid-cols-2 gap-4 items-start">
        <OrderStatusBar />
        <ReviewLevelCard />
      </div>

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

      {/* ⑤ 바로가기 타일 — 모바일 목록의 나머지 행. 여기서는 목록이 아니라 타일이다.
          🔢 2026-09-28 `grid-cols-4` → `-3`: 항목은 **셋**인데 격자가 넷이었다. 09-28 2열 이후 좁은
             칸에서 넷은 둘로 접히고(`--narrow`) 셋이 **2 + 1** 로 남아 마지막 타일만 외톨이가 됐다.
             셋이면 넓은 칸에서 한 줄, 좁은 칸에서 한 열이라 어느 쪽에서도 자투리가 없다. */}
      <div className="grid grid-cols-3 gap-4">
        {tiles.map(({ Icon, label, path, count }) => (
          <button key={path} type="button" onClick={() => navigate(path)} className={TILE_CLS}>
            <Icon className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400 shrink-0" strokeWidth={1.6} aria-hidden="true" />
            <span className="flex-1 min-w-0 truncate">{label}</span>
            <span className="text-gray-400 dark:text-gray-500 text-[12px] tabular-nums shrink-0">{count != null ? `${count} ` : ''}›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
