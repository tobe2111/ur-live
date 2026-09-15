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

export default function StoreLocation({
  name, address, phone, lat, lng, map,
}: {
  name?: string | null
  address?: string | null
  phone?: string | null
  lat?: number | null
  lng?: number | null
  /** 잠금 lazy `RestaurantMiniMap` 을 감싼 노드(호출부 소유). */
  map: ReactNode
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
    fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flex: '0 0 auto',
  } as const

  return (
    <div id="gb-sec-location" style={{ padding: '22px 18px', scrollMarginTop: 116 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gbd-ink)', letterSpacing: '-.02em', marginBottom: 13 }}>매장 위치</div>
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
    </div>
  )
}
