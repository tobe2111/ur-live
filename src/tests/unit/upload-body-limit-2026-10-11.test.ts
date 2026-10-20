/**
 * 📤 업로드 한도 — **실제로 자르는 것**이 클라의 전제와 같은가 (2026-10-11, 대표 신고 413).
 *
 * 대표: *"/api/upload/image → 413. 사진 바꾸니까 요청 본문이 크다는데?"*
 *
 * 무엇을 지키는가: 한도가 **세 군데서 서로 다른 말**을 하고 있었다 —
 *   클라 가드 5MB · 라우트 `MAX_SIZE` 10MB · **전역 `bodyLimit(1MB)`**. 앞의 둘은 도달 불가·거짓이고
 *   사용자는 우리 문구가 아니라 미들웨어의 "요청 본문이 너무 큽니다" 를 받았다. 이 시험은 그 셋이
 *   다시 갈리는 것을 막는다: 천장은 **서버 소스에서 다시 파싱**해 상수와 대조하고(①),
 *   클라 업로드는 **전부 압축을 거치는지** 전수로 센다(②).
 *
 * ⚠️ 이 시험이 **못 막는 것**:
 *   - 압축 품질(사진이 보기 좋은가·등록증이 읽히는가) — 눈으로 봐야 한다.
 *   - 압축기가 실제로 목표 크기를 맞추는가 — jsdom 에 캔버스가 없어 여기서 못 돌린다.
 *     그래서 ③은 **목표 숫자가 천장 아래인지**만 본다.
 *   - 압축이 답이 될 수 없는 **둘**(등록증 2MB 목표 · 배너 **영상**)은 서버 천장을 올려야 풀린다
 *     → `docs/decisions/archive/2026-10-11-upload-body-limit.md`(2026-10-13 대표 승인 — ①-2 가 지킨다). ②의 허용목록이 그 부채를
 *     **이름과 사유로** 들고 있다.
 *     🩸 처음엔 셋이라고 적었다 — 도매 제조사 화면을 세었는데 **도매몰은 안 하는 서비스**다
 *     (2026-10-11 대표 정정). 안 하는 서비스를 결재 근거로 세지 말 것.
 *
 * 주입 매니페스트: scripts/mutations/upload-body-limit.mjs
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from '../helpers/source-text'
import {
  API_BODY_LIMIT_BYTES,
  API_BODY_LIMIT_OVERRIDES,
  BUSINESS_CERT_BODY_LIMIT_BYTES,
  BUSINESS_CERT_MAX_FILE_BYTES,
  apiBodyLimitFor,
  UPLOAD_MAX_FILE_BYTES,
  MULTIPART_OVERHEAD_BYTES,
  UPLOAD_SOURCE_MAX_BYTES,
  fitsApiBodyLimit,
} from '../../shared/upload-limits'
import { bodyLimitByPath } from '../../worker/middleware/body-limit'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))
const WORKER = read('src/worker/index.ts')
const COMPRESS = read('src/lib/image-compress.ts')
const PREPARE = read('src/lib/prepare-upload.ts')

describe('① 천장은 클라가 지어내지 않는다 — 워커가 SSOT 를 그대로 쓰는가', () => {
  // 🔁 2026-10-13 재조준: 종전엔 워커 소스에서 `bodyLimit(1_000_000)` 숫자를 **다시 파싱**해 상수와
  //   대조했다. 대표 승인(두 엔드포인트 예외)으로 천장이 경로별 표가 되면서 워커는 숫자를 갖지 않고
  //   SSOT 함수를 **그대로** 부른다 ⇒ 갈릴 수가 없다. 지키려던 것(클라가 믿는 값 = 서버가 자르는 값)은
  //   그대로이고, 이제 "워커가 그 함수를 쓰는가" 와 "그 함수가 무엇을 돌려주는가" 를 본다.
  it('`/api/*` 미들웨어가 SSOT 함수(`apiBodyLimitFor`)로 천장을 정한다 — 워커에 숫자가 없다', () => {
    expect(WORKER).toMatch(/app\.use\('\/api\/\*',\s*bodyLimitByPath\(apiBodyLimitFor\)\)/)
    expect(WORKER).toMatch(/import \{ apiBodyLimitFor \} from '\.\.\/shared\/upload-limits'/)
    // 숫자로 된 전역 천장이 워커에 되살아나면 두 벌이 된다
    expect(WORKER).not.toMatch(/bodyLimit\(\s*[\d_]+\s*\)/)
  })

  it('업로드 라우트가 전역 미들웨어 **뒤에** 마운트된다 — 그래서 미들웨어가 실제 천장이다', () => {
    const mw = WORKER.indexOf('bodyLimitByPath(apiBodyLimitFor)')
    const mount = WORKER.indexOf("app.route('/api', uploadRoutes)")
    expect(mw).toBeGreaterThan(0)
    expect(mount).toBeGreaterThan(0)
    expect(mw).toBeLessThan(mount)
  })

  it('파일 천장은 multipart 오버헤드만큼 낮다 (Content-Length 는 파일 크기가 아니다)', () => {
    expect(UPLOAD_MAX_FILE_BYTES).toBe(API_BODY_LIMIT_BYTES - MULTIPART_OVERHEAD_BYTES)
    expect(MULTIPART_OVERHEAD_BYTES).toBeGreaterThan(0)
    expect(fitsApiBodyLimit(UPLOAD_MAX_FILE_BYTES)).toBe(true)
    expect(fitsApiBodyLimit(UPLOAD_MAX_FILE_BYTES + 1)).toBe(false)
  })
})

/**
 * ①-2 대표 승인 예외 (2026-10-13, 결재 2026-10-11-upload-body-limit 안 1) — **두 자리만, 필요한 값만.**
 * 반대 방향이 더 위험하다: 접두 일치로 `/api/upload/` 전체가 열리면 `image`(100/10분)까지 IP 당
 * 1GB/10분이 된다(결재 파일이 기각한 안 2). 그래서 "열린 곳" 과 "닫힌 곳" 을 함께 본다.
 */
