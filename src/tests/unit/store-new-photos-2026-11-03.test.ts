/**
 * 📷 매장 등록 뒤 화면들 — 2026-11-03 대표 확정 (시안 캔버스 "이후 페이지").
 *
 *   *"사장님이 자신의 사진을 첨부파일로 올릴 수 있는게 최우선, 그리고 네이버에서 고를 수 있게끔"*
 *   *"사진이 없으면 막자"* · 첫 이용권은 등록증 전에도 올린다 · ⑥⑦ 을 대시보드 밖(다크 지원)으로 — *"응 모두 해줘"*.
 *
 * 고정하는 것:
 *   ① 사진 0장이면 [이용권 올리기]가 꺼지고, 이유 한 줄을 말한다.
 *   ② '내 사진 올리기'가 네이버 줄보다 먼저 그려진다(최우선).
 *   ③ 네이버 사진은 자동으로 넣지 않는다 — 누를 때만 추가 + "우리 가게 사진인지 확인" 안내.
 *   ④ 저장은 사진을 실어 보낸다(첫 장 = image_url, 전체 = images).
 *   ⑤ 업로드 실패를 data URL 로 위장하지 않는다(필수 칸을 가짜 사진으로 채우지 않는다).
 *   ⑥ ⑥⑦ 은 소비자 전체 화면 주소이고 종전 서버 계약을 그대로 쓴다.
 *
 * ⚠️ 못 보는 것: 실제 업로드·네이버 응답·사진이 보기 좋은지(그려서 봐야 한다) · 저작권 판단 자체.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const src = (p: string) => stripComments(readFileSync(p, 'utf8'))
const PAGE = 'src/pages/store-new/FirstVoucherPage.tsx'
const PHOTOS = 'src/pages/store-new/VoucherPhotos.tsx'
const UPLOAD = 'src/pages/store-new/upload-photo.ts'

describe('① 사진 없으면 막는다', () => {
  it('0장이면 이유가 있고, 버튼이 그 이유로 꺼진다', () => {
    const s = src(PAGE)
    expect(s).toContain("const blockReason = photos.length === 0 ? '사진을 1장 이상 올려 주세요' : null")
    expect(s).toMatch(/disabled=\{submitting \|\| !!blockReason\}/)
    expect(s).toMatch(/\{blockReason && <p[^>]*>\{blockReason\}<\/p>\}/)
  })
  it('저장 함수도 사진 없이 못 지나간다 (버튼만 막으면 Enter·중복 호출로 샌다)', () => {
    expect(src(PAGE)).toMatch(/async function submit\(\) \{\s*setTried\(true\)\s*if \(blockReason\) return/)
  })
})

describe('② 내 사진이 먼저', () => {
  it('업로드 칸이 네이버 줄보다 앞에 있다', () => {
    const s = src(PHOTOS)
    const mine = s.indexOf('data-testid="first-voucher-upload"')
    const naver = s.indexOf('네이버에서 찾은 이 가게 사진')
    expect(mine).toBeGreaterThan(0)
    expect(naver).toBeGreaterThan(mine)
  })
})

describe('③ 네이버 사진은 고르게 한다', () => {
  it('검색 결과를 자동으로 사진 목록에 넣지 않는다', () => {
    const s = src(PHOTOS)
    // 결과는 제안 상태(suggest)에만 담기고, 사진 목록 변경(onChange)은 사용자의 누름(addNaver)에서만 일어난다.
    expect(s).toMatch(/searchNaverPhotos\(baseQuery, 9\)\.then\(\(u\) => \{ if \(alive\) setSuggest\(u\) \}\)/)
    expect(s).not.toMatch(/setSuggest\([^)]*\)[\s\S]{0,40}onChange\(/)
    expect(s).toMatch(/onClick=\{\(\) => addNaver\(\[u\]\)\}/)
  })
  it('남의 사진일 수 있다는 안내가 줄과 창 둘 다에 있다', () => {
    expect(src(PHOTOS)).toContain('우리 가게 사진인지 확인하고 골라 주세요')
    expect(src('src/pages/store-new/NaverPhotoSheet.tsx')).toContain('우리 가게 사진인지 확인하고')
  })
})

describe('④ 저장이 사진을 싣는다', () => {
  it('첫 장 = image_url, 전체 = images', () => {
    const s = src(PAGE)
    expect(s).toContain('image_url: photos[0].url')
    expect(s).toContain('images: JSON.stringify(photos.map((p) => p.url))')
    expect(s, '판매 기간 제한 없음(대표 확정)').toContain('group_buy_deadline: null')
  })
})

describe('⑤ 업로드 실패를 사진으로 위장하지 않는다', () => {
  it('data URL 로 바꿔 넣지 않는다', () => {
    const s = src(UPLOAD)
    expect(s).not.toMatch(/readAsDataURL|data:image/)
    expect(s).toMatch(/return \{ ok: false, message:/)
  })
})

describe('⑥ 사업자등록증 · 정산 계좌 — 소비자 화면 · 종전 서버 계약', () => {
  it('하단 탭 없는 전체 화면 주소다', async () => {
    const { consumerChromeHiddenByPath } = await import('@/lib/consumer-chrome')
    for (const p of ['/store/first-voucher', '/store/biz-cert', '/store/bank']) expect(consumerChromeHiddenByPath(p), p).toBe(true)
  })
  it('등록증은 전용 자리로 올리고 종전 제출 API 를 부른다', () => {
    const s = src('src/pages/store-new/StoreBizCertPage.tsx')
    expect(s).toContain("api.post('/api/upload/business-cert'")
    expect(s).toContain("api.post('/api/seller/business-registration/submit'")
    expect(s).toContain('BUSINESS_CERT_MAX_FILE_BYTES')
  })
  it('계좌는 종전과 같은 프로필 저장으로 — 가려진 계좌를 칸에 미리 채우지 않는다', () => {
    const s = src('src/pages/store-new/StoreBankPage.tsx')
    expect(s).toContain("api.put('/api/seller/profile', { bank_name: bank, bank_account: digits, account_holder: holder.trim() }")
    expect(s, '서버가 돌려주는 계좌는 ****1234 라 칸에 넣으면 그대로 저장된다').not.toMatch(/setAccount\(\s*String\(d\.bank_account/)
  })
  it('다크를 따른다 — 늘 흰 화면 클래스를 쓰지 않는다', () => {
    for (const f of ['src/pages/store-new/StoreStepShell.tsx', PAGE]) {
      const s = src(f)
      expect(s).toMatch(/\bbg-warm\b/)
      expect(s).not.toMatch(/force-light-theme/)
    }
  })
})
