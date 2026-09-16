/**
 * 📱 셀러 폰 하단 고정 바 — **자리를 만들고, 자기가 거기 있다고 알린다** (2026-09-15 신설).
 *
 * 🩸 왜 부품이 됐나 (대표 신고 *"버튼들이 겹치는 경우도 있고"*): `SellerGroupBuyPage` 가 이 바를
 *   손으로 그렸는데, 같은 띠를 **카카오 상담 FAB**(`SellerLayout`, 종전 `bottom-24` = 96px)이 쓰고 있었다.
 *   실측: 하단 탭 60px + 이 바 ~64px → 바가 60~124px 을 덮는데 FAB 은 96~136px 이다. 정면 충돌이다.
 *   FAB 은 전역이고 바는 페이지별이라, 페이지마다 손으로 맞추면 다음 페이지에서 또 겹친다.
 *   ⇒ 바가 `body.seller-has-bottom-bar` 를 켜고, FAB 은 그 신호를 보고 비켜 준다(`index.css`).
 *
 * 함께 맡는 것: 마지막 행이 바에 가리지 않도록 **스페이서**(CLAUDE.md 모바일 뷰포트 룰 — 고정 숫자
 * 여백을 페이지마다 손으로 맞추면 반드시 어긋난다).
 *
 * ⚠️ PC(`md:`)에는 아무것도 안 그린다 — PC 는 바가 없고 FAB 은 `md:bottom-4` 로 화면 구석에 산다.
 */
import { useEffect, type ReactNode } from 'react'
import { SELLER_TABBAR_H } from './SellerBottomTabs'

/** 바 자체의 높이(스페이서와 FAB 비킴 계산이 같은 값을 써야 한다). */
export const SELLER_BOTTOM_BAR_H = 64

export default function SellerBottomBar({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('seller-has-bottom-bar')
    return () => { document.body.classList.remove('seller-has-bottom-bar') }
  }, [])

  return (
    <>
      <div className="md:hidden" aria-hidden style={{ height: SELLER_BOTTOM_BAR_H }} />
      <div
        className="fixed inset-x-0 z-[40] px-4 pb-3 pt-2 md:hidden"
        style={{
          bottom: `calc(${SELLER_TABBAR_H}px + env(safe-area-inset-bottom))`,
          background: 'linear-gradient(180deg, rgba(248,247,252,0), #F8F7FC 40%)',
        }}
      >
        {children}
      </div>
    </>
  )
}
