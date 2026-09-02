/**
 * 🔎 QA 실측 회귀 가드 (2026-09-02 대표 "QA 도와줘" — 라이브 홈 브라우저 실측).
 *
 * ## 무엇을 봤나
 * 홈 한 화면에서 **사진 5장이 우리 리사이저를 아예 안 거치고** 원본 호스트로 직행했다(브라우저 요청 로그로 확인).
 * 원인은 단순하다 — 데모 사진 출처가 카카오 플레이스라 임의 CDN 이 섞이는데, `cfImage` 는 **목록에 없는 호스트면
 * 원본 URL 을 그대로 돌려준다**. 활성 상품 15개(커버 4 · 갤러리 11)가 그 상태였고, 전부 원본 크기로 내려왔다.
 * 그리고 그중 하나는 **동아일보 사진이 만화카페 딜 카드에 라이브로** 떠 있었다(id 2879).
 *
 * ## 이 테스트가 지키는 것
 *   1. 실측으로 승격한 호스트가 두 목록(프록시 · cdn-cgi 검증)에 **함께** 있다 — 한쪽만 있으면 경로가 갈린다.
 *   2. 목록은 **줄어들지 않는다**(잠금표: 추가 OK · 제거 금지).
 *   3. 정비 큐가 차단(언론사·스톡) 사진을 **먼저** 본다 — 저작권 사진에 "나중"은 없다.
 *   4. SQL 조각에 들어가는 호스트 문자열에 따옴표가 없다(그대로 보간되므로).
 *
 * ## 못 막는 것
 *   - 새 호스트가 또 생기는 것. 그건 목록 방식의 구조적 한계이고, 대안(미지 호스트 기본 cdn-cgi)은 리다이렉트
 *     한 홉이 붙어 대표 판단이 필요하다 — 이 PR 본문에 근거와 함께 남겼다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { blockedPhotoSql } from '../../worker/utils/demo-photo-set'

const CF = readFileSync('src/utils/cf-image.ts', 'utf-8')
const CRON = readFileSync('src/worker/cron/demo-image-rehost.ts', 'utf-8')

/** 2026-09-02 실측 승격분 — cf-resized: internal=ok 확인(w200/400/600). */
const PROMOTED = ['cloudfront.net', 'digitaloceanspaces.com']
/** 이미 승격돼 있던 것 — 줄어들면 트래픽이 되돌아간다(잠금표 "제거 금지"). */
const EXISTING = ['giftishow.com', 'pstatic.net', 'kakaocdn.net', 'daumcdn.net', 'media.ur-team.com', 'kt.com']

const verifiedLine = CF.split('\n').find((l) => l.includes('const CDN_CGI_VERIFIED = [')) || ''

describe('① 승격 호스트는 두 목록에 함께 있다', () => {
  for (const h of PROMOTED) {
    it(`${h}: 프록시 목록 + cdn-cgi 검증 목록`, () => {
      expect(CF, `${h} 가 EXTERNAL_PROXY_HOSTS 에 없다 — 원본 직행으로 되돌아간다`).toMatch(new RegExp(`'${h.replace('.', '\\.')}'`))
      expect(verifiedLine, `${h} 가 CDN_CGI_VERIFIED 에 없다 — 프록시(리사이즈 불가)로 샌다`).toContain(`'${h}'`)
    })
  }
})

describe('② 목록은 줄어들지 않는다 (잠금표: 추가 OK · 제거 금지)', () => {
  for (const h of EXISTING) {
    it(`${h} 유지`, () => expect(verifiedLine).toContain(`'${h}'`))
  }
  it('안전판 onerror=redirect 가 검증 경로에 남아 있다', () => {
    expect(CF, 'onerror=redirect 가 빠지면 리사이저 실패가 곧 깨진 사진이다').toMatch(/onerror=redirect\$\{cropFrag\(opts\)\}\/\$\{cdnCgiSafe\(src\)\}/)
  })
})

describe('③ 정비 큐가 차단(언론사·스톡) 사진을 먼저 본다', () => {
  it('recondition 후보 정렬이 차단-우선이다', () => {
    expect(CRON, 'ORDER BY 가 p.id 단독으로 되돌아갔다 — 저작권 사진이 순번을 기다린다')
      .toMatch(/ORDER BY CASE WHEN \$\{blockedPhotoSql\('p\.image_url'\)\} THEN 0 ELSE 1 END, p\.id/)
  })
  it('SQL 조각이 실제 차단 호스트를 싣는다', () => {
    const sql = blockedPhotoSql('p.image_url')
    expect(sql).toContain("p.image_url LIKE '%donga.com%'")
    expect(sql).toContain("p.image_url LIKE '%yna.co.kr%'")
    expect(sql.startsWith('(') && sql.endsWith(')')).toBe(true)
  })
  it('보간되는 호스트 문자열에 따옴표가 없다', () => {
    expect(blockedPhotoSql('c')).not.toMatch(/LIKE '%[^%]*'[^%]*%'/)
  })
})
