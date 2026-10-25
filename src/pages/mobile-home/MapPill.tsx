/**
 * 🗺️ 모바일 홈 지도 알약 (2026-10-14 대표 확정 — 다안 · A *"작은 잉크 알약"*).
 *
 * 종전엔 위치 제목 옆 [목록|지도] 전환이 지도로 가는 길이었는데, 머리 전체가 `sticky` 라 늘 화면
 * 위쪽을 차지했다. 그 전환을 걷고 **하단 탭 바로 위 가운데**에 알약 하나를 늘 띄운다(에어비앤비 방식).
 *
 * - 크기: 높이 32px · 13px 글자 — 시안 1차(48px)는 "좀 큰데?" 로 반려됐다.
 * - 색: 라이트 = 잉크 면 + 흰 글자 / 다크 = 흰 면 + 잉크 글자. **늘 바탕의 반대**라 어떤 사진 위에서도
 *   읽힌다(다크에서 검정을 그대로 두면 바탕에 묻힌다 — 시안에서 확인).
 * - 자리: 하단 탭(56px + 홈 인디케이터) 위 12px. 탭과 같은 `hide-on-keyboard` — 키보드가 뜨면 함께 숨는다.
 * - z: 콘텐츠 위 · 모달(10500)·하단 탭(9999) 아래.
 *
 * ⚠️ 하단 탭에 지도가 없으므로 이 알약이 **유일한 통로**다 — 지우지 말 것.
 */
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapFoldIcon } from '@/components/icons/urdeal-icons'
import { warmKakaoMapsAfterLoad, preconnectMapTiles } from './map-warmup'

export default function MapPill() {
  // 🗺️ 2026-10-15 홈이 다 뜬 뒤 지도 SDK 를 미리 받아 둔다 — 누르면 SDK 왕복 셋을 기다리지 않는다(`map-warmup.ts`).
  useEffect(() => warmKakaoMapsAfterLoad(), [])
  return (
    <div
      className="fixed left-0 right-0 z-40 flex justify-center pointer-events-none hide-on-keyboard"
      style={{ bottom: 'calc(56px + 12px + env(safe-area-inset-bottom, 0px))' }}
    >
      <Link
        to="/map"
        aria-label="지도로 보기"
        onPointerDown={preconnectMapTiles}
        // 면 = `--ink`(라이트 #16181C · 다크 #F8F7FC) · 글자 = `--surface` — 토큰이 모드마다 뒤집혀 늘 바탕의 반대다.
        className="pointer-events-auto inline-flex h-8 items-center gap-1 rounded-full bg-ink px-4 text-[13px] font-medium text-surface shadow-[0_4px_12px_rgba(0,0,0,0.25)] active:scale-95 transition-transform"
      >
        <MapFoldIcon size={15} />
        지도
      </Link>
    </div>
  )
}
