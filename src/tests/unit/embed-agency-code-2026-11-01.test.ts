/**
 * 🤝 에이전시 위젯 + "홈페이지에 넣기" (2026-11-01 대표 *"모두 이상적으로"*)
 *
 * 두 가지를 고정한다:
 *  ① 에이전시 위젯이 **제휴 위젯(시안 B)과 같은 언어**로 머리띠를 그린다 — 유어딜과 회사 이름이 나란히,
 *     운영 매장 수, 그리고 갈 곳 없는 '전체 보기' 를 **안 그린다**(에이전시 공개 페이지는 없다).
 *  ② 🔴 **반대 방향** — 유어샵·매장·지역 위젯의 머리띠는 종전과 **byte-동일**이다. 에이전시 하나를
 *     고치려다 나머지 셋이 따라 바뀌면 남의 사이트에 걸린 위젯들이 조용히 달라진다.
 *
 * ⚠️ 이 가드가 **못 보는 것**: 실제 브라우저 렌더(여백·줄바꿈) · 라이브 에이전시 데이터.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { renderStrip, toEmbedCard, type EmbedRow } from '@/worker/utils/embed-widget'
import { embedCodePath } from '@/shared/embed-code-link'

const ROW: EmbedRow = { id: 1, name: '닭도리탕', price: 31000, original_price: 35000, restaurant_name: '달빛한스푼' } as EmbedRow
const cards = [toEmbedCard(ROW, 'agency')]
const code = (f: string) => readFileSync(f, 'utf8')

describe('① 에이전시 위젯 — 두 브랜드 나란히', () => {
  it('머리띠에 유어딜과 회사 이름이 나란히, 운영 매장 수가 붙는다', () => {
    const html = renderStrip({ kind: 'agency', theme: 'light', title: '한빛 마케팅 운영 매장', brand: '한빛 마케팅', meta: '운영 매장 8곳', cards })
    expect(html).toMatch(/<div class="hd co">.*?class="logo".*?<span class="sep"><\/span><span class="tt">한빛 마케팅<\/span><span class="meta">운영 매장 8곳<\/span>/)
    // 갈 곳이 없으면 링크를 안 건다(종전엔 유어딜 홈으로 갔다 — 에이전시 손님을 우리 쪽으로 보냈다).
    expect(html).not.toContain('전체 보기')
    // 🩸 렌더만 보면 호출부가 moreHref 를 되살려도 못 잡는다(주입이 잡았다) — 에이전시 핸들러를 직접 본다.
    const r = code('src/worker/routes/embed.routes.ts')
    const agencyBlock = r.slice(r.indexOf("kind: 'agency'"), r.indexOf("kind: 'agency'") + 400)
    expect(agencyBlock).not.toMatch(/moreHref/)
    expect(r).not.toMatch(/withUtm\('\/', 'agency'\)/)
  })

  it('이름을 탈출한다', () => {
    const html = renderStrip({ kind: 'agency', theme: 'light', title: 't', brand: '<i>바른</i>대행', cards })
    expect(html).toContain('&lt;i&gt;바른&lt;/i&gt;대행')
    expect(html).not.toMatch(/<i>바른/)
  })

  it('0 곳이면 지표를 안 그린다 — 신뢰 자리에 0 이 서면 없느니만 못하다', () => {
    const html = renderStrip({ kind: 'agency', theme: 'light', title: 't', brand: '한빛', cards })
    expect(html).not.toContain('class="meta"')
    // 호출부가 0 을 undefined 로 바꿔 넘기는지도 본다(여기서 거르지 않으면 '운영 매장 0곳' 이 나간다).
    const r = code('src/worker/routes/embed.routes.ts')
    expect(r).toMatch(/storeCount > 0 \? `운영 매장 \$\{storeCount\}곳` : undefined/)
  })
})

describe('② 🔴 반대 방향 — 나머지 세 위젯은 종전과 byte-동일', () => {
  const HEAD = '<div class="hd"><span class="logo" aria-label="유어딜">urdeal<i></i></span><span class="tt">'
  for (const [kind, title, more] of [
    ['ushop', '정지원님의 유어샵', '/u/jiwon1228'],
    ['store', '달빛한스푼 이용권', '/s/x'],
    ['region', '서울 이용권', '/region/서울'],
  ] as const) {
    it(`${kind} — 머리띠에 sep·meta 가 없고 '전체 보기' 가 그대로다`, () => {
      const html = renderStrip({ kind, theme: 'light', title, moreHref: more, cards })
      expect(html).toContain(HEAD + title + '</span><a class="more"')
      expect(html).toContain('전체 보기')
      expect(html).not.toContain('<span class="sep">')
      expect(html).not.toContain('class="hd co"')
    })
  }

  it('에이전시만 brand 를 넘긴다 — 나머지 셋에 번지면 이 분리가 무의미해진다', () => {
    const r = code('src/worker/routes/embed.routes.ts')
    expect(r.match(/brand: /g) || []).toHaveLength(1)
    expect(r).toMatch(/brand: agency\.name/)
  })
})

describe('③ "홈페이지에 넣기" — 번호를 몰라도 되게', () => {
  it('주소가 코드 만들기 화면으로 가고 키를 싣는다', () => {
    expect(embedCodePath('agency', 3)).toBe('/embed?type=agency&key=3')
    expect(embedCodePath('ushop', 'jiwon1228')).toBe('/embed?type=ushop&key=jiwon1228')
    expect(embedCodePath('ushop', '가 나/다')).toBe('/embed?type=ushop&key=' + encodeURIComponent('가 나/다'))
  })

  it('에이전시 콘솔이 로그인 응답의 번호를 그대로 쓴다 — 사람이 타이핑하지 않는다', () => {
    const s = code('src/pages/agency-console/AgencyStoresPanel.tsx')
    expect(s).toMatch(/const agencyId = readAgencyProfile\(\)\?\.agency\.id \?\? null/)
    expect(s).toMatch(/agencyId != null && \(/)          // 번호를 모르면 버튼을 안 그린다
    expect(s).toMatch(/openEmbedCode\('agency', agencyId\)/)
    expect(s).toContain('agency-embed-entry')
  })

  it('유어샵 관리가 자기 handle 로 연다', () => {
    const s = code('src/pages/UShopManagePage.tsx')
    expect(s).toMatch(/openEmbedCode\('ushop', curator\.handle\)/)
  })

  it('🔴 `/embed` 는 워커 화면이라 SPA 이동으로 열지 않는다', () => {
    const s = code('src/shared/embed-code-link.ts')
    expect(s).toMatch(/window\.open\(/)
    expect(s).not.toMatch(/useNavigate|navigate\(/)
    for (const f of ['src/pages/agency-console/AgencyStoresPanel.tsx', 'src/pages/UShopManagePage.tsx']) {
      expect(code(f)).not.toMatch(/navigate\(\s*embedCodePath/)
    }
  })
})
