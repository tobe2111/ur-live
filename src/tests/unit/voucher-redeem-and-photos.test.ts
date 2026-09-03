/**
 * 🎟️🖼️ 2026-09-03 대표 신고 3건 — 사용 방식 · 리뷰 버튼 · 갤러리 중복
 *
 * ■ ① 사용 방식 (대표: *"우리는 QR 아니면 매장 확인코드 4자리~6자리야"*)
 *   라이브는 구멍이 세 겹이었다: 기본값 `self_free` · 판매자 없는 상품은 게이트 **건너뜀** ·
 *   조회 실패 시 fail-open. 집에서도 이용권을 소각할 수 있었다.
 *   ⚠️ 두 방식은 양자택일이 아니다 — **직원 QR 스캔은 모드와 무관하게 항상 열려 있다**
 *   (`/:code/use-by-seller` 에는 모드 검사가 없다). 모드는 *손님 셀프*만 가른다.
 *
 * ■ ② 리뷰 등록 버튼 (대표: *"아예 안 눌러지게 되어있네?"*)
 *   10자 미만이면 비활성인데 **왜인지 화면에 안 썼다.** 두 글자 쓴 사람은 버튼이 죽은 줄 알고
 *   떠나므로, 그 뒤에 붙는 서버 판정 문구를 볼 기회조차 없었다.
 *
 * ■ ③ 갤러리 중복 (대표: *"사진 1개인데 여러 장인 것처럼, 좌우 눌러도 같은 것"*)
 *   `images[0]` 은 저장 시점의 커버인데 R2 이관이 `image_url` 만 바꿔 둘이 갈렸다.
 *   주소가 다르니 문자열 중복제거가 못 잡는다. 실측: 활성 이용권 100개 중 99개.
 *
 * ⚠️ 이 파일이 못 잡는 것: 실제 D1 실행 결과 · 라이브 데이터 정리 진행도
 *   (그건 배포 후 `/api/group-buy/products` 응답을 세어야 안다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { replaceGalleryUrl, repairGalleryCover, isHostedUrl } from '@/worker/utils/gallery-cover-sync'

const read = (p: string) => readFileSync(resolve(__dirname, '../../', p), 'utf-8')
/** 설명 주석이 스스로를 만족시키지 않도록 — 판정은 코드 줄만 본다. */
const codeOnly = (src: string) => src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