describe('①-2 경로별 천장 — 승인된 두 자리만 열린다', () => {
  it('등록증 2.2MB · 히어로 영상 10MB(+경계) — 인제스트(바이어 풀)는 2026-10-20 삭제', () => {
    expect(apiBodyLimitFor('/api/upload/business-cert')).toBe(2_200_000)
    expect(apiBodyLimitFor('/api/upload/banner-video')).toBe(10 * 1024 * 1024 + MULTIPART_OVERHEAD_BYTES)
    expect(apiBodyLimitFor('/api/buyer-ingest')).toBe(API_BODY_LIMIT_BYTES)
  })

  it('나머지는 전부 1MB — 이미지 업로드·접두·꼬리 슬래시·프로토타입 키까지', () => {
    for (const p of [
      '/api/upload/image', '/api/upload/', '/api/upload/business-cert/', '/api/upload/business-certX',
      '/api/upload/banner-video/x', '/api/orders', '/api/constructor', 'constructor', '__proto__', '',
    ]) expect(apiBodyLimitFor(p), p).toBe(API_BODY_LIMIT_BYTES)
  })

  it('표에 승인된 두 경로 말고는 없다 (조용히 늘지 않게)', () => {
    expect([...API_BODY_LIMIT_OVERRIDES.keys()].sort()).toEqual(
      ['/api/upload/banner-video', '/api/upload/business-cert'])
  })

  it('파일 천장이 압축 목표를 담는다 — 등록증 2MB 목표가 들어간다', () => {
    expect(BUSINESS_CERT_MAX_FILE_BYTES).toBe(BUSINESS_CERT_BODY_LIMIT_BYTES - MULTIPART_OVERHEAD_BYTES)
    const doc = COMPRESS.slice(COMPRESS.indexOf('compressForDocument'))
    const target = Number(doc.match(/maxSizeMB:\s*([\d.]+)/)?.[1])
    expect(target).toBeGreaterThan(0)
    expect(target * 1024 * 1024).toBeLessThan(BUSINESS_CERT_MAX_FILE_BYTES)
  })

  it('미들웨어가 실제로 경로별로 자른다 (동작)', async () => {
    const mw = bodyLimitByPath(apiBodyLimitFor)
    const run = async (path: string, len: number) => {
      let passed = false
      let status = 0
      const c = {
        req: { path, header: (k: string) => (k === 'content-length' ? String(len) : undefined) },
        json: (_b: unknown, s: number) => { status = s; return null },
      }
      await mw(c as never, async () => { passed = true })
      return passed ? 'pass' : status
    }
    expect(await run('/api/upload/business-cert', 2_100_000)).toBe('pass')
    expect(await run('/api/upload/business-cert', 2_200_001)).toBe(413)
    expect(await run('/api/upload/image', 1_000_001)).toBe(413)
    expect(await run('/api/upload/banner-video', 9_000_000)).toBe('pass')
    expect(await run('/api/orders', 1_500_000)).toBe(413)
  })

  it('라우트와 클라 가드가 같은 SSOT 값을 쓴다 — 세 군데가 다시 다른 말을 하지 않게', () => {
    const ROUTE = read('src/features/upload/api/upload.routes.ts')
    expect(ROUTE).toMatch(/file\.size > BIZ_CERT_MAX\)/)
    expect(ROUTE).toMatch(/file\.size > VIDEO_MAX\)/)
    expect(ROUTE).toMatch(/const BIZ_CERT_MAX = BUSINESS_CERT_MAX_FILE_BYTES/)
    expect(ROUTE).toMatch(/const VIDEO_MAX = BANNER_VIDEO_MAX_FILE_BYTES/)
    for (const p of [
      'src/components/BusinessCertUpload.tsx',
      'src/components/seller/StoreRegisterModal.tsx',
      'src/pages/SellerBusinessInfoPage.tsx',
      'src/components/seller/FoodPermitUpload.tsx',
    ]) {
      const src = read(p)
      expect(src, p).toContain('BUSINESS_CERT_MAX_FILE_BYTES')
      expect(src, `${p} — 손으로 적은 10MB 가 되살아났다`).not.toMatch(/10\s*\*\s*1024\s*\*\s*1024/)
    }
  })
})

