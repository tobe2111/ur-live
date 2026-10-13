/**
 * 🛡️ 대외 소개서(어드민 `/admin/proposals`)가 **정적 자산**으로, 그리고 **지금 쓰는 소개서**로
 *    서빙되는지.
 *
 * ■ 사고 둘
 *   ① 번들 폭증 — 처음엔 `docs/business/proposals/*.html` 을 `?raw` 로 import 했다. 그 뒤 소개서에
 *      라이브 화면 캡처를 base64 로 심자 문자열이 그대로 JS 청크가 되어 `AdminProposalsPage`
 *      청크가 **254KB** 로 불고 `check-bundle-size --budget`(총 raw JS 8.6MB)이 CI 를 세웠다.
 *   ② 🩸 **옛 소개서를 조용히 서빙** (2026-10-12 대표 "고쳐줘") — 이 화면은 2026-08-30 에 만든
 *      9장 HTML(`public/static/proposals/influencer-proposal.html`)을 띄우고 있었는데, 소개서가
 *      생성기(`docs/business/proposals/*.build.mjs`)로 옮겨가 인플루언서판은 **20장 v4** 가 됐다.
 *      구판은 거기서 갈라진 채 남아 **폐지된 영입 커미션 2%**(2026-09-16 폐지)를 계속 팔고 있었고,
 *      어드민에서 열어 보내면 **없는 커미션을 약속하는 문서**가 나간다. 에러도 빌드 실패도 없다 —
 *      누가 그 화면을 다시 열어 보기 전까지 아무도 모른다.
 *
 * 이 테스트가 막는 것:
 *  R1 `?raw` 로 되돌아가기 (번들 폭증의 직접 원인)
 *  R2 참조 URL 과 실제 파일의 어긋남 (배포 후에야 빈 iframe 으로 드러난다)
 *  R3 `/static/` 밖으로 옮기기 — `_routes.json` 이 그 접두사만 워커에서 제외하므로
 *     다른 경로면 워커가 SPA 셸을 돌려주고 미리보기가 통째로 깨진다
 *  R4 **`public/` 에 PDF 사본을 만들기** — 사본은 PDF 를 다시 뽑을 때 한쪽만 갱신돼 ②를 재현한다.
 *     배포 복사는 `scripts/build-prepare.mjs` 가, dev 서빙은 `vite.config.ts` 가 맡는다(둘 다 검사).
 *  R5 **장수 표기 드리프트** — 화면이 "슬라이드 N장" 이라고 적는데 실제 PDF 가 다른 장수인 경우.
 *     덱을 다시 뽑으면 장수가 바뀌는데 숫자는 손으로 적혀 있어 반드시 낡는다.
 *  R6 **9장 구판 HTML 의 부활** — 파일이 되살아나거나 화면이 `.html` 을 참조하는 것.
 *
 * 못 막는 것: PDF 내용이 최신인지(=덱을 다시 뽑았는지), iframe 이 실제로 렌더되는지.
 *   앞은 `deck-common.mjs` 의 FACTS + 생성기 재실행이, 뒤는 배포 후 눈으로 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { readCode } from '../helpers/source-text'

const ROOT = resolve(__dirname, '../../..')
const PAGE = resolve(ROOT, 'src/pages/admin/AdminProposalsPage.tsx')
const DECK_DIR = 'docs/business/proposals'

type Entry = { url: string; slides: number }

/** 화면의 `PROPOSALS` 항목에서 (url, slides) 쌍을 뽑는다. 둘이 같은 객체에 있어야 R5 가 성립한다. */
function entries(source: string): Entry[] {
  return [...source.matchAll(/url:\s*'([^']+)'[\s\S]{0,600}?slides:\s*(\d+)/g)].map(m => ({
    url: m[1],
    slides: Number(m[2]),
  }))
}

