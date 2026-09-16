/**
 * 🏪 핫링크 차단 사진 R2 이관 — 데모 외 **실상품**까지, 단 비파괴 (2026-09-02 대표 "모두 다 진행" — 로딩 후속 ③).
 *
 * ## 배경
 * 네이버 블로그 CDN 등 7개 호스트는 우리 referer 로 403 이라 리사이즈가 안 된다(원본 그대로 77KB+). 이관 cron 은 데모만
 * 돌았다. 실측상 오늘 실상품엔 해당 사진이 0건(전부 KT CDN)이라 미래 대비이지만, 사업자 업로드가 늘면 그때 바로 먹는다.
 *
 * ## 이 테스트가 지키는 것
 *   1. 공유 목록 = `cf-image.ts` 인라인 목록(잠금 파일이라 import 대신 동일성으로).
 *   2. 후보 조회가 데모 **또는** 차단 호스트(커버·갤러리)를 잡는다.
 *   3. 실상품은 차단 호스트만 이관하고(giftishow 등 정상 CDN 무접촉), **지우지 않고**(lastTry·heal 은 데모 전용) 종결 마킹만.
 * ## 못 막는 것
 *   - 실제 이관 성공률(워커 egress 가 네이버에 막히면 tries 만 오른다 — 하트비트 `migrated` 로 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { HOTLINK_BLOCKED_HOSTS, hotlinkBlockedSql, isHotlinkBlockedUrl } from '@/shared/hotlink-blocked-hosts'

// ⚠️ 블록주석은 걷어내지 않는다 — 이 cron 파일의 주석 안에 `(URL/*·크기)` 가 있어 가짜 `/*` 가 코드를 통째로 삼킨다
//    (detail-hero-crop.test 가 먼저 밟은 함정). 줄주석만 걷는다.
const code = (p: string) =>
  readFileSync(p, 'utf-8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
const CRON = code('src/worker/cron/demo-image-rehost.ts')

describe('① 목록 동일성', () => {
  it('cf-image.ts 의 HOTLINK_BLOCKED_HOSTS 와 같다', () => {
    const cf = readFileSync('src/utils/cf-image.ts', 'utf-8')
    const m = cf.match(/const HOTLINK_BLOCKED_HOSTS = \[([^\]]+)\]/)
    expect(m, 'cf-image 인라인 목록을 못 찾았다').toBeTruthy()
    const inline = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort()
    expect([...HOTLINK_BLOCKED_HOSTS].sort()).toEqual(inline)
  })
  it('판정: 차단 호스트만 true · giftishow/R2/상대경로 false', () => {
    expect(isHotlinkBlockedUrl('https://postfiles.pstatic.net/a/b.jpg?type=w773')).toBe(true)
    expect(isHotlinkBlockedUrl('https://bizimg.giftishow.com/x.jpg')).toBe(false)
    expect(isHotlinkBlockedUrl('https://media.ur-team.com/uploads/a.jpg')).toBe(false)
    expect(isHotlinkBlockedUrl('/api/media/uploads/a.jpg')).toBe(false)
    expect(hotlinkBlockedSql('p.image_url')).toMatch(/^\(p\.image_url LIKE '%postfiles\.pstatic\.net%' OR /)
  })
})

describe('② 후보 조회 범위', () => {
  it('데모 OR 차단 호스트(커버·갤러리)', () => {
    expect(CRON).toMatch(/WHERE \(p\.slug LIKE 'demo-%' OR \$\{hotlinkBlockedSql\('p\.image_url'\)\} OR \$\{hotlinkBlockedSql\('p\.images'\)\}\)/)
  })
})

describe('③ 실상품은 좁게·비파괴', () => {
  it('실상품 externals 는 차단 호스트만', () => {
    expect(CRON).toMatch(/isExternalImageUrl\(u\) && \(isDemo \|\| isHotlinkBlockedUrl\(u\)\)/)
  })
  it('삭제(lastTry)·재획득(heal)은 데모 전용, 실상품은 giveUp 종결만', () => {
    expect(CRON).toMatch(/const lastTry = isDemo && tries \+ 1 >= MAX_TRIES/)
    expect(CRON).toMatch(/const giveUp = !isDemo && tries \+ 1 >= MAX_TRIES/)
    expect(CRON).toMatch(/if \(isDemo && rebuilt\.length === 0 && lastTry\)/)
    expect(CRON).toMatch(/\(lastTry && !healRefetched\) \|\| giveUp/)
  })
  it('실상품 R2 키는 uploads/rehost (데모 키와 분리)', () => {
    expect(CRON).toMatch(/isDemo \? 'uploads\/demo' : 'uploads\/rehost'/)
    expect(code('src/worker/utils/rehost-image.ts')).toMatch(/const key = `\$\{keyPrefix\}\/\$\{yyyymm\}\/\$\{rand\}\.\$\{ext\}`/)
  })
})