/**
 * ② 전수 — 클라에서 `/api/upload/*` 로 보내는 모든 자리가 압축을 거친다.
 *
 * 허용목록은 **사유와 함께만** 늘린다. "압축하면 깨진다" 는 사유는 유효하지만, 그렇다면 그 자리는
 * 천장 아래로 못 내려가므로 서버 카브아웃이 필요하다는 뜻이다(결재 파일 참조).
 */
const COMPRESSORS = ['prepareImageForUpload', 'compressForUpload', 'compressForThumbnail', 'compressForDocument', 'optimizeImageForUpload']

const ALLOW: Record<string, string> = {
  // 📄 등록증·영업신고증 — `compressForDocument`(2MB 목표)를 쓰지만 그 목표가 천장(1MB)보다 크다.
  //    해상도를 깎으면 어드민이 사업자번호를 못 읽으므로 서버 천장을 올려야 풀린다(2026-10-13 승인으로 2.2MB — ①-2).
  //    ⇒ 압축은 거치므로 ② 자체는 통과한다. 여기 적는 것은 '압축 없음' 이 아니라 '천장 초과 가능' 이다.
  // 🧨 2026-10-11 (같은 날 오후) 도매몰 철거로 `supplier-dashboard/MultiImageUpload.tsx` 가 **삭제됐다**
  //   ⇒ 더 이상 업로드 호출부가 아니라 허용목록에서 뺀다. 이 아래 "허용목록은 실재하는 파일만 담는다"
  //   단언이 바로 그걸 잡았다(낡은 면제가 조용히 남는 것을 막는 장치가 제 일을 했다).
  // 🩸 2026-10-14 — `BannerMediaUpload.tsx` 를 여기서 뺐다. **영상** 사유로 파일을 통째 면제했더니
  //   같은 파일의 **이미지** 경로(/api/upload/image, 1MB)가 원본을 그대로 보내는데도 눈에서 빠졌다
  //   (화면은 "최대 10MB" 라고 안내했다). 이제 이미지는 `prepareImageForUpload({ hero: true })` 를 거치고
  //   영상은 서버 카브아웃(①-2)이 받는다. ⇒ **면제는 파일 단위라 사유보다 넓게 먹는다 — 면제를 늘리지 말 것.**
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'tests') walk(p, out) }
    else if (/\.(ts|tsx)$/.test(p) && !/\.test\./.test(p)) out.push(p)
  }
  return out
}

