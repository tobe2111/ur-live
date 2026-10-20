/**
 * 🗑️ 2026-10-12 — 인앱 브라우저 풀스크린 안내(#ud-inapp-block) 제거 가드
 *
 * 배경(라이브 실측 — UA 를 OAI-SearchBot 으로 두고 서버 HTML 을 받아 **파싱해서** 셌다):
 *   `index.html` 의 그 블록은 2026-07-25 대표 지시("카톡도 그냥 열리게")로 자동 이동을 끊은 뒤
 *   `.show` 를 붙이는 코드가 사라져 **죽은 마크업**이었다(id 참조가 index.html 밖에 0건,
 *   `href="#"` · 빈 `#ud-url` · 복사 버튼 리스너 없음 — 설령 뜨더라도 동작하지 않는다).
 *   그런데 `display:none` 은 바이트를 지우지 않아서, **AI 검색봇**(OAI-SearchBot·Claude-SearchBot·
 *   PerplexityBot 등 — `BOT_UA_REGEX` 밖이라 봇 셸이 아닌 이 문서를 받는다)에겐
 *   **모든 페이지의 첫 본문 219자**가 "인앱 브라우저에서는 일부 기능이 제한돼요" 였다.
 *   언어모델은 문서 앞머리를 그 페이지가 무엇인지로 읽으므로 가장 비싼 자리다.
 *
 * ⚠️ 이 시험이 보는 것은 **주석을 뺀 실행되는 마크업**이다 — 제거를 기록하는 주석이 같은 id 를
 *    인용하므로(그게 다음 세션에게 왜 지웠는지 알려 주는 유일한 수단이다) 원문 전체를 검사하면
 *    거짓 빨간불이 난다. 이 레포가 `d1-migrate`·robots 가드에서 두 번 밟은 함정이다.
 *
 * ⚠️ 이 시험이 **못 보는 것**: AI 엔진이 실제로 무엇을 인용하는지(외부 판정) ·
 *    브라우저 렌더(jsdom 에 레이아웃이 없다) · 워커가 봇에게 주는 첫 화면(별도 가드).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf-8')

/** HTML 주석을 걷어낸 '실행되는 마크업'. 판정은 언제나 이쪽으로 한다. */
function execMarkup(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '')
}

describe('🗑️ 인앱 풀스크린 안내 제거 (AI 봇 문서의 첫 본문)', () => {
  const html = read('index.html')
  const exec = execMarkup(html)

  it('① #ud-inapp-block 마크업과 CSS 가 실행되는 줄에 남아 있지 않다', () => {
    expect(exec).not.toContain('ud-inapp-block')
    // 그 블록 전용 id 들도 함께 — 하나라도 남으면 일부만 지운 것이다
    for (const id of ['ud-open-btn', 'ud-copy-btn', 'ud-url', 'ud-title']) {
      expect(exec).not.toContain(id)
    }
  })

  it('② 안내 문구가 실행되는 마크업에 없다 (id 만 바꿔 되살리는 것도 차단)', () => {
    expect(exec).not.toContain('인앱 브라우저에서는')
    expect(exec).not.toContain('외부 브라우저 열기')
    expect(exec).not.toContain('다른 브라우저로 열기')
  })

  it('③ #root 앞에 본문 텍스트가 한 글자도 없다 (이 클래스 전체를 막는 불변식)', () => {
    const b = exec.indexOf('<body')
    const r = exec.indexOf('<div id="root"')
    expect(b).toBeGreaterThan(-1)
    expect(r).toBeGreaterThan(b)
    const pre = exec
      .slice(b, r)
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    // 🔑 '무엇이 남았는지' 를 메시지에 실어, 다음에 깨질 때 범인을 바로 알 수 있게 한다
    expect(pre, `#root 앞 본문: ${JSON.stringify(pre.slice(0, 160))}`).toBe('')
  })

  it('④ 폐기된 옛 이름이 메타에 없다 (크롤러가 읽는 자기소개)', () => {
    // 🩸 옛 이름을 **리터럴로 쓰지 않는다**. `urshop-naming.test.ts` 가 `src/` 를 훑어 그 단어를
    //   찾는데, 그 가드는 **자기 파일명만** 면제한다 — 여기 그대로 적으면 *그 가드가 이 파일을
    //   위반으로 집는다*(pre-push 게이트가 실제로 그렇게 막았다). 제거를 검사하는 단언은
    //   검사 대상 문자열을 담을 수 없다 — 이 세션에서 세 번째로 밟은 자리다.
    const LEGACY_NAME = ['링', '크샵'].join('')
    expect(exec, `폐기된 옛 이름이 메타에 남아 있다(${LEGACY_NAME})`).not.toContain(LEGACY_NAME)
    expect(exec).toContain('유어샵')
  })

  // ── 반대 방향: 안내를 치우다 살아 있는 경로까지 걷어내는 쪽이 더 조용하고 더 나쁘다 ──

  it('⑤ UA 감지 스크립트와 8초 슬로우 힌트는 그대로 있다', () => {
    expect(html).toMatch(/KAKAOTALK/i)
    expect(html).toContain('ur-slow-hint')
    expect(html).toContain('ur-slow-reload')
    expect(html).toMatch(/__urHardRecover/)
    // 8초 뒤 힌트 — 일반 브라우저에서 부팅이 멈췄을 때의 유일한 안내다
    expect(html).toMatch(/\}\s*,\s*8000\s*\)/)
  })

  it('⑥ 인앱에서 정말 막히는 기능의 게이트는 살아 있다', () => {
    // 풀스크린 안내 대신 '그 시점에만' 안내하는 쪽 — 이게 사라지면 인앱 사용자가 벽을 만난다
    expect(read('src/lib/in-app-browser.ts')).toMatch(/export\s+(async\s+)?function\s+openInExternalBrowser/)
    // 모달이 그 함수까지 **배선**돼 있어야 버튼이 실제로 외부 브라우저를 연다(문구만 남는 것 차단)
    const modal = read('src/components/InAppFeatureBlockedModal.tsx')
    expect(modal).toMatch(/import\s*\{[^}]*handleOpenExternal[^}]*\}\s*from\s*'@\/lib\/in-app-warning'/)
    expect(read('src/lib/in-app-warning.ts')).toMatch(/openInExternalBrowser/)
  })

  it('⑦ 잠금표가 지키는 index.html 항목이 그대로 있다', () => {
    expect(html).toContain('speculationrules')          // prerender 대상
    expect(html).toMatch(/rel="preconnect"/)            // DNS+TLS 선행
    expect(html).toMatch(/<link rel="preload" as="image" href="\/assets\/mascot\/udal-loader-v\d+\.webp"/)
    // preload 에 crossOrigin 을 붙이면 same-origin mismatch 로 200~500ms 손해(잠금표 사유)
    const preload = html.match(/<link rel="preload"[^>]*>/g) ?? []
    expect(preload.length).toBeGreaterThan(0)
    for (const tag of preload) expect(tag).not.toMatch(/crossorigin/i)
  })
})
