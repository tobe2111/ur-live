/**
 * 🍽️ 영업신고증 축 (2026-09-16, 대표 *"영업신고증도 사진 크기 문제 없지? 남은거 다 해줘"*).
 *
 * ## 이 시험이 지키는 것 — 넷 다 "깨져도 에러가 안 나는" 종류다
 * ① **이름 충돌 금지** — 레포 안에서 `business_license_url` 은 이미 *사업자등록증*을 가리킨다
 *    (`suppliers`·도매 가입 폼). 영업신고증에 같은 이름을 쓰면 둘이 언제 갈렸는지 아무도 모른다.
 * ② **SSRF 차단** — 이 URL 은 나중에 어드민 OCR 라우트가 **서버에서 fetch** 한다. 임의 URL 을
 *    받으면 셀러가 우리 워커로 원하는 주소를 두드리게 만들 수 있다.
 * ③ **운영자에게 안 보인다** — 서류 사진에는 대표자 성명·소재지가 그대로 찍혀 있고, 같은 응답의
 *    다른 PII 는 이미 가리고 있다. 한 필드만 빠지면 그 길로 샌다.
 * ④ **사진 크기** — 거절이 아니라 압축. 그리고 **클라 상한 ≤ 서버 상한**이어야 한다
 *    (크면 "올렸는데 실패" 가 된다).
 *
 * ## 못 막는 것
 * - OCR 이 영업신고증 글자를 얼마나 잘 읽는가(모델 품질 — 배포 후 실사진 판정).
 * - 사장님이 **남의 영업신고증**을 올리는 것(그래서 소재지 대조를 같이 본다 — document-verify).
 *
 * 주입 매니페스트: scripts/mutations/ocr-document-verify.mjs
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))
const UPLOAD = read('src/components/seller/FoodPermitUpload.tsx')
const ROUTES = read('src/features/seller/api/seller-profile/business-info.ts')
const ADMIN = read('src/features/admin/api/admin-seller-ocr.routes.ts')
const PAGE = read('src/pages/SellerBusinessInfoPage.tsx')
const PANEL = read('src/pages/admin/business-verification/OcrComparePanel.tsx')
const ADMINPAGE = read('src/pages/AdminBusinessVerificationPage.tsx')
const ADMINLIST = read('src/features/admin/api/admin-sellers.routes.ts')
const PERMITFLAG = read('src/features/admin/api/seller-permit-flag.ts')

describe('① 저장 키가 사업자등록증과 충돌하지 않는다', () => {
  it('영업신고증은 food_permit_url 로 저장한다', () => {
    expect(ROUTES).toContain('food_permit_url')
    expect(UPLOAD).toContain('/api/seller/food-permit')
  })

  it('🩸 business_license_url 을 영업신고증에 재사용하지 않는다', () => {
    // 그 이름은 suppliers/도매 가입에서 **사업자등록증**이다 — 같은 이름 두 뜻이 가장 조용한 사고다
    expect(UPLOAD).not.toContain('business_license_url')
    for (const m of ROUTES.match(/business_license_url/g) || []) expect(m).toBeUndefined()
  })

  it('sellers 에 컬럼을 추가하지 않는다 — seller_meta K-V 로 간다', () => {
    // sellers 는 정확히 100컬럼 = D1 결과셋 한도(CLAUDE.md). ALTER 는 조회를 통째로 500 으로 만든다
    expect(ROUTES).toContain('setSellerMeta')
    expect(ROUTES).not.toMatch(/ALTER TABLE sellers/i)
  })
})

describe('② 저장되는 URL 은 우리 업로드 결과뿐이다 (SSRF)', () => {
  it('/api/media/ 형태만 통과시킨다', () => {
    // 어드민 OCR 라우트가 이 값을 서버에서 fetch 한다 — 임의 URL 이면 워커가 대신 두드린다
    expect(ROUTES).toMatch(/\/\^\\\/api\\\/media\\\//)
  })

  it('형태가 안 맞으면 저장하지 않고 400 으로 돌려준다', () => {
    expect(ROUTES).toMatch(/업로드된 이미지만 저장할 수 있습니다/)
  })

  it('저장은 소유자만 — 운영자(중개사)는 403', () => {
    expect(ROUTES).toMatch(/food-permit[\s\S]{0,1200}?actor\.isOwner/)
  })
})

describe('③ 운영자에게는 서류 사진을 주지 않는다', () => {
  it('마스킹 목록에 food_permit_url 이 들어 있다', () => {
    // 같은 응답의 주소·연락처는 이미 가린다. 사진 한 장이 그 전부를 담고 있다
    const masks = ROUTES.match(/for \(const k of \[[^\]]*'food_permit_url'\]\) b\[k\] = null/g) || []
    // 행이 있을 때 / 시드로 채울 때 — 분기가 둘이라 둘 다 가려야 한다
    expect(masks.length).toBe(2)
  })
})

describe('④ 사진 크기 — 거절이 아니라 압축', () => {
  it('영업신고증 업로드가 압축본을 올린다', () => {
    expect(UPLOAD).toContain('compressForDocument')
    expect(UPLOAD).toMatch(/fd\.append\('file', prepared\)/)
    expect(UPLOAD).not.toMatch(/fd\.append\('file', file\)/)
  })

  it('압축 실패가 업로드를 막지 않는다 (fail-soft)', () => {
    expect(UPLOAD).toMatch(/compressForDocument\(file\)\.catch\(\(\) => file\)/)
  })

  it('압축 **전** 크기로 미리 거절하지 않는다', () => {
    expect(UPLOAD).not.toMatch(/file\.size > \d/)
    expect(UPLOAD).toMatch(/prepared\.size > SERVER_MAX_BYTES/)
  })

  it('🩸 대시보드 등록증 경로도 같다 — 2026-09-15 수리가 여기만 비켜갔다', () => {
    // 가입 폼은 09-15 에 고쳤는데 대시보드는 `if (file.size > 5MB) 거절` 이 그대로 남아 있었다
    expect(PAGE).toContain('compressForDocument')
    expect(PAGE).not.toMatch(/if \(file\.size > 5 \* 1024 \* 1024\)/)
    expect(PAGE).toMatch(/fd\.append\('image', prepared\)/)
  })

  it('클라 상한이 그 엔드포인트의 서버 상한을 넘지 않는다', () => {
    // `/api/seller/upload-image` 는 MAX_UPLOAD_BYTES = 5MB. 클라가 10MB 를 허용하면
    // 압축 뒤에도 큰 파일이 "올렸는데 실패" 로 끝난다.
    const serverSrc = read('src/features/seller/api/seller-account.routes.ts')
    const m = serverSrc.match(/const MAX_UPLOAD_BYTES = (\d+) \* 1024 \* 1024/)
    expect(m).toBeTruthy()
    const serverMb = Number(m![1])
    const clientMatch = PAGE.match(/prepared\.size > (\d+) \* 1024 \* 1024/)
    expect(clientMatch).toBeTruthy()
    expect(Number(clientMatch![1])).toBeLessThanOrEqual(serverMb)
  })
})

describe('⑤ 어드민 OCR 이 두 서류를 갈라 읽는다', () => {
  it('kind 로 갈리고, 기본값은 등록증이다 (종전 호출부 불변)', () => {
    expect(ADMIN).toMatch(/kind:\s*DocKind\s*=\s*c\.req\.query\('kind'\) === 'business_license'/)
    expect(ADMIN).toMatch(/:\s*'business_registration'/)
  })

  it('영업신고증은 seller_meta 에서, 등록증은 sellers 컬럼에서 읽는다', () => {
    expect(ADMIN).toMatch(/kind === 'business_license'[\s\S]{0,400}?food_permit_url/)
    expect(ADMIN).toMatch(/row\.business_registration_image_url/)
  })

  it('읽은 서류 종류를 응답에 싣는다 — 화면이 무엇을 나란히 그릴지 알아야 한다', () => {
    expect(ADMIN).toMatch(/kindLabel: DOC_LABEL\[kind\]/)
  })

  it('🚧 여전히 승인·반려하지 않는다', () => {
    expect(ADMIN).not.toMatch(/UPDATE\s+sellers/i)
    expect(ADMIN).not.toMatch(/business_registration_status\s*=/)
  })
})

describe('⑥ 🩸 라우트가 있는데 부르는 화면이 없으면 죽은 코드다', () => {
  // 2026-09-16: 라우트·판정·대조를 다 만들고도 **버튼이 없어서** 아무도 못 썼다.
  // 결재 §안전 레일 ① 이 요구한 "어드민 화면에 나란히 띄우기" 가 곧 이 배선이다.
  it('어드민 검증 화면이 OCR 패널을 실제로 렌더한다', () => {
    // 🩸 첫 판은 `toMatch(/<OcrComparePanel\b/)` 이었는데 **주입이 헛돈다고 잡았다** —
    //   `{false && <OcrComparePanel .../>}` 로 꺼도 문자열이 남아 초록이었다(import 줄도 같은 함정).
    //   ⇒ 모양이 아니라 **그 줄이 게이트 없이 렌더되는가**를 본다.
    const line = ADMINPAGE.split('\n').find((l) => l.includes('<OcrComparePanel'))
    expect(line).toBeTruthy()
    expect(line!.trim().startsWith('<OcrComparePanel')).toBe(true)   // 앞에 `{cond &&` 가 없다
    expect(line).not.toContain('&&')
    expect(line).not.toContain('false')
    expect(line).toContain('sellerId={s.id}')
    expect(line).toContain('hasPermit={s.has_food_permit}')          // 버튼 게이트가 실제로 배선됐다
  })

  it('패널이 두 서류를 kind 로 갈라 부른다', () => {
    expect(PANEL).toMatch(/run\('business_registration'\)/)
    expect(PANEL).toMatch(/run\('business_license'\)/)
    expect(PANEL).toMatch(/business-registration\/ocr\?kind=\$\{kind\}/)
  })

  it('영업신고증 버튼은 그 서류가 있을 때만 뜬다', () => {
    // 없는데 버튼이 보이면 눌러 보고 400 을 받는다 — 안내가 아니라 소음이다
    expect(PANEL).toMatch(/\{hasPermit && \(/)
    // 🩸 이 단언이 내 리팩토링을 잡았다 — 플래그를 헬퍼로 빼면서 라우트 파일엔 이름이 안 남았다.
    //   ⇒ **값을 만드는 곳**(헬퍼)과 **배선**(라우트가 그 헬퍼를 부르는가)을 따로 본다.
    expect(PERMITFLAG).toMatch(/has_food_permit/)
    expect(PERMITFLAG).toMatch(/food_permit_url/)
    expect(ADMINLIST).toMatch(/attachFoodPermitFlag\(DB,/)
  })

  it('🚧 패널은 승인·반려를 하지 않는다 (판정은 참고일 뿐)', () => {
    expect(PANEL).not.toMatch(/business-registration\/verify/)
    expect(PANEL).not.toMatch(/business_registration_status/)
  })

  it('못 읽은 것을 "의심" 으로 칠하지 않는다 — unreadable 은 중립 톤', () => {
    // mismatch 만 빨강(tone-bad)이고 unreadable 은 회색이어야 한다
    expect(PANEL).toMatch(/unreadable:\s*\{[^}]*bg-gray-100/)
    expect(PANEL).toMatch(/mismatch:\s*\{[^}]*tone-bad/)
  })

  it('AI 바인딩 부재는 실패가 아니라 부재로 말한다', () => {
    expect(PANEL).toMatch(/AI_UNAVAILABLE'\)\s*toast\.info/)
  })
})
