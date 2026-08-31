/**
 * 🎯 상세 히어로 — 고정 프레임 + 스마트 크롭 (2026-08-31 대표 승인)
 *
 * ## 왜 이 형태인가
 * 대표: *"지금 사진 비율이 지금이 가장 이상적일까? 보통 네이버에서 가져오는 사진들 비율 중 가장 많은
 * 비율로 해줘. 그루폰의 경우에는 가로에 비해서 세로가 짧잖아."* → 그래서 **직접 쟀다**(네이버 사진 70장):
 *
 *     세로가 더 김 37% · 정사각 21% · 4:3 23% · 3:2 11% · 16:9 7%   (중앙값 정확히 1:1)
 *
 * 즉 "가장 많은 비율"은 그루폰처럼 넓은 게 아니라 **정사각~세로**다. 16:9 로 가면 열 중 여섯이
 * 위아래로 잘린다. ⇒ 답은 프레임을 고르는 게 아니라 **자를 위치를 고르는 것**이었다:
 * 프레임은 3:2 로 고정(짧아서 가격이 첫 화면에 들어온다), 자를 위치는 `gravity=auto`(피사체 추적).
 *
 * ## 이 테스트가 지키는 것
 * 셋은 **한 벌**이다 — 하나만 빠지면 조용히 나빠진다:
 *   · 프레임이 고정돼 있다(딜마다 높이가 튀면 목록→상세가 덜컹거린다)
 *   · 그 프레임에 **채운다**(fit=cover) — 안 그러면 레터박스가 생긴다
 *   · 자를 위치가 **auto** — 이게 빠지면 가운데를 자르고, 세로 사진의 피사체가 날아간다
 *
 * ## 못 막는 것
 * - 실제 크롭 품질. Cloudflare 의 판단이라 우리가 검증할 수 없다 — 화면으로 봐야 한다.
 * - **검증 호스트가 아닌 사진**. 그런 사진은 워커 프록시로 가는데 그 경로는 리사이즈 자체를 못 한다
 *   (cf-image.ts 2026-06-11 실측). 프레임은 3:2 로 유지되지만 크롭은 브라우저 center 다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf-8')
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

const GALLERY = 'src/pages/group-buy/DetailGallery.tsx'
const CFIMG = 'src/utils/cf-image.ts'

describe('히어로 프레임과 크롭은 한 벌이다', () => {
  it('모바일 프레임이 3:2 로 고정돼 있다', () => {
    const s = code(read(GALLERY))
    const at = s.indexOf('scrollSnapType')
    expect(at, '모바일 슬라이더를 못 찾았다 — 앵커가 낡았다').toBeGreaterThan(0)
    const win = s.slice(Math.max(0, at - 300), at)
    expect(win, '모바일 히어로 프레임이 3:2 가 아니다').toContain("aspectRatio: '3/2'")
  })

  it('히어로 URL 이 채우기(cover) + 자동 크롭(auto)을 함께 요청한다', () => {
    const s = code(read(GALLERY))
    const at = s.indexOf('heroUrl')
    expect(at, 'heroUrl 이 사라졌다').toBeGreaterThan(0)
    const win = s.slice(at, at + 400)
    expect(win, '높이를 안 보내면 크롭이 일어나지 않는다').toContain('height:')
    expect(win, 'fit=cover 가 빠졌다 — 레터박스가 생긴다').toContain("fit: 'cover'")
    expect(win, "gravity 가 빠졌다 — 가운데를 잘라 세로 사진의 피사체가 날아간다").toContain("gravity: 'auto'")
  })

  it('모바일 슬라이드가 heroUrl 을 쓴다 (옛 bg() 로 되돌아가지 않았다)', () => {
    const s = code(read(GALLERY))
    const at = s.indexOf("aspectRatio: '3/2'")
    const win = s.slice(at, at + 800)
    expect(win, '슬라이드가 크롭 없는 경로로 되돌아갔다').toContain('heroUrl(src, 900)')
  })
})

describe('cf-image 가 크롭 옵션을 실제로 URL 에 싣는다', () => {
  it('검증 호스트 빠른 경로에도 크롭이 붙는다', () => {
    // 🩸 이 경로는 옵션 문자열을 **손으로 조립**해서, 예전엔 height/fit 을 통째로 무시했다.
    //    우리 상세 사진 대부분(pstatic)이 이 경로라, 여기 안 붙이면 크롭이 한 번도 안 걸린다.
    // 🩸🩸 이 파일엔 `code()`(블록주석 제거)를 쓰면 안 된다 — 주석 안의 `(/api/media/*, ...)` 의
    //    `/*` 가 블록주석 시작으로 오인돼 **실제 코드까지 통째로 잘려 나간다**(처음에 그렇게 짰다가
    //    앵커를 못 찾아 빨간불이 났다). 여기서는 `return` 으로 시작하는 **코드 줄만** 골라 본다.
    const lines = read(CFIMG).split('\n').map((l) => l.trim()).filter((l) => l.startsWith('return `/cdn-cgi/'))
    expect(lines.length, 'cdn-cgi URL 을 조립하는 return 을 못 찾았다 — 앵커가 낡았다').toBeGreaterThanOrEqual(2)
    const hand = lines.filter((l) => l.includes('onerror=redirect'))
    expect(hand.length, '손으로 조립하는 빠른 경로를 못 찾았다').toBeGreaterThanOrEqual(2)
    for (const l of hand) {
      expect(l, `빠른 경로가 크롭 옵션을 버린다: ${l.slice(0, 60)}…`).toContain('cropFrag(opts)')
    }
  })

  it('gravity 를 안 넘긴 호출은 URL 이 그대로다 (엣지 캐시 전체 미스 방지)', () => {
    const s = read(CFIMG)
    const at = s.indexOf('function cropFrag')
    expect(at, 'cropFrag 이 사라졌다').toBeGreaterThan(0)
    const body = s.slice(at, at + 300)
    expect(body, 'gravity 게이트가 없다 — 기존 호출의 URL 이 전부 바뀌어 캐시가 통째로 미스 난다')
      .toMatch(/if \(!o\.gravity\) return ''/)
  })
})

describe('두 상세가 같은 상단바를 쓴다 (갈리지 않게)', () => {
  // 🩸 대표: "숙소 이용권도 일반 이용권처럼 윗 형태와 동일해야지. 왜 계속 다르게 하는거지?"
  //    원인은 취향이 아니라 구조였다 — 숙소는 이 상단바 컴포넌트를 **아예 안 쓰고** 갤러리 위에
  //    뒤로가기 버튼 하나만 얹고 있었다. 그래서 로고·찜·공유가 통째로 빠졌고, 고칠 때마다 한쪽만
  //    고쳐졌다(버튼 톤을 맞춰 준 다음 커밋에서도 여전히 헤더 자체가 없었다).
  //    ⇒ **컴포넌트를 공유하면 갈릴 수가 없다.** 그 배선을 여기서 고정한다.
  const PAGES = ['src/pages/GroupBuyDetailPage.tsx', 'src/pages/StayDetailPage.tsx']

  it('두 상세 모두 공용 상단바를 렌더한다', () => {
    for (const f of PAGES) {
      expect(read(f), `${f}: 공용 상단바를 안 쓴다`).toMatch(/<DetailFloatingHeader\b/)
    }
  })

  it('상단바를 자기 페이지에 다시 만들지 않았다 (갤러리 위 외톨이 뒤로가기 금지)', () => {
    // 숙소가 갖고 있던 형태: 갤러리 안에 `absolute ... aria-label="뒤로 가기"` 버튼.
    for (const f of PAGES) {
      const s = code(read(f))
      expect(s, `${f}: 상단바 밖에 뒤로가기를 또 만들었다`).not.toMatch(/absolute[^"]*"[^>]*aria-label="뒤로/)
    }
  })

  it('스크롤 상태를 페이지가 아니라 상단바가 갖는다', () => {
    // 페이지가 각자 갖고 내려 주면, 새 상세를 만들 때 그 배선을 빠뜨리기 쉽다(실제로 그렇게 갈렸다).
    const hdr = code(read('src/components/deal/DetailFloatingHeader.tsx'))
    // ⚠️ `toContain('setHeaderSolid')` 로는 부족하다 — useState **선언부**에도 그 이름이 있어서,
    //    스크롤 핸들러에서 호출을 통째로 지워도 초록이 뜬다(되돌려-검증에서 잡았다). 호출을 본다.
    expect(hdr, '상단바가 스크롤에 반응하지 않는다').toMatch(/setHeaderSolid\(/)
    expect(hdr, '상단바가 스크롤을 구독하지 않는다').toContain("addEventListener('scroll'")
    for (const f of PAGES) {
      expect(code(read(f)), `${f}: 페이지가 headerSolid 를 다시 들고 있다`).not.toContain('setHeaderSolid')
    }
  })
})