describe('① 이용권 사용 방식 — QR 은 항상, 셀프는 매장 확인코드', () => {
  const settings = read('worker/utils/redemption-settings.ts')
  const selfRedeem = codeOnly(read('features/group-buy/api/group-buy-public.routes.ts'))
  const gate = codeOnly(read('worker/utils/self-redeem-gate.ts'))

  it('기본값이 store_code — 설정 안 한 매장도 코드를 요구한다', () => {
    expect(codeOnly(settings)).toMatch(/DEFAULT_REDEMPTION_MODE: RedemptionMode = 'store_code'/)
    expect(codeOnly(settings)).toMatch(/mode TEXT NOT NULL DEFAULT 'store_code'/)
  })

  it('self_free 는 저장될 수 없다 — 옛 행은 읽는 순간 기본값이 된다', () => {
    const list = /REDEMPTION_MODES: readonly RedemptionMode\[\] = \[([^\]]*)\]/.exec(codeOnly(settings))
    expect(list, 'REDEMPTION_MODES 선언을 못 찾음').toBeTruthy()
    expect(list![1]).not.toContain('self_free')
    expect(list![1]).toContain('store_code')
    expect(list![1]).toContain('scan_only')
  })

  it('조회 실패는 fail-closed — 모르면 막는다', () => {
    // catch 안에서 느슨한 모드로 떨어지면 DB 한 번 삐끗에 아무나 소각한다.
    expect(codeOnly(settings)).toMatch(/catch \{[\s\S]{0,200}return \{ mode: DEFAULT_REDEMPTION_MODE/)
    expect(codeOnly(settings)).not.toMatch(/return \{ mode: 'self_free'/)
  })

  it('판매자 없는 상품도 게이트를 통과해야 한다 (예전엔 통째로 건너뜀)', () => {
    // 옛 조건 `pre.seller_id != null &&` 이 남아 있으면 데모 전량이 다시 무방비가 된다.
    expect(selfRedeem).not.toMatch(/if \(pre\.seller_id != null && pre\.status === 'unused'\)/)
    expect(selfRedeem).toMatch(/if \(pre\.status === 'unused'\)/)
    // 배선 — 판정을 부르고, 거절이면 **실제로 반환**한다(불러 놓고 무시하면 게이트가 없는 것과 같다).
    expect(selfRedeem).toMatch(/checkSelfRedeemGate\(DB, pre\.seller_id, String\(body\.store_code \|\| ''\)\)/)
    expect(selfRedeem).toMatch(/if \(!gate\.ok\) return c\.json\(/)
    // 매장이 없으면 셀프 불가 — 확인코드를 발급해 줄 주체가 없다.
    expect(gate).toMatch(/sellerId == null[\s\S]{0,300}'NO_STORE'/)
  })

  it('셀프 사용은 확인코드 일치가 필수 — 설정 조회 실패도 막는다', () => {
    expect(gate).toMatch(/input !== s\.store_code[\s\S]{0,200}STORE_CODE_REQUIRED/)
    expect(gate).toMatch(/catch \{[\s\S]{0,300}STORE_CODE_REQUIRED/)
    expect(gate).toMatch(/s\.mode === 'scan_only'[\s\S]{0,200}SCAN_ONLY_MODE/)
  })

  it('직원 QR 스캔 경로는 모드와 무관하다 — 게이트를 옮겨 심지 않았는지', () => {
    // 이 불변식이 깨지면 "QR 아니면 확인코드" 가 "확인코드만" 이 된다.
    const voucherRoutes = read('features/group-buy/api/group-buy-voucher.routes.ts')
    const i = voucherRoutes.indexOf("'/:code/use-by-seller'")
    expect(i, 'use-by-seller 라우트를 못 찾음').toBeGreaterThan(0)
    const block = voucherRoutes.slice(i, i + 4000)
    expect(block).not.toContain('getRedemptionSettings')
  })
})

describe('② 리뷰 등록 — 왜 안 눌리는지 말해 준다', () => {
  const src = read('pages/product-detail/ProductReviews.tsx')
  it('최소 글자 수가 상수 하나로 묶여 있다 (버튼과 안내가 갈리지 않게)', () => {
    expect(codeOnly(src)).toMatch(/const MIN_REVIEW_LEN = 10/)
    expect(codeOnly(src)).toMatch(/disabled=\{content\.length < MIN_REVIEW_LEN \|\| submitting\}/)
    expect(codeOnly(src)).not.toMatch(/content\.length < 10/)
  })
  it('모자랄 때 남은 글자 수를 화면에 쓴다', () => {
    expect(codeOnly(src)).toMatch(/content\.length < MIN_REVIEW_LEN &&[\s\S]{0,400}reviews\.minLength/)
    expect(codeOnly(src)).toMatch(/n: MIN_REVIEW_LEN - content\.length/)
  })
})

describe('③ 갤러리 — 커버와 첫 칸이 갈리지 않는다', () => {
  const HOSTED = '/api/media/uploads/demo/2026-09/abc.jpg'
  const EXT = 'https://t1.daumcdn.net/local/photo/aaa?original'

  it('이관 시 갤러리 안의 같은 주소도 함께 바뀐다', () => {
    const next = replaceGalleryUrl(JSON.stringify([EXT, 'https://x/2.jpg']), EXT, HOSTED)
    expect(next && JSON.parse(next)).toEqual([HOSTED, 'https://x/2.jpg'])
  })

  it('옛 커버가 갤러리에 없으면 아무것도 안 한다 (추측 금지)', () => {
    expect(replaceGalleryUrl(JSON.stringify(['https://x/2.jpg']), EXT, HOSTED)).toBeNull()
    expect(replaceGalleryUrl(null, EXT, HOSTED)).toBeNull()
    expect(replaceGalleryUrl('not-json', EXT, HOSTED)).toBeNull()
  })

  it('이미 갈린 행은 첫 칸을 현재 커버로 맞춘다 → 중복이 접힌다', () => {
    // 대표가 본 화면: 이관본 커버 + 외부 원본 1장 = 같은 사진 두 칸.
    const next = repairGalleryCover(JSON.stringify([EXT]), HOSTED)
    expect(next && JSON.parse(next)).toEqual([HOSTED])
  })

  it('나머지 사진은 그대로 남는다 — 지우는 게 아니라 주소를 맞추는 것', () => {
    const next = repairGalleryCover(JSON.stringify([EXT, 'https://x/2.jpg', 'https://x/3.jpg']), HOSTED)
    expect(next && JSON.parse(next)).toEqual([HOSTED, 'https://x/2.jpg', 'https://x/3.jpg'])
  })

  it('정합이거나 이관 전이면 건드리지 않는다', () => {
    expect(repairGalleryCover(JSON.stringify([HOSTED, 'https://x/2.jpg']), HOSTED)).toBeNull()
    expect(repairGalleryCover(JSON.stringify([EXT]), EXT)).toBeNull()       // 커버가 아직 외부
    expect(repairGalleryCover(JSON.stringify(['/api/media/x.jpg']), HOSTED)).toBeNull() // 첫 칸이 우리 것
  })

  it('우리 저장소 주소 판정', () => {
    expect(isHostedUrl('/api/media/x.jpg')).toBe(true)
    expect(isHostedUrl('https://media.ur-team.com/x.jpg')).toBe(true)
    expect(isHostedUrl(EXT)).toBe(false)
    expect(isHostedUrl(null)).toBe(false)
  })

  it('이관 쓰기 시점에 두 컬럼을 같이 쓴다 (재발 차단)', () => {
    // 🩸 되돌려-검증에서 이 검사가 **헛돌았다**: `UPDATE … image_url = ?, images = ?` 라는 같은
    //   문자열이 recondition 블록에도 있어서, bulk 이관에서 그 UPDATE 를 통째로 지워도 초록이었다.
    //   ⇒ 파일 전체가 아니라 **그 호출 지점 주변**만 본다.
    const cron = codeOnly(read('worker/cron/demo-image-rehost.ts'))
    const at = cron.indexOf('replaceGalleryUrl(row.images, row.image_url, hosted)')
    expect(at, '이관 블록에서 갤러리 동기화 호출을 못 찾음').toBeGreaterThan(0)
    expect(cron.slice(at, at + 500)).toMatch(/UPDATE products SET image_url = \?, images = \?/)
  })

  it('정리 패스가 전진한다 — 고칠 행만 고르고, 시도가 아니라 쓴 것을 센다', () => {
    // 🩸 첫 판은 `images LIKE '%http%'` 로 골라 **수렴하지 않았다**: 갤러리가 여러 장이면 첫 칸을
    //   고쳐도 뒤쪽 외부 주소 때문에 후보로 남아, 고쳐진 행이 ORDER BY 창 앞자리를 채우다가
    //   40개를 넘기면 창 전체가 no-op 이 된다(뒤쪽 행은 영영 안 보임). 에러 없이 조용히 멈춘다.
    const cron = codeOnly(read('worker/cron/demo-image-rehost.ts'))
    const at = cron.indexOf('export async function repairGalleryCoverDrift')
    expect(at, 'repairGalleryCoverDrift 를 못 찾음').toBeGreaterThan(0)
    const fn = cron.slice(at, at + 2200)
    expect(fn).toMatch(/json_extract\(images, '\$\[0\]'\) LIKE 'http%'/)
    expect(fn).not.toMatch(/AND images LIKE '%http%'/)     // 옛 넓은 조건이 되살아나면 다시 멈춘다
    expect(fn).toMatch(/meta\?\.changes \|\| 0\) > 0\) fixed\+\+/)  // 시도가 아니라 성공을 센다
  })

  it('정리 패스는 R2 바인딩 없이도 돈다 (조기반환보다 앞)', () => {
    const cron = codeOnly(read('worker/cron/demo-image-rehost.ts'))
    const repair = cron.indexOf('repairGalleryCoverDrift(env)')
    const bail = cron.indexOf("skipped: 'NO_MEDIA_BUCKET'")
    expect(repair).toBeGreaterThan(0)
    expect(bail).toBeGreaterThan(0)
    expect(repair, '정리 패스가 조기반환 뒤에 있으면 바인딩 없는 배포에서 영영 안 돈다').toBeLessThan(bail)
  })
})
