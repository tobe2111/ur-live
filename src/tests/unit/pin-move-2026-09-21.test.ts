/**
 * 📍 시안 ② — 지도 핀 끌어 위치 잡기.
 *
 * ## 이 시험이 **재는 것**
 * `applyPinMove` 의 실제 동작. 순수 함수라 브라우저 없이 진짜로 돌려 본다.
 *
 * ## 이 시험이 **못 재는 것**(솔직히 적어 둔다 — 가드를 과신하지 말 것)
 *  - 카카오 SDK 가 실제로 `draggable` 핀을 그리는지, `dragend` 가 오는지, `coord2Address` 응답 모양이 맞는지.
 *    jsdom 에 SDK 가 없다. 이건 **라이브에서 핀을 한 번 끌어 봐야** 판정된다.
 *  - 지도 위 안내 띠가 다크에서 읽히는지(그건 `check-dark-contrast` 가 브라우저로 잰다).
 * 배선(누가 누구에게 넘기는가)만 소스에서 확인하되, **import 줄이 아니라 호출 형태**를 앵커로 쓴다
 * (import 만 보면 배선을 끊어도 초록이 뜬다 — 이 레포가 실제로 당한 클래스).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { applyPinMove } from '@/shared/pin-move'
import { stripComments } from '../helpers/source-text'

const PAGE = 'src/pages/SellerMealVoucherNewPage.tsx'
const STEP = 'src/pages/seller-meal-voucher/StoreStep.tsx'
const PICKER = 'src/components/KakaoMapPicker.tsx'
const src = (p: string) => stripComments(readFileSync(p, 'utf-8'))

describe('핀 이동 — 무엇을 바꾸고 무엇을 지키는가', () => {
  const base = {
    restaurant_name: '광화문 김밥천국',
    restaurant_phone: '02-1234-5678',
    restaurant_address: '서울 종로구 세종대로 1',
    restaurant_lat: '37.5',
    restaurant_lng: '126.9',
  }

  it('주소를 되찾았으면 주소·좌표를 모두 바꾼다', () => {
    const out = applyPinMove(base, { address: '서울 종로구 사직로 161', lat: '37.576', lng: '126.976' })
    expect(out.restaurant_address).toBe('서울 종로구 사직로 161')
    expect(out.restaurant_lat).toBe('37.576')
    expect(out.restaurant_lng).toBe('126.976')
  })

  it('🔴 주소를 못 되찾아도 좌표는 반드시 반영한다', () => {
    const out = applyPinMove(base, { address: '', lat: '37.999', lng: '127.111' })
    expect(out.restaurant_lat).toBe('37.999')
    expect(out.restaurant_lng).toBe('127.111')
  })

  it('🔴 주소를 못 되찾았을 때 기존 주소를 빈 값으로 덮지 않는다', () => {
    const out = applyPinMove(base, { address: '', lat: '37.999', lng: '127.111' })
    expect(out.restaurant_address).toBe('서울 종로구 세종대로 1')
  })

  it('🔴 이름·전화는 핀 이동의 소관이 아니다 — 반환값에 아예 없다', () => {
    const out = applyPinMove(base, { address: '새 주소', lat: '1', lng: '2' }) as Record<string, unknown>
    expect(Object.keys(out).sort()).toEqual(['restaurant_address', 'restaurant_lat', 'restaurant_lng'])
    expect('restaurant_name' in out).toBe(false)
    expect('restaurant_phone' in out).toBe(false)
  })

  it('폼에 펼쳐도 이름·전화가 살아남는다(호출부가 실제로 쓰는 모양)', () => {
    const merged = { ...base, ...applyPinMove(base, { address: '', lat: '1', lng: '2' }) }
    expect(merged.restaurant_name).toBe('광화문 김밥천국')
    expect(merged.restaurant_phone).toBe('02-1234-5678')
  })
})

describe('배선 — 핀 이동이 실제로 이어져 있는가', () => {
  it('페이지가 SSOT 를 호출한다(이름만 import 하고 안 쓰면 빨강)', () => {
    expect(src(PAGE)).toMatch(/applyPinMove\(\s*f\s*,\s*loc\s*\)/)
  })

  it('페이지가 핀 이동 콜백을 StoreStep 에 넘긴다', () => {
    expect(src(PAGE)).toMatch(/onPinMove=\{movePin\}/)
  })

  it('StoreStep 이 그 콜백을 지도 부품에 넘긴다', () => {
    expect(src(STEP)).toMatch(/onPinMove=\{onPinMove\}/)
  })

  it('🔴 페이지의 장소 선택과 핀 이동이 합쳐지지 않았다 — 별개 함수로 남아 있다', () => {
    const s = src(PAGE)
    expect(s).toMatch(/function selectPlace\(/)
    expect(s).toMatch(/function movePin\(/)
    // 핀 이동이 전화·이름을 건드리면 합쳐진 것이다.
    const body = s.slice(s.indexOf('function movePin('), s.indexOf('function selectPlace('))
    expect(body).not.toMatch(/restaurant_phone|restaurant_name/)
  })
})

describe('지도 부품 — 핀을 안 쓰는 화면은 종전과 같아야 한다', () => {
  const s = src(PICKER)

  it('핀은 드래그 가능하게 만든다', () => {
    expect(s).toMatch(/draggable:\s*true/)
    expect(s).toMatch(/addListener\(pinRef\.current,\s*'dragend'/)
  })

  it('좌표에서 주소를 되찾는다(역지오코딩)', () => {
    expect(s).toMatch(/coord2Address\(/)
  })

  it('🔴 역지오코딩이 실패해도 좌표는 보고한다', () => {
    // 실패 경로 두 곳(지오코더 없음 / 예외) 모두 콜백을 부른다.
    const body = s.slice(s.indexOf('function reportPin('))
    expect(body.match(/cb\(\{\s*address:\s*''/g) || []).toHaveLength(2)
  })

  it('🔴 onPinMove 를 안 넘긴 화면엔 지도 클릭·지오코더가 안 달린다', () => {
    // 지도 클릭 리스너와 지오코더 생성이 같은 게이트 안에 있어야 한다.
    expect(s).toMatch(/if\s*\(onPinMoveRef\.current\)\s*\{[\s\S]*?services\.Geocoder\(\)[\s\S]*?addListener\(mapRef\.current,\s*'click'/)
  })

  it('안내 띠는 핀 모드일 때만 뜨고, 지도 위라 light-island 를 쓴다', () => {
    expect(s).toMatch(/\{onPinMove && mapReady && !sdkError &&/)
    expect(s).toMatch(/light-island/)
  })

  it('🔴 검색 결과를 지워도 사용자가 잡아 둔 핀은 안 지워진다', () => {
    const clear = s.slice(s.indexOf('function clearMarkers('), s.indexOf('function addMarker('))
    expect(clear).not.toMatch(/pinRef/)
  })
})