const CLIENT_ROOTS = ['src/pages', 'src/components', 'src/features']
const callSites = walk('src/pages')
  .concat(...CLIENT_ROOTS.slice(1).map(r => walk(r)))
  .map(p => ({ path: p.replace(/\\/g, '/'), src: read(p) }))
  .filter(f => /api\/upload\//.test(f.src) && /FormData|append\(/.test(f.src))
  .filter(f => !f.path.includes('/api/upload.routes'))

describe('② 클라 업로드는 전부 압축을 거친다 (전수)', () => {
  it('훑을 호출부를 실제로 찾았다 — 0건이면 통과가 아니라 고장이다', () => {
    expect(callSites.length).toBeGreaterThanOrEqual(5)
  })

  it('압축기를 거치지 않는 새 업로드 자리가 없다', () => {
    const bare = callSites
      .filter(f => !COMPRESSORS.some(c => f.src.includes(c)))
      .map(f => f.path)
      .filter(p => !(p in ALLOW))
    expect(bare, `압축 없이 업로드하는 자리 — 전역 bodyLimit ${API_BODY_LIMIT_BYTES}B 에서 413 이 난다`).toEqual([])
  })

  it('허용목록은 실재하는 파일만 담는다 (낡은 면제가 조용히 남지 않게)', () => {
    const known = new Set(callSites.map(f => f.path))
    for (const p of Object.keys(ALLOW)) expect(known.has(p), `${p} 는 더 이상 업로드 호출부가 아니다 — 허용목록에서 빼라`).toBe(true)
  })

  it('허용목록의 사유가 비어 있지 않다', () => {
    for (const [p, why] of Object.entries(ALLOW)) expect(why.length, p).toBeGreaterThan(20)
  })
})

describe('③ 사진 압축 목표가 천장 아래다 (숫자만 — 품질은 눈으로)', () => {
  it('compressForUpload 기본값과 compressForThumbnail 이 천장보다 작다', () => {
    const def = Number(COMPRESS.match(/maxSizeMB\s*=\s*([\d.]+)/)?.[1])
    expect(def).toBeGreaterThan(0)
    expect(def * 1024 * 1024).toBeLessThan(UPLOAD_MAX_FILE_BYTES)

    const at = COMPRESS.indexOf('export async function compressForThumbnail')
    expect(at).toBeGreaterThan(0)
    const thumb = Number(COMPRESS.slice(at, at + 200).match(/maxSizeMB:\s*([\d.]+)/)?.[1])
    expect(thumb).toBeGreaterThan(0)
    expect(thumb * 1024 * 1024).toBeLessThan(UPLOAD_MAX_FILE_BYTES)
  })

  it('"이미 작으면 스킵" 단축이 천장 넘는 파일을 통과시키지 않는다 — 목표 기준으로 판단한다', () => {
    // `if (file.size < maxSizeMB * 1024 * 1024 && ...) return file` — 목표가 천장 아래이기만 하면 안전하다.
    expect(COMPRESS).toMatch(/file\.size\s*<\s*maxSizeMB\s*\*\s*1024\s*\*\s*1024/)
  })
})

describe('④ 준비 헬퍼가 413 전에 우리가 판정한다', () => {
  it('압축 후 천장을 검사한다', () => {
    expect(PREPARE).toContain('fitsApiBodyLimit(ready.size)')
    expect(PREPARE).toMatch(/throw new UploadTooLargeError\('compressed'/)
  })

  it('압축 전 원본 상한은 **브라우저 보호**용이고 서버 천장보다 크다 (폰 사진을 그냥 거절하지 않는다)', () => {
    expect(UPLOAD_SOURCE_MAX_BYTES).toBeGreaterThan(API_BODY_LIMIT_BYTES * 5)
    expect(PREPARE).toMatch(/file\.size\s*>\s*UPLOAD_SOURCE_MAX_BYTES/)
  })

  it('압축 실패가 업로드를 막지 않는다 (fail-soft — 원본으로 시도)', () => {
    expect(PREPARE).toMatch(/compress\(file\)\.catch\(\(\) => file\)/)
  })

  it('🔒 잠금표 계약 — browser-image-compression 을 정적으로 끌어올리지 않는다', () => {
    expect(COMPRESS).toMatch(/import\('browser-image-compression'\)/)
    expect(COMPRESS).not.toMatch(/^import .*from 'browser-image-compression'/m)
    // 준비 헬퍼도 동적으로 부른다(정적이면 이 모듈을 쓰는 화면의 첫 페인트에 51KB 가 실린다).
    expect(PREPARE).toMatch(/await import\('\.\/image-compress'\)/)
    expect(PREPARE).not.toMatch(/^import .*from '\.\/image-compress'/m)
  })
})

describe('⑤ 세 자리가 실제로 배선됐다 — 압축본을 보낸다', () => {
  const SITES = [
    'src/pages/user-profile/profile-edit/ProfileEditSheet.tsx',
    'src/pages/my-vouchers/ReviewBonusButton.tsx',
    'src/pages/SellerProspectsPage.tsx',
    'src/pages/admin/banners/BannerMediaUpload.tsx',
  ]
  for (const p of SITES) {
    it(`${p.split('/').pop()} — fd 에 담기는 것이 압축본이다`, () => {
      const src = read(p)
      expect(src).toContain('prepareImageForUpload(file')
      expect(src).toMatch(/fd\.append\('file', ready\)/)
      expect(src).not.toMatch(/fd\.append\('file', file\)/)
    })
    it(`${p.split('/').pop()} — 압축 전 크기로 잘라내던 옛 가드가 되살아나지 않는다`, () => {
      const src = read(p)
      expect(src).not.toMatch(/file\.size\s*>\s*\d+\s*\*\s*1024\s*\*\s*1024/)
    })
    it(`${p.split('/').pop()} — 천장 초과는 우리 문구로 안내한다`, () => {
      expect(read(p)).toContain('UploadTooLargeError')
    })
  }
})
