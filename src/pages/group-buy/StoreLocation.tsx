/**
 * 📍 매장 위치 — 지도 + 주소 + 전화 + 길찾기 (2026-09-15 대표 확정 "안 B")
 *
 * ## 왜 추출했나
 * `GroupBuyDetailPage.tsx` 는 파일크기 래칫 여유가 거의 0(baseline 944)이라 한 줄도 못 늘린다.
 * 고치면서 옮긴다 — 이 블록은 상태도 데이터 조회도 없는 순수 표시라 가장 깨끗하게 떨어진다.
 *
 * ## 무엇이 달라졌나
 *   ① **경계 제거(안 3)** — 지도 위/아래를 `1px solid` 로 감싸 한 상자를 이루고 있었다. 섹션 여백이
 *      이미 구획을 하고 있어 테두리는 같은 일을 두 번 했다. 지도는 둥근 블록, 주소는 그 아래 본문 한 줄.
 *      🔀 2026-09-15 머지: main 이 같은 날 같은 블록을 이 모양으로 확정했고(대표 "안 3으로 해줘"),
 *      내 안 B 시안의 매장 위치도 같은 그림이었다 — 두 승인이 어긋나지 않는다.
 *   ② **전화 버튼 신설** — 종전엔 전화번호가 *제목 밑 주소 줄*에 밑줄 링크로 끼어 있었다.
 *      2888 실측에서 `063-251-6785` 가 두 줄로 깨지며 주소를 밀어냈다. 전화는 "가기 직전에
 *      누르는 것"이라 지도 옆이 제자리다. 번호가 없으면 버튼 자체를 안 그린다.
 *
 * ## 못 하는 것
 * 지도 자체는 그리지 않는다 — `RestaurantMiniMap` 은 잠금 lazy(로딩 최적화 잠금표)라 호출부가
 * `map` 으로 넘긴다. 여기서 import 하면 그 lazy 경계가 이 파일로 옮겨져 잠긴 계약이 흔들린다.
 */
import type { ReactNode } from 'react'
import StoreReportLink from './StoreReportLink'
import BrandBranchesLink from './BrandBranchesLink'
import NeighborhoodLink from './NeighborhoodLink'

export default function StoreLocation({
  name, address, phone, lat, lng, map, sellerId, productId, onProfile,
}: {
  name?: string | null
  address?: string | null
  phone?: string | null
  lat?: number | null
  lng?: number | null
  /** 잠금 lazy `RestaurantMiniMap` 을 감싼 노드(호출부 소유). */
  map: ReactNode
  /**
   * 🚨 2026-09-21 제보 입구용. 이 부품은 여전히 **상태를 안 갖는다** — 시트 열림은
   * `StoreReportLink` 가 갖고, 여기는 값을 그대로 흘려보내기만 한다.
   * 상세 페이지(`GroupBuyDetailPage`)는 파일크기 래칫이 동결이라 줄을 못 늘린다 ⇒
   * 입구를 여기에 둔다(그 제약이 이 파일이 존재하는 이유이기도 하다 — 위 머리말 참조).
   */
  sellerId?: number | null
  productId?: number | null
  /** 🏪 2026-10-11 (D안): 셀러 카드를 모바일에서 걷으면서 '가게 보기' 입구를 매장 카드 머리로 옮겼다. */
  onProfile?: () => void
}) {
  const directionsHref = `https://map.kakao.com/link/${
    lat && lng
      ? `to/${encodeURIComponent(name || '매장')},${lat},${lng}`
      : `search/${encodeURIComponent(address || name || '')}`
  }`
  /**
   * 🔀 2026-09-15 머지: main 이 같은 날 같은 블록을 "안 3(경계 없음)"으로 고쳤다 — 의도가 같았고
   *   (카드 테두리 제거) 그쪽이 버튼을 `--rule-strong` outline 으로 통일해 뒀다. 그 규약을 가져온다
   *   (체계의 `TicketOutlineButton` 과 같은 손잡이 모양). 지도·주소 자체는 경계가 없다(안 3).
   */
  const btn = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '9px 14px', border: '1px solid var(--rule-strong)', borderRadius: 11,
    background: 'var(--gbd-card)', color: 'var(--gbd-ink)',
    fontSize: 13, fontWeight: 500, textDecoration: 'none', whiteSpace: 'nowrap', flex: '0 0 auto',
  } as const

  return (
    <div id="gb-sec-location" style={{ padding: '20px 16px', scrollMarginTop: 116 }}>
      {/* 🏪 2026-10-11 (D안): 제목을 '매장 위치' → **가게 이름**으로. 모바일에서 셀러 카드를 걷었으니
          가게로 가는 입구('가게 보기')가 여기 머리에 붙는다. 이름이 없으면 종전 제목. */}
      <div className="flex items-center justify-between gap-3" style={{ marginBottom: 12 }}>
        <h2 className="m-0 text-[15px] font-bold tracking-[-.01em] truncate" style={{ color: 'var(--gbd-ink)' }}>{name || '매장 위치'}</h2>
        {onProfile && (
          <button type="button" onClick={onProfile} className="shrink-0 inline-flex items-center gap-1 min-h-[44px] -my-3 -mr-2 pl-3 pr-2 text-[13px] font-medium bg-transparent border-0 cursor-pointer" style={{ color: 'var(--gbd-sub)' }}>{/* 👆 2026-10-11 대표 "눌러지지도 않는데": 글자만한 19px 였다 → 손가락 크기(44px) 눌림 영역, 줄 높이는 음수 여백으로 불변 */}
            가게 보기
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        )}
      </div>
      {/* 🪟 안 3(경계 없음) — 상자를 없앤다. 지도는 둥근 사진 한 장, 주소는 그 아래 본문 한 줄.
          섹션 구획은 위아래 여백이 이미 하고 있어서 테두리는 같은 일을 두 번 했다. */}
      <div style={{ borderRadius: 14, overflow: 'hidden' }}>
        {map}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 0 0' }}>
        {/* 🧾 매장명은 제목 위(머천트 줄)와 지도 핀에 이미 두 번 나온다 — 여기까지 세 번은 "채워 넣은" 티다. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {address && <div style={{ fontSize: 13, color: 'var(--gbd-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{address}</div>}
        </div>
        {phone && (
          <a href={`tel:${phone}`} aria-label={`매장에 전화 (${phone})`} style={btn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gbd-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.68 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.32 1.85.55 2.81.68A2 2 0 0 1 22 16.92z" /></svg>
            전화
          </a>
        )}
        <a href={directionsHref} target="_blank" rel="noopener noreferrer" style={btn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gbd-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z" /></svg>
          길찾기
        </a>
      </div>
      {/* 🏷️ 2026-10-17 프랜차이즈 — 브랜드에 묶인 지점이면 "다른 지점 N곳 보기". 없으면 아무것도 안 그린다. */}
      <BrandBranchesLink sellerId={sellerId} productId={productId} />
      {/* 🏘️ 2026-10-19 같은 동네 이용권 모음으로 — 색인 대상 동네일 때만(thin 페이지로 안 보낸다). */}
      <NeighborhoodLink address={address} />
      {/* 🚨 제보 입구 — 회색 작은 글씨 한 줄. 크게 그리면 멀쩡한 매장을 의심하게 만든다. */}
      <div style={{ paddingTop: 12 }}>
        <StoreReportLink sellerId={sellerId} productId={productId} storeName={name} />
      </div>
    </div>
  )
}