/** PDF 페이지 수 — 외부 바이너리 없이 바이트에서 센다(`/Type /Pages` 는 페이지 트리라 제외). */
function pdfPageCount(file: string): number {
  const bytes = readFileSync(file)
  return (bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
}

describe('대외 소개서는 정적 PDF 로 서빙된다', () => {
  // 🔴 판정은 **주석을 뺀 코드**로 한다 — 이 파일들의 머리말이 지금 구판 HTML 과 `?raw` 를 **인용**하고
  //    있어서(무엇을 왜 지웠는지 적은 자리다) 원문을 검사하면 거짓 빨간불이 난다. 그리고 반대로
  //    주석 처리된 배선(`// proposalPdfDevPlugin(),`)을 살아 있는 것으로 읽는 사고도 같이 막는다.
  const source = readCode('src/pages/admin/AdminProposalsPage.tsx')
  const list = entries(source)

  it('참조하는 소개서가 최소 1개는 있다 (0개면 아래 검사가 전부 헛돈다)', () => {
    expect(list.length).toBeGreaterThan(0)
  })

  it('화면의 url 개수와 (url, slides) 쌍의 개수가 같다 (쌍이 안 잡히면 R5 가 헛돈다)', () => {
    const urls = [...source.matchAll(/url:\s*'([^']+)'/g)].length
    expect(list.length).toBe(urls)
  })

  it('R1 소개서를 `?raw` 로 번들에 넣지 않는다', () => {
    expect(source).not.toMatch(/proposal[^'"\n]*\.(html|pdf)\?raw/)
  })

  it.each(list.map(e => e.url))('R2 %s 의 원본이 docs/ 아래 실제로 존재한다', url => {
    const name = url.split('/').pop()!
    expect(existsSync(resolve(ROOT, DECK_DIR, name))).toBe(true)
  })

  it.each(list.map(e => e.url))('R3 %s 는 워커 제외 접두사(/static/) 아래에 있다', url => {
    expect(url.startsWith('/static/proposals/')).toBe(true)
  })

  it('R3 `_routes.json` 이 실제로 /static/* 를 워커에서 제외한다', () => {
    const routes = JSON.parse(readFileSync(resolve(ROOT, 'public/_routes.json'), 'utf8'))
    expect(routes.exclude).toContain('/static/*')
  })

  describe('R4 PDF 사본을 저장소에 만들지 않고, 배포·dev 양쪽에서 같은 주소로 서빙한다', () => {
    it('public/ 에 소개서 PDF 사본이 없다 (사본은 한쪽만 갱신돼 옛 소개서를 서빙한다)', () => {
      const dir = resolve(ROOT, 'public/static/proposals')
      const copies = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.pdf')) : []
      expect(copies).toEqual([])
    })

    it('build-prepare 가 docs/ 의 PDF 를 dist/client/static/proposals/ 로 복사한다', () => {
      const prepare = readCode('scripts/build-prepare.mjs')
      expect(prepare).toContain(DECK_DIR)
      expect(prepare).toContain('dist/client/static/proposals')
      expect(prepare).toMatch(/endsWith\('\.pdf'\)/)
    })

    it('vite dev 가 같은 주소(/static/proposals/*.pdf)를 원본으로 이어 준다', () => {
      const conf = readCode('vite.config.ts')
      // 🩸 `includes('proposalPdfDevPlugin()')` 로는 못 잡는다 — **함수 정의부**(`function
      //    proposalPdfDevPlugin() {`)에 같은 글자가 있어 등록을 지워도 통과한다. plugins 배열의
      //    **호출 줄**(줄 시작 + 끝 콤마)을 앵커해야 "정의는 있는데 안 쓴다" 가 걸린다.
      expect(conf).toMatch(/^\s*proposalPdfDevPlugin\(\),/m)
      expect(conf).toContain(DECK_DIR)
      expect(conf).toMatch(/static\\\/proposals/)
    })
  })

  describe('R5 "슬라이드 N장" 표기가 실제 PDF 페이지 수와 같다', () => {
    const cases = list.map(e => ({ ...e, name: e.url.split('/').pop()! }))

    it('페이지 수를 읽을 수 있다 (0장으로 읽히면 아래 대조가 헛돈다)', () => {
      const counts = cases.map(c => pdfPageCount(resolve(ROOT, DECK_DIR, c.name)))
      expect(counts.every(n => n > 0)).toBe(true)
    })

    it.each(cases)('$name 은 $slides 장', ({ name, slides }) => {
      expect(pdfPageCount(resolve(ROOT, DECK_DIR, name))).toBe(slides)
    })
  })

  describe('R6 9장 구판 HTML 은 돌아오지 않는다', () => {
    it('`public/static/proposals/influencer-proposal.html` 이 없다', () => {
      expect(existsSync(resolve(ROOT, 'public/static/proposals/influencer-proposal.html'))).toBe(false)
    })

    it('화면이 .html 소개서를 참조하지 않는다', () => {
      expect(source).not.toMatch(/url:\s*'[^']*\.html'/)
    })

    it('참조가 전부 .pdf 다', () => {
      expect(list.every(e => e.url.endsWith('.pdf'))).toBe(true)
    })
  })
})
