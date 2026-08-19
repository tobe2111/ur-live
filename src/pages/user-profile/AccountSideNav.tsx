import { Link, useLocation } from 'react-router-dom'
import { User, Package, Ticket, Heart, MapPin, Settings } from 'lucide-react'

/**
 * 🧭 마이페이지 좌측 내비 (2026-08-19 — 대표 시안: 그루폰 `My Account`).
 *
 * 그루폰은 계정 화면을 [좌: 항목 목록] + [우: 그 항목의 내용] 2단으로 둔다. 우리 마이페이지는
 * 그동안 **한 줄로 길게 쌓인 모바일 화면을 PC 에서도 그대로** 보여 줬다 — 폭이 남고 스크롤만 길었다.
 *
 * 항목은 **실재하는 페이지**로만 채운다(그루폰 좌측 항목도 각각 별도 화면이다).
 * 앵커 스크롤이 아니라 라우팅이라, 어디서 눌러도 같은 곳에 도착한다.
 *
 * 📱 PC(lg+) 전용 — 모바일은 지금의 세로 흐름이 이미 맞다(하단 탭으로 이동한다).
 */

const ITEMS = [
  { icon: User,     label: '내 정보',      path: '/user/profile' },
  { icon: Package,  label: '주문 내역',    path: '/my-orders' },
  { icon: Ticket,   label: '내 이용권',    path: '/my-vouchers' },
  { icon: Heart,    label: '찜한 이용권',  path: '/wishlist' },
  { icon: MapPin,   label: '배송지',       path: '/mypage/addresses' },
  { icon: Settings, label: '설정',         path: '/account/settings' },
]

export default function AccountSideNav() {
  const { pathname } = useLocation()

  return (
    <nav aria-label="내 계정" className="hidden lg:block sticky top-24 self-start">
      <ul className="space-y-0.5">
        {ITEMS.map(({ icon: Icon, label, path }) => {
          const active = pathname === path
          return (
            <li key={path}>
              <Link
                to={path}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold transition-colors ${
                  active
                    ? 'bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-[17px] h-[17px] shrink-0" strokeWidth={active ? 2.1 : 1.8} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
