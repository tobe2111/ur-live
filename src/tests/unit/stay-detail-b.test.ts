/**
 * 🎫 숙소 이용권 상세 — 안 B + 같이 고친 것들 (2026-09-14 대표 확정)
 *
 * 대표: *"이용권 상세페이지들 디자인 문제야. 특히 숙소 이용권에서 일자, 인원 버튼 세로 높이 길이가
 * 짧고 디자인 전반적으로 별로야"* → 시안 제시 후 *"안 B로 해주고, 고칠 것 다 고쳐줘.
 * 두 상세가 같은 부품을 쓰도록 해줘."*
 *
 * 이 파일이 지키는 것 넷:
 *   ① 안 B 구조 — 테두리 0 카드 한 장, 가운데 박수 배지, 라벨+값
 *   ② 박수·시각을 두 자리에서 말하지 않는다
 *   ③ 주소는 SSOT 하나로 (이어 붙이기 금지)
 *   ④ 두 상세가 **같은 부품**을 쓴다 + 토큰 세트가 하나다
 *
 * ⚠️ 이 테스트가 **못** 막는 것: 실제 렌더 높이·색 대비·터치 영역. 그건 눈이나 브라우저 가드가 본다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { stayAddressLine, stayRegionLabel } from '@/shared/stay-address'

const read = (p: string) => fs.readFileSync(p, 'utf8')
const code = (p: string) => stripComments(read(p))

describe('📍 주소는 한 곳에서 판정한다', () => {
  it('주소가 있으면 지역을 앞에 덧붙이지 않는다 (대표 스크린샷의 중복)', () => {
    expect(stayAddressLine('경북', '경주시', '경북 경주시 손곡3길 37-14')).toBe('경북 경주시 손곡3길 37-14')
  })

  it('지역과 주소가 다르면 주소가 이긴다 (라이브 50건 중 12건)', () => {
    // region 은 속초시인데 실제 주소는 양양군 — 이어 붙이면 있지도 않은 곳이 찍힌다.
    expect(stayAddressLine('강원', '속초시', '강원특별자치도 양양군 강현면 동해대로 3275'))
      .toBe('강원특별자치도 양양군 강현면 동해대로 3275')
  })

  it('주소가 비면 지역으로 대체한다', () => {
    expect(stayAddressLine('경북', '경주시', '')).toBe('경북 경주시')
    expect(stayAddressLine('경북', '경주시', null)).toBe('경북 경주시')
    expect(stayAddressLine(null, null, null)).toBe('')
  })

  it('짧은 라벨은 주소 앞 두 토막 (카드가 상세와 다른 지역을 말하지 않게)', () => {
    expect(stayRegionLabel('강원', '속초시', '강원특별자치도 양양군 강현면 동해대로 3275'))
      .toBe('강원특별자치도 양양군')
    expect(stayRegionLabel('경북', '경주시', '')).toBe('경북 경주시')
  })

  it('상세·검색이 그 함수를 통과한다 (직접 이어 붙이기 부활 금지)', () => {
    const detail = code('src/pages/StayDetailPage.tsx')
    expect(detail, '주소 SSOT 를 안 쓴다').toContain('stayAddressLine(')
    expect(detail, '지역+주소를 다시 이어 붙였다')
      .not.toMatch(/region_sido[^\n]*region_sigungu[^\n]*(stay\.)?address[^\n]*join/)
    expect(detail, '지역+주소를 다시 이어 붙였다(JSX)')
      .not.toMatch(/\{stay\.region_sido\}\s*\{stay\.region_sigungu\}/)
    expect(code('src/pages/StaysSearchPage.tsx')).toContain('stayRegionLabel(')
  })
})

describe('🎫 안 B — 분할 카드형', () => {
  const picker = code('src/pages/stay-detail/StayDateGuestPicker.tsx')

  it('테두리 없는 공유 카드를 쓴다 (종전: 트리거 2개가 각자 테두리)', () => {
    expect(picker).toContain('<FieldCard>')
    expect(picker, '옛 48px 테두리 트리거가 남아 있다').not.toMatch(/h-12 rounded-xl border\b/)
  })

  it('체크인·체크아웃이 한 행에서 갈라지고 가운데가 박수다', () => {
    expect(picker).toContain('<FieldSplit')
    expect(picker).toMatch(/leftLabel="체크인"/)
    expect(picker).toMatch(/rightLabel="체크아웃"/)
    expect(picker, '가운데 배지가 박수가 아니다').toMatch(/badge=\{`\$\{nightsBetween\(checkIn, checkOut\)\}박`\}/)
  })

  it('시각 각주는 값이 둘 다 있을 때만 (모르는 값을 지어내지 않는다)', () => {
    expect(picker).toMatch(/checkInTime && checkOutTime \?/)
  })

  it('펼쳐지는 달력·인원 패널은 그대로다 (8월 대표 확정분 — 이번 범위 밖)', () => {
    expect(picker).toContain('pickRange')
    expect(picker).toContain('적용하기')
    expect(picker).toContain("open === 'date'")
    expect(picker).toContain("open === 'guest'")
  })
})

describe('🔁 같은 값을 두 자리에서 말하지 않는다', () => {
  it('상세 본문에 박수·체크인 시각을 또 쓰지 않는다 (카드가 말한다)', () => {
    const detail = code('src/pages/StayDetailPage.tsx')
    expect(detail, '박스 밖 중복 줄이 되살아났다')
      .not.toMatch(/\{nights\}박 · 체크인/)
  })

  it('카드가 시각을 받는다', () => {
    expect(code('src/pages/StayDetailPage.tsx')).toContain('checkInTime={stay.check_in_time}')
  })
})

describe('🧩 두 상세가 같은 부품 · 토큰 세트는 하나', () => {
  it('공구 상세의 수량 행이 숙소와 같은 부품이다', () => {
    const box = code('src/pages/group-buy/DealPurchaseBox.tsx')
    expect(box, '공유 부품을 안 쓴다').toContain('<FieldRow')
    expect(box).toContain("@/components/ticket/FieldCard")
    expect(box, '수량 행에 1px 테두리 상자가 되살아났다')
      .not.toMatch(/border: '1px solid var\(--gbd-line2\)', borderRadius: 10/)
  })

  it('스테퍼 동작은 byte-불변 (마크업만 바뀌었다)', () => {
    const box = read('src/pages/group-buy/DealPurchaseBox.tsx')
    expect(box).toContain('setQuantity(q => Math.max(1, q - 1))')
    expect(box).toContain('setQuantity(q => Math.min(maxQty, q + 1))')
    expect(box).toContain('aria-label="수량 조절"')
    expect(box).toContain('aria-live="polite"')
  })

  it('.gbd 가 자기 hex 를 다시 갖지 않는다 (두 번째 토큰 세트 부활 금지)', () => {
    const css = read('src/index.css')
    const block = css.slice(css.indexOf('.gbd {'), css.indexOf('.ur-home-panel'))
    expect(block.length, '.gbd 블록을 못 찾았다 — 앵커가 낡았다').toBeGreaterThan(200)
    // 기능색(빨간 면) 넷만 hex 로 남는다. 그 외 hex 가 늘면 체계에서 갈라진 것이다.
    const hexes = (block.match(/#[0-9A-Fa-f]{3,8}\b/g) || []).filter((h) => h.toLowerCase() !== '#ffffff')
    expect(hexes.sort(), `.gbd 에 새 hex 가 생겼다: ${hexes.join(' ')}`)
      .toEqual(['#2E1518', '#F23E4D', '#FF5C69', '#FFF0F1'])
  })

  it('표면·구분선은 체계 토큰에서 온다', () => {
    const css = read('src/index.css')
    const block = css.slice(css.indexOf('.gbd {'), css.indexOf('.ur-home-panel'))
    for (const pair of ['--gbd-bg: var(--bg)', '--gbd-card: var(--surface)', '--gbd-line2: var(--line)']) {
      expect(block, `${pair} 가 아니다`).toContain(pair)
    }
  })

  it('정의된 적 없던 변수 둘이 이제 값을 갖는다', () => {
    // 없으면 `border: 1px solid var(--gbd-line)` 선언이 통째로 무효 → 테두리가 글자색으로 그려진다.
    const css = read('src/index.css')
    const block = css.slice(css.indexOf('.gbd {'), css.indexOf('.ur-home-panel'))
    expect(block).toContain('--gbd-line: var(--rule)')
    expect(block).toContain('--gbd-accent-soft: var(--brand-tint)')
    expect(read('src/features/group-buy/FcfsApplyBlock.tsx')).toContain('var(--gbd-line)')
  })

  it('체계에 옅은 면·중간 잉크 토큰이 라이트·다크 둘 다 있다', () => {
    const css = read('src/index.css')
    expect((css.match(/--wash:/g) || []).length, '--wash 가 한쪽 테마에만 있다').toBe(2)
    expect((css.match(/--ink2:/g) || []).length, '--ink2 가 한쪽 테마에만 있다').toBe(2)
  })
})

describe('📝 숙소 소개 문구 치유 — 보이는 칸까지', () => {
  const heal = code('src/features/admin/api/admin-stays/heal-stay-descriptions.ts')

  it('화면이 읽는 description_full 을 갱신한다', () => {
    expect(heal, 'description_full 을 안 고친다 — 화면은 이 칸을 읽는다')
      .toContain('UPDATE product_stay_info SET description_full')
  })

  it('두 칸 중 하나라도 줄표가 있으면 대상이다', () => {
    // 종전엔 p.description 하나만 봐서, 그 칸이 고쳐진 순간 행이 영영 다시 안 뽑혔다.
    expect(heal).toMatch(/p\.description LIKE '%—%' OR psi\.description_full LIKE '%—%'/)
  })

  it('데모 행만 건드린다 (관리자 수기 문구 보호)', () => {
    expect(heal).toContain("p.slug LIKE 'demo-stay-%'")
  })

  it('둘 중 하나라도 바뀌면 고침으로 센다', () => {
    expect(heal).toMatch(/r2 && \(r2\.meta\.changes \|\| 0\) > 0/)
  })
})
