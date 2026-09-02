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
import { cfImage } from '@/utils/cf-image'

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

describe('④ 미지 호스트도 리사이저를 탄다 (구멍이 닫혔는가 — 함수를 실제로 부른다)', () => {
  // 🕳️ 2026-09-02: 목록 승격은 사후약방문이다. 데모 사진 출처가 카카오 플레이스라 임의 CDN 이 계속 생기므로
  //   **기본값**이 원본 그대로면 같은 결함이 영원히 재발한다. 여기서 지키는 건 그 기본값이다.
  const UNKNOWN = 'https://cdn.some-brand-new-host.example/photo/abc.jpg'

  it('처음 보는 호스트가 cdn-cgi + onerror=redirect 로 나간다', () => {
    const out = cfImage(UNKNOWN, { width: 400 })
    expect(out, '원본 그대로 = 리사이저 우회(구멍이 다시 열렸다)').not.toBe(UNKNOWN)
    expect(out).toMatch(/^\/cdn-cgi\/image\/width=400,/)
    expect(out, 'onerror=redirect 가 없으면 리사이저 실패가 곧 깨진 사진이다').toContain('onerror=redirect')
    expect(out).toContain(UNKNOWN)
  })

  it('크롭 옵션도 함께 실린다 (상세 히어로와 같은 계약)', () => {
    const out = cfImage(UNKNOWN, { width: 900, height: 600, fit: 'cover', gravity: 'auto' })
    expect(out).toContain('height=600')
    expect(out).toContain('fit=cover')
    expect(out).toContain('gravity=auto')
  })

  /**
   * 🧪 이 배선은 **오늘은 죽은 가지다** — 그리고 그게 정확한 사실이다.
   *   `EXTERNAL_PROXY_HOSTS` 에 apex `pstatic.net` 이 있어 현재 핫링크 호스트 7개는 **전부** 목록 경로를 탄다.
   *   즉 미지-호스트 분기의 핫링크 검사를 지금 함수 호출로 발동시킬 방법이 없다(주입 검증이 이걸 잡아냈다 —
   *   처음엔 `sub.postfiles.pstatic.net` 픽스처로 짰는데 그건 목록 경로라 검사를 지워도 초록이었다).
   *   ⇒ 함수로 못 재는 것은 **배선을 소스에서** 고정한다. 새 apex 의 핫링크 CDN 이 생기는 날 이 가지가 산다.
   */
  it('미지-호스트 분기가 핫링크 검사를 cdn-cgi 앞에 둔다 (배선 고정 — 새 apex 대비)', () => {
    const CFSRC = readFileSync('src/utils/cf-image.ts', 'utf-8')
    const at = CFSRC.indexOf('if (!isSupported && !isExternalProxyable) {')
    expect(at, '미지-호스트 분기를 못 찾았다 — 앵커가 낡았다').toBeGreaterThan(0)
    const body = CFSRC.slice(at, CFSRC.indexOf('const params: string[] = []', at))
    const hot = body.indexOf('HOTLINK_BLOCKED_HOSTS')
    const cdn = body.indexOf('/cdn-cgi/image/width=')
    expect(hot, '미지-호스트 분기에 핫링크 검사가 없다').toBeGreaterThan(0)
    expect(hot, '핫링크 검사가 cdn-cgi 반환 뒤에 있으면 도달하지 않는다').toBeLessThan(cdn)
    expect(CFSRC, 'HOTLINK_BLOCKED_HOSTS 가 다시 블록 안으로 들어가면 미지 분기에서 안 보인다')
      .toMatch(/^const HOTLINK_BLOCKED_HOSTS = \[/m)
  })

  it('현재 핫링크 호스트는 (목록 경로로) 워커 프록시로 간다', () => {
    for (const h of ['postfiles.pstatic.net', 'dthumb-phinf.pstatic.net', 'naverbooking-phinf.pstatic.net']) {
      expect(cfImage(`https://${h}/x/y.jpg`, { width: 400 }), h).toMatch(/^\/api\/image\/resize\?url=/)
    }
  })

  it('검증 호스트·업로드·상대경로는 종전 그대로다', () => {
    expect(cfImage('https://bizimg.giftishow.com/a.jpg', { width: 400 })).toMatch(/^\/cdn-cgi\/image\/.*giftishow/)
    expect(cfImage('/api/media/uploads/a.jpg', { width: 400 })).toContain('media.ur-team.com')
    expect(cfImage('', { width: 400 })).toBe('')
    expect(cfImage(null)).toBe('')
  })

  it('data:/blob: 는 건드리지 않는다', () => {
    const d = 'data:image/png;base64,iVBORw0KGgo='
    expect(cfImage(d, { width: 400 })).toBe(d)
  })
})
