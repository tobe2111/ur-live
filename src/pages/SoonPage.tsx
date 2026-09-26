/**
 * 🌱 **오픈 예정** — 사전 응모를 받는 딜만 모아 본다 (2026-09-24 대표 문서 ⑤).
 *
 * 대표: *"단독공개 / 공개예정 페이지가 있었으면 좋겠음."*
 *
 * ## 엔진은 이미 있었고, 없던 건 이 화면이다
 * 오픈 예정 모델은 2026-07-05 부터 있다 — 어드민이 `mode='prelaunch'` 로 등록하면 상세가
 * **"오픈 예정 · 사전 응모 받는 중"** 배지를 그린다. 그런데 그 상품들이 일반 딜과 섞여 있어서
 * 모아 볼 곳이 없었다(2026-09-24 실측: 활성 8건이 피드에 흩어져 있었다).
 *
 * ## 화면이 지어내지 않는 것
 * "곧 오픈" 같은 날짜 약속도, "오픈하면 알려드려요" 같은 알림 약속도 하지 않는다 — 오픈일을 모르고
 * 오픈 알림을 보내는 코드도 없다. 말할 수 있는 건 **"아직 안 열었다"** 와, 사전 응모를 받는 곳이면
 * **"지금 응모할 수 있다"** 뿐이고 그건 상세가 이미 말한다.
 * 목록이 비면 빈 화면을 꾸미지 말고 **다른 딜로 보낸다**(막다른 골목을 만들지 않는다 —
 * 2026-07-20 대표 지적과 같은 규칙).
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import { DEAL_GRID_GAP } from '@/shared/deal-card-grid'
import BrandLoader from '@/components/brand/BrandLoader'

interface SoonItem { id: number; name: string; price?: number; image_url?: string; category?: string; restaurant_address?: string }

export default function SoonPage() {
  const [items, setItems] = useState<SoonItem[] | null>(null)

  useEffect(() => {
    api.get('/api/group-buy/prelaunch?limit=40')
      .then(r => setItems(r.data?.success ? (r.data.data || []) : []))
      .catch(() => setItems([]))
  }, [])

  if (items === null) return <BrandLoader fullScreen label="오픈 예정 딜을 불러오는 중" />

  return (
    <div className="min-h-[100dvh] bg-warm text-ink pb-safe-nav">
      <SEO title="오픈 예정 - 유어딜" description="아직 문을 열지 않은 매장의 딜. 사전 응모를 받는 곳은 지금 응모할 수 있어요." url="/soon" />

      <header className="ur-content-wide px-4 lg:px-8 pt-7 pb-5">
        <h1 className="text-[22px] sm:text-[27px] font-extrabold tracking-tight">오픈 예정</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-300">
          아직 문을 열지 않은 매장이에요. 사전 응모를 받는 곳은 카드를 눌러 지금 응모할 수 있어요.
          {/* 🔕 "오픈하면 알려드려요" 라고 쓰지 않는다 — 오픈 알림을 보내는 코드가 없다.
                응모의 결과 통지(`useFcfs`: "당첨 시 안내드려요")는 사전 응모를 **받는 상품**에만 있고,
                prelaunch 플래그 자체는 알림과 아무 관계가 없다. 못 지킬 약속을 화면에 박지 않는다. */}
        </p>
      </header>

      <div className="ur-content-wide px-4 lg:px-8 pb-10">
        {items.length === 0 ? (
          // 빈 화면을 꾸미지 않는다 — 지금 살 수 있는 곳으로 보낸다.
          <div className="text-center py-20">
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">지금은 응모 중인 딜이 없어요</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">새로 열 매장이 준비되면 이 자리에 올라와요.</p>
            <Link to="/" className="inline-block px-5 py-2.5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold">지금 살 수 있는 딜 보기 →</Link>
          </div>
        ) : (
          <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 ${DEAL_GRID_GAP}`}>
            {items.map((p, i) => (
              <GroupBuyFeedCard key={p.id} p={p as never} aboveFold={i < 4} to={`/pass/${p.id}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
