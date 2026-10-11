/**
 * 🔒 sitemap 이 서류 사진을 구글에 넘기지 않는다 — 2026-10-11.
 *
 * ## 실측 배경 (추측 아님)
 * 라이브 `sitemap.xml` 에 이 줄이 있었다:
 *   <loc>https://urdeal.kr/pass/2916</loc>
 *   <image:loc>…/uploads/biz-cert/2026-09/C7QDtf61r6GMZgzIb2M4rHwC4zr6AMDf.png</image:loc>
 * 그 PNG 는 `http 200 · image/png · 63,765 bytes` 로 공개 응답한다(열어 보지 않고 헤더로만 확인).
 * 사업자등록증에는 대표자 성명·사업장 주소·사업자번호가 적혀 있다.
 *
 * 2026-06-11 에 R2 를 공개로 돌리며 biz-cert 의 방어를 **"추측 불가능한 URL"** 하나로 두었는데,
 * sitemap 이 그 URL 을 검색엔진에 **직접 건네주고** 있었다 — 유일한 방어의 정면 무효화다.
 *
 * ## 이 시험이 못 보는 것
 * - 이미 색인된 것은 코드로 못 되돌린다(검색엔진 쪽 삭제 요청 + 상품 내리기가 필요).
 * - sitemap **밖**의 노출(JSON-LD `image`, og:image, 상세 화면의 커버)은 여기서 안 본다.
 *   그건 애초에 서류를 커버로 못 쓰게 하는 업로드 단의 일이다.
 * - 파일이 정말 사업자등록증인지는 안 본다 — **경로**로만 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  isIndexableImageUrl,
  PRIVATE_UPLOAD_PREFIXES,
  CATALOG_UPLOAD_PREFIXES,
} from '@/shared/seo/indexable-image'
import { readCode, stripComments } from '../helpers/source-text'

const SITEMAP = 'src/worker/routes/sitemap.routes.ts'

describe('① 판정 — 서류 경로는 거부한다', () => {
  it('라이브에서 실제로 샜던 그 URL 을 거부한다', () => {
    expect(isIndexableImageUrl(
      'https://urdeal.kr/api/media/uploads/biz-cert/2026-09/C7QDtf61r6GMZgzIb2M4rHwC4zr6AMDf.png',
    )).toBe(false)
  })

  it('모든 비공개 접두사를 거부한다 (목록이 비면 통과가 아니라 실패)', () => {
    expect(PRIVATE_UPLOAD_PREFIXES.length).toBeGreaterThanOrEqual(5)
    for (const p of PRIVATE_UPLOAD_PREFIXES) {
      expect(isIndexableImageUrl(`https://urdeal.kr/api/media/uploads/${p}/2026-09/x.png`)).toBe(false)
    }
  })

  it('🩸 cdn-cgi 변환본 안에 숨은 서류도 거부한다 — 호스트만 보면 통째로 샌다', () => {
    // 상세 히어로가 실제로 쓰는 모양: 원본 URL 이 **경로 안에** 들어간다.
    expect(isIndexableImageUrl(
      '/cdn-cgi/image/width=900,quality=85,fit=cover/https://media.ur-team.com/uploads/biz-cert/2026-09/x.png',
    )).toBe(false)
  })

  it('대소문자·쿼리가 붙어도 거부한다', () => {
    expect(isIndexableImageUrl('https://x/uploads/BIZ-CERT/a.png')).toBe(false)
    expect(isIndexableImageUrl('https://x/uploads/biz-cert/a.png?width=200')).toBe(false)
  })

  it('카탈로그 사진은 전부 통과시킨다 (과잉 차단이 곧 조용한 색인 손실)', () => {
    expect(CATALOG_UPLOAD_PREFIXES.length).toBeGreaterThanOrEqual(4)
    for (const p of CATALOG_UPLOAD_PREFIXES) {
      expect(isIndexableImageUrl(`https://urdeal.kr/api/media/uploads/${p}/2026-09/x.jpg`)).toBe(true)
    }
  })

  it('OG 카드·외부 CDN·cdn-cgi 정상 변환본도 통과시킨다', () => {
    expect(isIndexableImageUrl('https://urdeal.kr/api/og/group-buy/2732')).toBe(true)
    expect(isIndexableImageUrl('https://bizimg.giftishow.com/a.jpg')).toBe(true)
    expect(isIndexableImageUrl(
      '/cdn-cgi/image/width=900/https://media.ur-team.com/uploads/demo/2026-09/a.jpg',
    )).toBe(true)
  })

  it('빈 값은 "내보낼 것 없음"(false) 이지 통과가 아니다', () => {
    for (const v of ['', '   ', null, undefined, 0, {}]) {
      expect(isIndexableImageUrl(v as unknown)).toBe(false)
    }
  })
})

describe('② 배선 — sitemap 이 실제로 그 판정을 지난다', () => {
  const code = stripComments(readCode(SITEMAP))

  it('초크포인트(`<image:loc>` 를 만드는 자리)가 판정을 거친다', () => {
    // 주석이 아니라 **표현식**으로 앵커한다(주석만 남아도 통과하는 함정 차단).
    expect(code).toMatch(/const\s+imgLoc\s*=\s*isIndexableImageUrl\(/)
  })

  it('원시 URL 이 판정을 건너뛰고 바로 imgLoc 이 되지 않는다', () => {
    expect(code).not.toMatch(/const\s+imgLoc\s*=\s*u\.image\s*\?/)
  })

  it('공구 분기는 비공개 커버를 OG 카드로 대체한다 (사진을 통째로 잃지 않게)', () => {
    expect(code).toMatch(/image:\s*\(isIndexableImageUrl\(g\.image_url\)[^\n]*api\/og\/group-buy/)
  })
})

describe('③ 드리프트 — 새 업로드 접두사가 분류 없이 들어오면 빨간불', () => {
  it('소스에 쓰이는 모든 uploads/<접두사>/ 가 둘 중 하나로 분류돼 있다', () => {
    const roots = ['src/worker', 'src/features', 'src/shared', 'src/pages', 'src/components']
    const found = new Set<string>()
    const walk = (dir: string) => {
      let ents: string[]
      try { ents = readdirSync(dir) } catch { return }
      for (const e of ents) {
        const f = join(dir, e)
        if (statSync(f).isDirectory()) { walk(f); continue }
        if (!/\.(ts|tsx)$/.test(f)) continue
        if (f.includes('indexable-image')) continue  // 목록 자신은 제외
        for (const m of readFileSync(f, 'utf8').matchAll(/uploads\/([a-z][a-z0-9-]*)\//g)) {
          found.add(m[1])
        }
      }
    }
    roots.forEach(walk)

    // 0건이면 통과가 아니라 실패 — 경로가 낡아 조용히 비는 것을 막는다.
    expect(found.size).toBeGreaterThan(0)

    const known = new Set<string>([...PRIVATE_UPLOAD_PREFIXES, ...CATALOG_UPLOAD_PREFIXES])
    const unclassified = [...found].filter(p => !known.has(p)).sort()
    expect(
      unclassified,
      `새 업로드 접두사가 분류되지 않았다: ${unclassified.join(', ')}\n` +
      '→ src/shared/seo/indexable-image.ts 의 PRIVATE_/CATALOG_UPLOAD_PREFIXES 중 한쪽에 넣을 것. ' +
      '서류면 PRIVATE(검색엔진에 안 넘김), 카탈로그 사진이면 CATALOG.',
    ).toEqual([])
  })
})
